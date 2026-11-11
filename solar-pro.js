import { decimal, energyReport, periodWindow, sunPath } from './solar-pro-data.js';
import { benchmark, fmt, printStyles, reportContent, safe } from './solar-pro-view.js';
import { proStyles } from './solar-pro-styles.js';
import { comparablePeriod, loadSfvRegion, regionCandidates, regionURL } from './solar-region.js';

const RANGES = { day: 'Tag', month: 'Monat', year: 'Jahr' };
const REFERENCE_SOURCES = { manual: 'Eigene Angabe', pvoutput: 'PVOutput', sfv: 'SFV Ertragsdatenbank' };
const SECTIONS = { report: 'Auswertung', sun: 'Sonnenstand', settings: 'Einstellungen' };
const NUMBERS = {
  buy: [0, 10000], sell: [-10000, 10000], lat: [-90, 90], lon: [-180, 180],
  minimum: [.1, 350], refKwp: [.01, 100000], refKwh: [0, 100000000], refSpecific: [0, 100000],
};
const angular = (value, unit) => fmt(Math.round(value), unit);
const input = (label, name, value, more = '') => `<label>${label}<input name="${name}" value="${safe(value)}" ${more}></label>`;
const numberInput = (label, name, value) => input(label, name, value == null ? '' : String(value).replace('.', ','), 'inputmode="decimal"');
const clean = (value, length = 70) => String(value ?? '').trim().slice(0, length);
const timeText = (at, zone) => new Intl.DateTimeFormat('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(at);
const stamp = (at, zone) => new Intl.DateTimeFormat('de-DE', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(at);
const localDate = (at, zone) => new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

class OledSolarPro extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.section = 'report';
    this.range = 'day';
    this.date = '';
    this.sunDate = '';
    this.token = 0;
    this.cache = new Map();
    this.regionCache = new Map();
    this.shadowRoot.addEventListener('click', event => this.click(event));
    this.shadowRoot.addEventListener('change', event => this.change(event));
    this.shadowRoot.addEventListener('input', event => {
      if (event.target.matches('[data-sun-time]')) {
        this.stopAnimation();
        this.drawSun(Number(event.target.value));
      }
    });
    this.shadowRoot.addEventListener('submit', event => this.save(event));
  }

  get zone() { return this.hass?.config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone; }
  get today() { return localDate(Date.now(), this.zone); }

  setContext(context) {
    const previous = this.context;
    this.context = context;
    this.hass = context.hass;
    if (previous?.key !== context.key || previous?.config !== context.config) {
      this.stopAnimation();
      this.regionalRequest?.abort();
      this.regional = null;
      this.regionCache.clear();
      let saved;
      try { saved = JSON.parse(localStorage.getItem(context.key + ':pro') ?? '{}'); } catch {}
      this.settings = { ...context.config.pro, ...saved };
      this.cache.clear();
      this.report = null;
      this.load();
      return;
    }
    if (!previous?.hass && this.hass && !this.report) this.load();
    else if (!previous?.hass && this.hass && this.section === 'report') this.refreshRegion();
    if (this.section === 'sun') this.drawAdvice();
  }

  disconnectedCallback() { this.stopAnimation(); }

  async load(force = false) {
    const id = ++this.token;
    const now = Date.now();
    const window = periodWindow(this.range, this.date, now, this.zone);
    this.window = window;
    this.windowKey = [window.start, window.end].join('/');
    const key = this.range + '/' + this.windowKey;
    const cached = this.cache.get(key);
    this.error = '';
    this.report = cached?.report ?? null;
    if (cached && now - cached.at < 3 * 60000 && !force) {
      this.loading = false;
      this.render();
      return;
    }
    this.loading = true;
    this.render();
    try {
      const report = await energyReport(this.hass, this.context.config, window, this.range);
      if (id !== this.token) return;
      this.report = report;
      if (this.cache.size >= 8) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, { at: Date.now(), report });
    } catch (error) {
      if (id !== this.token) return;
      this.error = error instanceof Error ? error.message : 'Energiedaten konnten nicht geladen werden.';
    } finally {
      if (id === this.token) {
        this.loading = false;
        if (this.section === 'report') this.render();
      }
    }
  }

  click(event) {
    const { section, proAction } = event.target.closest('button')?.dataset ?? {};
    if (section) {
      this.stopAnimation();
      this.section = section;
      this.render();
      this.shadowRoot.querySelector(`[data-section="${section}"]`)?.focus({ preventScroll: true });
    }
    if (proAction === 'refresh') {
      if (this.regional) this.regionCache.delete(this.regional.key);
      this.regional = null;
      void this.load(true);
    }
    if (proAction === 'print') this.print();
    if (proAction === 'play') this.play();
  }

  change(event) {
    const field = event.target.dataset.period;
    if (field === 'range') {
      this.range = event.target.value;
      this.date = '';
      void this.load();
    }
    if (field === 'date' && event.target.checkValidity()) {
      this.date = event.target.value;
      void this.load();
    }
    if (event.target.matches('[data-sun-date]') && event.target.checkValidity()) {
      this.stopAnimation();
      this.sunDate = event.target.value;
      this.sunIndex = undefined;
      this.render();
    }
  }

  save(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    if (event.target.matches('[data-region-search]')) {
      const place = clean(data.get('regionPlace'));
      this.settings.regionPlace = place;
      if (this.regional?.error) this.regional = null;
      this.persistSettings();
      this.render();
      this.shadowRoot.querySelector('[data-region-search] input')?.focus({ preventScroll: true });
      return;
    }
    const next = { ...this.settings };
    const status = this.shadowRoot.querySelector('[data-settings-status]');
    for (const [key, bounds] of Object.entries(NUMBERS)) {
      next[key] = decimal(data.get(key), ...bounds);
      if (clean(data.get(key)) && next[key] === null) {
        status.textContent = 'Bitte prüfe den Wert im ausgewählten Zahlenfeld.';
        event.target.elements.namedItem(key)?.focus();
        return;
      }
    }
    if ((next.lat === null) !== (next.lon === null)) {
      status.textContent = 'Bitte Breiten- und Längengrad zusammen eintragen.';
      return;
    }
    next.place = clean(data.get('place'));
    if (next.place !== this.settings.place) next.regionPlace = next.place;
    next.snow = data.get('snow') === 'on';
    next.balance = data.get('balance') === 'on';
    next.arrays = [];
    for (let i = 0; i < 4; i++) {
      const name = clean(data.get('name' + i));
      const az = decimal(data.get('az' + i), 0, 360);
      const tilt = decimal(data.get('tilt' + i), 0, 90);
      const count = decimal(data.get('count' + i), 1, 2000);
      if (!name && !['az', 'tilt', 'count'].some(key => clean(data.get(key + i)))) continue;
      if (az === null || tilt === null || (clean(data.get('count' + i)) && !Number.isInteger(count))) {
        status.textContent = `Bei Modulfläche ${i + 1} bitte Ausrichtung und Neigung sowie bei Bedarf eine ganze Modulanzahl eintragen.`;
        return;
      }
      next.arrays.push({ name: name || `Modulfläche ${i + 1}`, az: az % 360, tilt, count });
    }
    const name = clean(data.get('refName'));
    const source = REFERENCE_SOURCES[data.get('refSource')] ?? REFERENCE_SOURCES.manual;
    const hasRaw = next.refKwp !== null || next.refKwh !== null;
    if (name || hasRaw || next.refSpecific !== null) {
      if (!name || !this.window || (hasRaw ? next.refKwp === null || next.refKwh === null || next.refSpecific !== null : next.refSpecific === null)) {
        status.textContent = 'Für den Vergleich bitte Name und spezifischen Ertrag eintragen oder Name, Anlagenleistung und Ertrag.';
        return;
      }
      next.reference = { name, source, sourceKey: data.get('refSource'), kwp: next.refKwp, kwh: next.refKwh,
        specific: next.refSpecific, key: this.windowKey };
    } else if (next.reference?.key === this.windowKey) {
      next.reference = null;
    }
    delete next.refKwp;
    delete next.refKwh;
    delete next.refSpecific;
    this.settings = next;
    this.sunIndex = undefined;
    status.textContent = this.persistSettings() ? 'Einstellungen gespeichert.'
      : 'Der Browser konnte die Einstellungen nur für diese Sitzung übernehmen.';
  }

  persistSettings() {
    try {
      localStorage.setItem(this.context.key + ':pro', JSON.stringify(this.settings));
      return true;
    } catch {
      return false;
    }
  }

  get regionPlace() {
    return this.settings.regionPlace ?? (this.context.config.demo ? '' : this.settings.place);
  }

  regionalView() {
    const place = this.regionPlace;
    return `<section class="pro-box pro-near sfv-region"><h3>Ertragsvergleich nach PLZ-Region</h3>
      <form class="pro-tools sfv-search" data-region-search>
        ${input('Ort in Deutschland oder PLZ', 'regionPlace', place, 'maxlength="70" autocomplete="off"')}
        <button type="submit">Region vergleichen</button>
      </form>
      <div data-region-result aria-live="polite">${this.regionContent()}</div>
      <div class="region-links">
        <a href="https://pvoutput.org/map.jsp" target="_blank" rel="noopener noreferrer">Einzelanlagen auf der PVOutput-Karte</a>
        <a href="https://pv-ertraege.sfv.de/auswertung/index.html" target="_blank" rel="noopener noreferrer">SFV-Ertragsdatenbank</a>
        <a href="https://re.jrc.ec.europa.eu/pvg_tools/en/" target="_blank" rel="noopener noreferrer">Standort mit PVGIS modellieren</a>
        <a href="https://www.geonames.org/export/zip/" target="_blank" rel="noopener noreferrer">Ortsverzeichnis von GeoNames</a>
      </div>
    </section>`;
  }

  regionContent() {
    const place = this.regionPlace;
    if (!place) return '<p class="pro-caption">Gib einen Ort oder eine PLZ ein, um den öffentlichen Regionalwert zu laden.</p>';
    const regions = regionCandidates(place);
    if (regions.length !== 1) {
      return regions.length
        ? `<p class="pro-caption">Mehrere PLZ-Bereiche passen zu diesem Ort (${regions.map(region => region + 'xxx').join(', ')}). Gib deine fünfstellige PLZ ein.</p>`
        : '<p class="pro-caption">Dieser Ortsname wurde im Ortsverzeichnis nicht gefunden. Versuch es mit der fünfstelligen PLZ.</p>';
    }
    const period = comparablePeriod(this.range, this.date, this.today);
    const key = regions[0] + '/' + period.date;
    const state = this.regional?.key === key ? this.regional : null;
    const window = periodWindow(period.range, period.date, Date.now(), this.zone);
    const label = safe(window.label + ' · PLZ ' + regions[0] + 'xxx');
    const caption = `<p class="pro-caption">${label}</p>`;
    if (state?.error) {
      return caption + `<p class="pro-caption">${safe(state.error)} <a href="${safe(regionURL(regions[0], period.year))}" target="_blank" rel="noopener noreferrer">SFV-Auswertung öffnen</a></p>`;
    }
    if (!state?.result) return caption + '<p class="pro-caption">Lade den Regionalwert vom SFV …</p>';
    const { result } = state;
    const own = state.own;
    const ownLabel = this.context.config.demo ? 'Eigene Anlage (Beispieldaten)' : 'Eigene Anlage';
    const rows = [[ownLabel, own, 'gold'], ['SFV-Regionaldurchschnitt', result.specific, 'mint']];
    const max = Math.max(0, own ?? 0, result.specific ?? 0);
    return caption + rows.map(([name, value, color]) =>
      `<div class="pro-benchmark"><span>${name}</span><strong>${fmt(value, 'kWh/kWp')}</strong>
      <div><i class="${color}" style="width:${max ? (100 * (value ?? 0) / max).toFixed(2) : 0}%"></i></div></div>`).join('')
      + `<p class="pro-caption">${result.plants === null ? '' : fmt(result.plants) + ' meldende Anlagen · '}
        ${result.specific === null ? 'Für diesen Zeitraum liegt kein Regionalwert vor. ' : ''}
        ${own === null ? 'Eigener Ertrag oder installierte Leistung für diesen Zeitraum fehlt. ' : ''}
        <a href="${safe(result.url)}" target="_blank" rel="noopener noreferrer">Veröffentlichte SFV-Auswertung</a></p>`;
  }

  async refreshRegion() {
    const target = () => this.shadowRoot.querySelector('[data-region-result]');
    if (!target()) return;
    const regions = regionCandidates(this.regionPlace);
    if (regions.length !== 1) {
      this.regionalRequest?.abort();
      this.regional = null;
      return;
    }
    const period = comparablePeriod(this.range, this.date, this.today);
    const window = periodWindow(period.range, period.date, Date.now(), this.zone);
    const key = regions[0] + '/' + period.date;
    if (this.regional?.key === key) {
      if (this.report?.window.start === window.start && this.report.window.end === window.end && this.regional.result) {
        this.regional.own = this.ownSpecific(this.report);
        target().innerHTML = this.regionContent();
      }
      return;
    }
    this.regionalRequest?.abort();
    const request = new AbortController();
    this.regionalRequest = request;
    const state = { key, result: null, own: null, error: '' };
    this.regional = state;
    target().innerHTML = this.regionContent();
    const timeout = setTimeout(() => request.abort('timeout'), 9000);
    try {
      let result = this.regionCache.get(key);
      if (!result) {
        result = await loadSfvRegion(regions[0], period, request.signal);
        if (this.regional !== state) return;
        if (this.regionCache.size >= 12) this.regionCache.delete(this.regionCache.keys().next().value);
        this.regionCache.set(key, result);
      }
      state.result = result;
      const current = this.report?.window.start === window.start && this.report.window.end === window.end;
      if (current) state.own = this.ownSpecific(this.report);
      const viewing = this.window?.start === window.start && this.window.end === window.end;
      if (!current && !viewing && (this.hass || this.context.config.demo)) {
        const report = await energyReport(this.hass, this.context.config,
          { ...window, priorEnd: window.priorStart }, period.range).catch(() => null);
        state.own = this.ownSpecific(report);
      }
    } catch (error) {
      state.error = request.signal.reason === 'timeout' ? 'Der SFV hat nicht rechtzeitig geantwortet.'
        : error instanceof Error ? error.message : 'Der Regionalwert konnte nicht geladen werden.';
    } finally {
      clearTimeout(timeout);
      if (this.regional === state && target()) target().innerHTML = this.regionContent();
    }
  }

  ownSpecific(report) {
    const own = report?.totals.solar;
    const capacity = this.context.config.capacity_kwp;
    return own != null && capacity ? own / capacity : null;
  }

  reportView() {
    const dateType = this.range === 'year' ? 'number' : this.range === 'day' ? 'date' : 'month';
    const dateValue = this.date || (this.range === 'day' ? this.today : this.range === 'month' ? this.today.slice(0, 7) : this.today.slice(0, 4));
    const max = this.range === 'day' ? this.today : this.range === 'month' ? this.today.slice(0, 7) : this.today.slice(0, 4);
    const date = input('Zeitraum', 'reportDate', dateValue,
      `type="${dateType}" data-period="date" max="${max}" ${this.range === 'year' ? 'min="2000" step="1"' : ''}`);
    return `<div class="pro-tools"><label>Auflösung<select aria-label="Auflösung" data-period="range">${Object.entries(RANGES).map(([key, label]) =>
      `<option value="${key}" ${key === this.range ? 'selected' : ''}>${label}</option>`).join('')}</select></label>${date}
      <button type="button" data-pro-action="refresh">Aktualisieren</button>
      <button type="button" data-pro-action="print" ${this.report ? '' : 'disabled'}>Drucken / PDF</button>
    </div>
    ${this.window ? `<p class="pro-caption">${safe(this.window.label)} · bis ${stamp(this.window.end, this.zone)} · Vergleich ${safe(this.window.priorLabel)}</p>` : ''}
    ${this.loading ? '<p class="pro-empty" role="status">Lade Zählerstatistik …</p>' : ''}
    ${this.error ? `<p class="pro-empty" role="status">${safe(this.error)}</p>` : ''}
    ${this.report ? reportContent(this.report, this.settings, this.settings.balance, this.context.config.capacity_kwp) : ''}
    ${this.regionalView()}
    ${this.settings.reference?.key === this.windowKey ? benchmark(this.report, this.settings.reference, this.context.config.capacity_kwp, this.windowKey) : ''}
    <p class="pro-caption" data-print-status role="status"></p>`;
  }

  settingsView() {
    const { settings: s } = this;
    const reference = s.reference?.key === this.windowKey ? s.reference : {};
    const arrays = Array.from({ length: 4 }, (_, i) => {
      const area = s.arrays[i] ?? {};
      return `<details class="array-row" ${area.name || i === 0 ? 'open' : ''}><summary>${safe(area.name || `Modulfläche ${i + 1}`)}</summary><div class="pro-fields">${input(`Name Fläche ${i + 1}`, 'name' + i, area.name, 'maxlength="70"')}
        ${numberInput('Ausrichtung in °', 'az' + i, area.az)}
        ${numberInput('Neigung in °', 'tilt' + i, area.tilt)}
        ${numberInput('Anzahl Module', 'count' + i, area.count)}</div></details>`;
    });
    return `<form class="pro-form">
      <fieldset><legend>Strompreise und Eigenverbrauch</legend><div class="pro-fields">
        ${numberInput('Strompreis in ct/kWh', 'buy', s.buy)}${numberInput('Einspeisevergütung in ct/kWh', 'sell', s.sell)}</div>
        <label class="check"><input type="checkbox" name="balance" ${s.balance ? 'checked' : ''}>Eigenverbrauch aus Ertrag minus Einspeisung schätzen</label>
        <p class="pro-caption">Aktiviere die Schätzung nur für eine passende Bilanz ohne Speicher und ohne weitere einspeisende Quellen. Ein konfigurierter Eigenverbrauchszähler hat Vorrang.</p>
      </fieldset>
      <fieldset><legend>Standort und Modulflächen</legend><div class="pro-fields">
        ${input('Ortsname', 'place', s.place, 'maxlength="70"')}${numberInput('Breitengrad', 'lat', s.lat)}${numberInput('Längengrad', 'lon', s.lon)}</div>
        <p class="pro-caption">Leere Koordinaten verwenden den HA-Standort, falls verfügbar. Ausrichtung 0° Nord, 90° Ost, 180° Süd, 270° West. Neigung 0° flach.</p>
        ${arrays.join('')}
      </fieldset>
      <fieldset><legend>Wallbox und Wetter</legend><div class="pro-fields">
        ${numberInput('Mindestladeleistung in kW', 'minimum', s.minimum)}</div>
        <p class="pro-caption">Typisch ab ca. 1,4 kW einphasig oder 4,1 kW dreiphasig bei 6 A. Die Angaben deiner Wallbox und deines Autos gelten.</p>
        <label class="check"><input type="checkbox" name="snow" ${s.snow ? 'checked' : ''}>Schnee auf den Modulen beobachtet</label>
      </fieldset>
      <fieldset><legend>Vergleichsanlage für ${safe(this.window?.label)}</legend><div class="pro-fields">
        ${input('Name der Vergleichsanlage', 'refName', reference.name, 'maxlength="70"')}
        <label>Quelle<select name="refSource" aria-label="Quelle">${Object.entries(REFERENCE_SOURCES).map(([key, label]) =>
          `<option value="${key}" ${key === reference.sourceKey ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        ${numberInput('Installierte Leistung in kWp', 'refKwp', reference.kwp)}
        ${numberInput('Ertrag im gewählten Zeitraum in kWh', 'refKwh', reference.kwh)}
        ${numberInput('Alternativ Ertrag in kWh/kWp', 'refSpecific', reference.specific)}</div>
        <p class="pro-caption">${this.window ? 'Zeitraum ' + stamp(this.window.start, this.zone) + ' bis ' + stamp(this.window.end, this.zone) + '.' : ''} Die Eingabe wird im Browser gespeichert.</p>
      </fieldset>
      <div class="pro-actions"><button type="submit">Speichern</button><span class="pro-caption" data-settings-status role="status"></span></div>
    </form>`;
  }

  location() {
    const config = this.hass?.config;
    const lat = this.settings.lat ?? decimal(config?.latitude, -90, 90);
    const lon = this.settings.lon ?? decimal(config?.longitude, -180, 180);
    return lat === null || lon === null ? null : { lat, lon };
  }

  sunView() {
    const location = this.location();
    const day = this.sunDate || this.today;
    if (!location) {
      this.sun = [];
      this.sunBest = [];
      this.favorableTimes = [];
      return '<p class="pro-empty">Für den Sonnenstand bitte die Koordinaten unter Einstellungen eintragen.</p>' + this.adviceView();
    }
    const arrays = this.settings.arrays;
    this.sun = sunPath(day, Date.now(), this.zone, location, arrays);
    const n = this.sun.length - 1;
    const daylight = this.sun.map((point, index) => ({ point, index })).filter(p => p.point.altitude >= 0);
    this.sunBest = arrays.map((_, j) => daylight.reduce((best, { point }) =>
      point.angles[j] < 90 && (!best || point.angles[j] < best.angles[j]) ? point : best, null));
    const favorableGroups = [];
    for (const { point } of daylight) {
      if (point.altitude < 15 || !point.angles.some(angle => angle <= 45)) continue;
      const group = favorableGroups.at(-1);
      if (!group || point.time - group.at(-1).time > 15 * 60000) favorableGroups.push([point]);
      else group.push(point);
    }
    this.favorableTimes = favorableGroups.filter(group => group.length > 1)
      .map(group => timeText(group[0].time, this.zone) + '–' + timeText(group.at(-1).time, this.zone));
    this.sunStart = daylight[0]?.index ?? 0;
    this.sunEnd = daylight.at(-1)?.index ?? n;
    const points = daylight.map(({ point, index }) => `${this.sunX(index)},${this.sunY(point.altitude)}`).join(' ');
    const count = arrays.reduce((total, field) => total + (field.count || 0), 0);
    const completeCount = arrays.length && arrays.every(field => field.count);
    return `<div class="pro-tools">${input('Sonnentag', 'sunDate', day, 'type="date" data-sun-date min="2000-01-01" max="2099-12-31"')}</div>
      <div class="sun-grid">
        <section class="pro-box"><h3>Sonnenbahn${this.settings.place ? ' · ' + safe(this.settings.place) : ''}</h3>
          <figure class="sky" aria-label="Sonnenhöhe über dem Horizont">
            <svg viewBox="0 0 600 210" aria-hidden="true"><path class="sky-grid" d="M20 35H580 M20 85H580 M20 135H580 M20 185H580"/>
            <polyline class="sky-track" points="${points}"></polyline><circle class="sky-sun" data-sun-dot r="10" cx="20" cy="185"></circle></svg>
            <figcaption class="sky-time"><span>Tagesbeginn</span><span>Tagesende</span></figcaption>
          </figure>
          <div class="sun-slider"><button type="button" data-pro-action="play" ${daylight.length ? '' : 'disabled'}>Abspielen</button>
            <input type="range" aria-label="Uhrzeit der Sonne" data-sun-time min="0" max="${n}" value="0"><output class="sun-time"></output></div>
          <p class="sun-stats"></p><p class="sun-plot-title">Sonnenhöhe über den ausgewählten Tag in Ortszeit</p>
        </section>
        <section class="pro-box"><h3>Modulflächen${completeCount ? ' · ' + fmt(count, 'Module') : ''}</h3>
          <div class="compass" aria-hidden="true"><b>N</b><b>O</b><b>S</b><b>W</b>
            ${arrays.map(field => `<i class="needle panel-az" style="--direction:${field.az}deg"></i>`).join('')}
            <i class="needle" data-sun-needle></i></div>
          <p class="compass-key">Gold Sonne · Türkis Ausrichtung der Module</p>
          <div data-array-results></div>
          ${arrays.length ? '' : '<p class="pro-caption">Modulflächen lassen sich unter Einstellungen eintragen.</p>'}
        </section>
      </div>${this.adviceView()}`;
  }

  sunX(index) { return (20 + 560 * index / Math.max(1, this.sun.length - 1)).toFixed(1); }
  sunY(altitude) { return (185 - Math.max(0, altitude) * 150 / 90).toFixed(1); }

  drawSun(index) {
    if (!this.sun?.length || !this.shadowRoot.querySelector('[data-sun-dot]')) return;
    const i = Math.max(0, Math.min(index, this.sun.length - 1));
    const point = this.sun[i];
    this.sunIndex = i;
    this.shadowRoot.querySelector('[data-sun-time]').value = String(i);
    this.shadowRoot.querySelector('.sun-time').textContent = timeText(point.time, this.zone);
    const dot = this.shadowRoot.querySelector('[data-sun-dot]');
    dot.setAttribute('cx', this.sunX(i));
    dot.setAttribute('cy', this.sunY(point.altitude));
    dot.style.visibility = point.altitude >= 0 ? '' : 'hidden';
    const needle = this.shadowRoot.querySelector('[data-sun-needle]');
    needle.style.setProperty('--direction', point.azimuth.toFixed(1) + 'deg');
    needle.style.visibility = point.altitude >= 0 ? '' : 'hidden';
    this.shadowRoot.querySelector('.sun-stats').textContent = point.altitude >= 0
      ? `Höhe ${angular(point.altitude, '°')} · Richtung ${angular(point.azimuth, '°')}` : 'Sonne unter dem Horizont';
    this.shadowRoot.querySelector('[data-array-results]').innerHTML = this.settings.arrays.map((area, j) => {
      const visible = point.altitude >= 0;
      const angle = point.angles[j];
      const hit = visible ? angle < 90 ? angular(angle, '°') + ' Einfall' : 'Rückseite' : '—';
      const best = this.sunBest[j];
      return `<div class="array-result"><strong>${safe(area.name)}</strong><span>${hit}</span>
        <small>${fmt(area.az, '°')} Richtung · ${fmt(area.tilt, '°')} Neigung${area.count ? ' · ' + area.count + ' Module' : ''}</small>
        <small>${best ? 'Günstigster Einfall ' + angular(best.angles[j], '°') + ' um ' + timeText(best.time, this.zone) : 'Kein direkter Einfall am gewählten Tag'}</small></div>`;
    }).join('');
    this.drawAdvice();
  }

  play() {
    if (this.animation) {
      this.stopAnimation();
      return;
    }
    if (this.sunStart >= this.sunEnd) return;
    if (this.sunIndex < this.sunStart || this.sunIndex >= this.sunEnd) this.drawSun(this.sunStart);
    const button = this.shadowRoot.querySelector('[data-pro-action="play"]');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.drawSun(Math.min(this.sunEnd, this.sunIndex + 1));
      return;
    }
    button.textContent = 'Pause';
    this.animation = setInterval(() => {
      this.drawSun(this.sunIndex + 1);
      if (this.sunIndex >= this.sunEnd) this.stopAnimation();
    }, 180);
  }

  stopAnimation() {
    clearInterval(this.animation);
    this.animation = null;
    const button = this.shadowRoot.querySelector('[data-pro-action="play"]');
    if (button) button.textContent = 'Abspielen';
  }

  adviceView() {
    return `<div class="pro-hints">
      <section class="pro-box"><h3>Wallbox und PV-Überschuss</h3><p data-charge-advice></p>
        <p data-geometry-advice></p><a href="https://docs.evcc.io/en/docs/features/solar-charging/" target="_blank" rel="noopener noreferrer">Mindestladeleistung und Phasen</a></section>
      <section class="pro-box"><h3>Schnee und Verschattung</h3><p>${this.settings.snow ? 'Schnee wurde für diese Anlage markiert. Eine sonnige Prognose kann den Ertrag überschätzen.' : 'Schnee auf den Modulen kann die Leistung stark senken. Prüfe bei unerwartet wenig Ertrag auch Schatten, Bewölkung und den Wechselrichter.'}</p>
        <p>Schnee möglichst abrutschen oder abtauen lassen. Für Arbeiten am Dach einen Fachbetrieb fragen.</p>
        <p>0° Einfall bedeutet senkrechtes Licht auf das Modul. Verschattung, Wetter und Reflexion beeinflussen den tatsächlichen Ertrag.</p></section></div>`;
  }

  drawAdvice() {
    const target = this.shadowRoot.querySelector('[data-charge-advice]');
    if (!target) return;
    const grid = this.context.data?.grid?.value;
    const minimum = this.settings.minimum;
    const charging = this.context.data?.ev?.value;
    const surplus = Number.isFinite(grid) ? Math.max(0, -grid) / 1000 : null;
    target.textContent = surplus === null ? 'Aktueller Netzfluss fehlt. Ein Ladehinweis braucht einen frischen Netzzähler.'
      : charging > 200 ? `Die Wallbox zieht aktuell ${fmt(charging / 1000, 'kW')}. Zusätzlich gehen ${fmt(surplus, 'kW')} ins Netz.`
      : minimum === null ? `Aktuell ${fmt(surplus, 'kW')} Überschuss. Trage die Mindestladeleistung in den Einstellungen ein.`
      : surplus >= minimum ? `Aktuell ${fmt(surplus, 'kW')} Überschuss. Das reicht momentan für die eingestellten ${fmt(minimum, 'kW')}, solange der Überschuss anhält.`
      : `Aktuell ${fmt(surplus, 'kW')} Überschuss. Für reines PV-Laden sind mindestens ${fmt(minimum, 'kW')} nötig.`;
    const spans = this.favorableTimes ?? [];
    this.shadowRoot.querySelector('[data-geometry-advice]').textContent = spans.length
      ? 'Günstiger Sonnenwinkel am gewählten Tag etwa ' + spans.join(', ') + '. Ob Laden möglich ist, hängt auch von Wetter und Hauslast ab.'
      : 'Eine geometrisch günstige Zeit erscheint bei hinterlegten Modulflächen und passendem Sonnenstand.';
  }

  print() {
    if (!this.report) return;
    const target = window.open('', '_blank');
    const status = this.shadowRoot.querySelector('[data-print-status]');
    if (!target) {
      status.textContent = 'Bitte erlaube das Öffnen des Druckfensters im Browser.';
      return;
    }
    target.opener = null;
    const { config } = this.context;
    const windowLabel = stamp(this.window.start, this.zone) + ' bis ' + stamp(this.window.end, this.zone);
    target.document.open();
    target.document.write(`<!doctype html><html lang="de"><meta charset="utf-8"><title>OLED Solar · PV-Bericht</title><style>${printStyles}</style>
      <body><h1>${safe(config.title)} · PV-Bericht</h1><p>${safe(config.subtitle)} · ${safe(this.window.label)} · ${windowLabel}</p>
      <button id="print" type="button">Drucken oder als PDF speichern</button>
      ${reportContent(this.report, this.settings, this.settings.balance, config.capacity_kwp)}
      ${this.regional?.result && regionCandidates(this.regionPlace).length === 1
        ? `<section class="pro-box pro-near"><h3>Ertragsvergleich nach PLZ-Region</h3>${this.regionContent()}</section>` : ''}
      ${this.settings.reference?.key === this.windowKey ? benchmark(this.report, this.settings.reference, config.capacity_kwp, this.windowKey) : ''}
      </body></html>`);
    target.document.close();
    target.document.querySelector('#print').addEventListener('click', () => target.print());
  }

  render() {
    if (!this.settings) return;
    const title = { report: 'Ertrag und Wirtschaftlichkeit', sun: 'Sonnenstand und Ausrichtung', settings: 'Anlage und Tarife' }[this.section];
    this.shadowRoot.innerHTML = `<style>${proStyles}</style><div class="pro">
      <div class="pro-head"><h2>${title}</h2><div class="pro-nav" role="group" aria-label="Pro-Ansicht">
        ${Object.entries(SECTIONS).map(([key, name]) => `<button type="button" data-section="${key}" aria-pressed="${key === this.section}">${name}</button>`).join('')}
      </div></div>
      ${this.section === 'report' ? this.reportView() : this.section === 'sun' ? this.sunView() : this.settingsView()}
    </div>`;
    if (this.section === 'report') void this.refreshRegion();
    if (this.section === 'sun' && this.shadowRoot.querySelector('[data-sun-dot]')) {
      const now = Date.now();
      const actual = this.sun.findIndex(point => point.time >= now);
      this.drawSun(this.sunIndex ?? ((this.sunDate || this.today) === this.today && actual >= 0 ? actual : this.sunStart));
    } else if (this.section === 'sun') this.drawAdvice();
  }
}

if (!customElements.get('oled-solar-pro')) customElements.define('oled-solar-pro', OledSolarPro);
