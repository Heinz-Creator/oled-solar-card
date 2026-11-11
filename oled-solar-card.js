import { deletePhoto, photoSource, preparePhoto, readPhoto, writePhoto } from './solar-photo.js';
import './solar-sky.js';
import './solar-editor.js';
import { normalizeDevices, sensorId } from './solar-editor.js';
import horizon from './motifs/solar-horizon.webp';
import './solar-pro.js';
import { decimal } from './solar-pro-data.js';
import { ART, artwork } from './solar-art.js';
import { SIGNALS, snapshot, format } from './solar-model.js';
import { styles } from './solar-styles.js';

const MOTION = { dots: 'Lichtpunkte', comet: 'Kometen', dash: 'Laufstreifen', off: 'Aus' };
const ART_KEYS = Object.keys(SIGNALS).filter(key => !['grid_import', 'grid_export'].includes(key));
const DAILY_KEYS = ['yield_today', 'house_today', 'import_today', 'export_today'];
const FORECAST_KEYS = ['forecast_today', 'forecast_remaining', 'forecast_tomorrow'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const pick = (map, value, fallback) => Object.hasOwn(map, value) ? value : fallback;
const options = (map, selected) => Object.entries(map).map(([key, label]) =>
  `<option value="${key}"${key === selected ? ' selected' : ''}>${label}</option>`).join('');
const amount = (value, kind) => {
  const [number, unit] = format(value, kind);
  return `${number}${unit ? ` <small>${unit}</small>` : ''}`;
};
const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const sunIcon = icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>');
const adjustIcon = icon('<path d="M4 6h8m4 0h4M4 12h3m4 0h9M4 18h11m4 0h1"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>');
const problem = reading => reading.status === 'stale' ? 'Messwert veraltet' : 'Keine Daten';

class OledSolarCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.view = 'flow';
    this.panel = '';
    this.visible = true;
    this.photoVersion = 0;
    this.shadowRoot.addEventListener('input', event => this.previewPhotoSetting(event));
    this.shadowRoot.addEventListener('error', event => {
      if (event.target.matches?.('.house-scene-image') && event.target.isConnected) {
        this.failedPhoto = event.target.getAttribute('src');
        this.render();
      }
    }, true);
    this.shadowRoot.addEventListener('click', event => this.handleClick(event));
    this.shadowRoot.addEventListener('change', event => this.handleChange(event));
  }

  setConfig(config) {
    const entities = Object.fromEntries(Object.entries(config.entities ?? {}).filter(([key, id]) =>
      Object.hasOwn(SIGNALS, key) && typeof id === 'string' && /^sensor\.[a-z0-9_]+$/.test(id)));
    if (!entities.solar) throw new Error('OLED Solar benötigt unter entities.solar einen Leistungssensor.');
    const firstConfig = !this.config;
    const pro = config.pro ?? {};
    const statistics = config.statistics && Object.fromEntries(['solar', 'import', 'export', 'self_use'].map(key => {
      const values = Array.isArray(config.statistics[key]) ? config.statistics[key] : [config.statistics[key]];
      return [key, [...new Set(values.filter(id => typeof id === 'string' && /^[a-z0-9_.:-]+$/i.test(id)))]];
    }));
    this.config = {
      entities,
      title: config.title || 'OLED Solar',
      subtitle: config.subtitle || '',
      capacity_kwp: Number(config.capacity_kwp) > 0 ? Number(config.capacity_kwp) : null,
      grid_positive: config.grid_positive === 'export' ? 'export' : 'import',
      battery_positive: config.battery_positive === 'discharge' ? 'discharge' : 'charge',
      max_age_minutes: Number(config.max_age_minutes) > 0 ? Number(config.max_age_minutes) : 15,
      demo: config.demo === true,
      demoHour: decimal(config.demo_hour, 0, 23.99),
      layout: config.layout === 'compact' ? 'compact' : 'scene',
      photo: photoSource(config.house_image),
      pvInputs: [...new Set((Array.isArray(config.pv_inputs) ? config.pv_inputs : []).filter(sensorId))].filter(id => id !== entities.solar).slice(0, 7),
      devices: normalizeDevices(config.devices).filter(device => ![...Object.values(entities), ...(Array.isArray(config.pv_inputs) ? config.pv_inputs : [])].includes(device.entity)),
      edition: config.edition === 'pro' ? 'pro' : 'light',
      statistics,
      pro: {
        buy: decimal(pro.buy_ct_kwh, 0, 10000), sell: decimal(pro.feed_in_ct_kwh, -10000, 10000),
        lat: decimal(pro.latitude, -90, 90), lon: decimal(pro.longitude, -180, 180),
        place: typeof pro.place === 'string' ? pro.place : '',
        minimum: decimal(pro.ev_min_kw, .1, 350), snow: pro.snow === true, balance: pro.estimate_self_use === true,
        arrays: (Array.isArray(pro.arrays) ? pro.arrays : []).slice(0, 4).flatMap((field, i) => {
          const az = decimal(field?.azimuth, 0, 360);
          const tilt = decimal(field?.tilt, 0, 90);
          const count = decimal(field?.modules, 1, 2000);
          return az === null || tilt === null ? [] : [{
            name: String(field.name || 'Modulfläche ' + (i + 1)), az: az % 360, tilt,
            count: Number.isInteger(count) ? count : null,
          }];
        }),
      },
      threshold: Number.isFinite(config.threshold_w) && config.threshold_w >= 0 ? config.threshold_w : 15,
    };
    if (this.config.edition === 'light' && this.view === 'pro') this.view = 'flow';
    if (firstConfig && this.config.edition === 'pro' && config.default_view === 'pro') this.view = 'pro';
    const storageKey = 'oled-solar:' + (config.appearance_id ?? entities.solar);
    if (this.storageKey !== storageKey) {
      this.clearPhotoURL();
      this.storageKey = storageKey;
      this.photoLoadedFor = null;
      this.photoStatus = '';
      this.photoBusy = false;
      this.failedPhoto = '';
      this.photoVersion++;
    }
    const defaults = {
      style: pick(ART, config.style, 'pop'), flow: pick(MOTION, config.motion, 'comet'),
      icons: config.icons ?? {},
    };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.storageKey) ?? '{}') ?? {}; } catch {}
    this.appearance = {
      style: pick(ART, saved.style, defaults.style), flow: pick(MOTION, saved.flow, defaults.flow),
      icons: { ...defaults.icons, ...saved.icons },
      photoX: decimal(saved.photoX ?? config.house_image_x, 0, 100) ?? 50,
      photoY: decimal(saved.photoY ?? config.house_image_y, 0, 100) ?? 48,
      photoShade: decimal(saved.photoShade ?? config.house_image_shade, 15, 80) ?? 31,
    };
    this.update(true);
    if (this.isConnected) void this.loadPhoto();
  }

  set hass(value) {
    const firstConnection = !this._hass;
    this._hass = value;
    this.update();
    if (firstConnection && this.view === 'pro' && this.proElement?.isConnected) this.updatePro();
    if (firstConnection && this.skyElement?.isConnected) this.updateSky();
  }

  connectedCallback() {
    if (this.config) void this.loadPhoto();
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.toggleAttribute('data-hidden', !this.visible);
      if (this.visible) this.update();
      else this.skyElement?.stop();
    });
    this.visibility.observe(this);
    this.timer = setInterval(() => this.update(), 30000);
  }

  disconnectedCallback() {
    this.visibility?.disconnect();
    clearInterval(this.timer);
    this.photoVersion++;
    this.photoBusy = false;
    this.photoLoadedFor = null;
    this.clearPhotoURL();
  }

  static getConfigElement() { return document.createElement('oled-solar-card-editor'); }
  static getStubConfig(hass, entities = [], fallback = []) {
    const state = id => hass?.states?.[id];
    const candidate = [...entities, ...fallback].find(id => sensorId(id)
      && ['W', 'kW', 'MW'].includes(state(id)?.attributes?.unit_of_measurement)
      && /solar|photovoltaik|(?:^|[_.])pv(?:[_.]|$)/i.test(id));
    return { edition: 'pro', entities: { solar: candidate ?? 'sensor.pv_power' } };
  }
  getCardSize() { return 9; }
  getGridOptions() { return { columns: 'full', rows: 'auto', min_columns: 6 }; }

  update(force = false) {
    if (!this.config || (!force && !this.visible)) return;
    const data = snapshot(this._hass, this.config);
    const signature = JSON.stringify(data);
    if (!force && signature === this.signature) {
      if (this.skyElement?.isConnected) this.updateSky();
      return;
    }
    this.signature = signature;
    this.data = data;
    if (!force && this.view === 'pro' && this.proElement?.isConnected) this.updatePro();
    else this.render();
  }

  updatePro() {
    this.proElement.setContext({
      hass: this._hass, data: this.data, config: this.config,
      key: this.storageKey + (this.config.demo ? ':' + this.config.subtitle : ''),
    });
  }

  art(kind, key, active) {
    const style = pick(ART, this.appearance.icons[key], this.appearance.style);
    return artwork(kind, style, active);
  }

  handleClick(event) {
    const { view, panel, source, photoAction } = event.target.closest('button')?.dataset ?? {};
    if (view) this.view = view;
    if (panel) this.panel = this.panel === panel ? '' : panel;
    if (view || panel) this.render();
    if (panel === 'photo' && this.panel === 'photo') this.shadowRoot.querySelector('[data-photo-file]')?.focus();
    if (photoAction === 'remove') void this.removePhoto();
    if (photoAction === 'retry') {
      this.failedPhoto = '';
      this.render();
    }
    if (source && this.config.demo) {
      this.panel = 'sources';
      this.render();
      this.shadowRoot.querySelector('#solar-sources')?.scrollIntoView({ block: 'nearest' });
    }
    if (source && !this.config.demo) this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId: source }, bubbles: true, composed: true,
    }));
  }

  handleChange(event) {
    if (event.target.matches('[data-photo-file]')) {
      const [file] = event.target.files;
      if (file) void this.choosePhoto(file);
      return;
    }
    if (event.target.matches('[data-photo-setting]')) {
      this.previewPhotoSetting(event);
      this.saveAppearance();
      return;
    }
    const field = event.target.dataset.appearance;
    if (!field) return;
    const value = event.target.value;
    if (field === 'style') this.appearance.style = value;
    else if (field === 'flow') this.appearance.flow = value;
    else if (value) this.appearance.icons[field] = value;
    else delete this.appearance.icons[field];
    this.saveAppearance();
    this.render();
  }

  saveAppearance() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.appearance)); } catch {}
  }

  clearPhotoURL() {
    if (this.localPhoto) URL.revokeObjectURL(this.localPhoto);
    this.localPhoto = null;
  }

  async loadPhoto() {
    const key = this.storageKey;
    if (this.photoLoadedFor === key) return;
    this.photoLoadedFor = key;
    const version = this.photoVersion;
    try {
      const file = await readPhoto(key);
      if (file instanceof Blob && version === this.photoVersion && this.isConnected) {
        this.localPhoto = URL.createObjectURL(file);
        this.photoTemporary = false;
        if (this.view === 'flow') this.render();
      }
    } catch {}
  }

  async choosePhoto(file) {
    const key = this.storageKey;
    const version = ++this.photoVersion;
    this.photoBusy = true;
    this.photoStatus = 'Foto wird vorbereitet …';
    this.render();
    try {
      const photo = await preparePhoto(file);
      if (version !== this.photoVersion) return;
      try {
        await writePhoto(key, photo);
        if (version === this.photoVersion) {
          this.photoStatus = 'Hausfoto auf diesem Gerät gespeichert.';
          this.photoTemporary = false;
        }
      } catch {
        if (version === this.photoVersion) {
          this.photoStatus = 'Hausfoto ist für diese Sitzung verfügbar.';
          this.photoTemporary = true;
        }
      }
      if (version !== this.photoVersion) return;
      this.clearPhotoURL();
      this.localPhoto = URL.createObjectURL(photo);
      this.failedPhoto = '';
    } catch (error) {
      if (version === this.photoVersion) this.photoStatus = error.message;
    } finally {
      if (version === this.photoVersion) {
        this.photoBusy = false;
        this.render();
      }
    }
  }

  async removePhoto() {
    const version = ++this.photoVersion;
    this.photoBusy = true;
    this.render();
    try {
      if (!this.photoTemporary) await deletePhoto(this.storageKey);
      if (version !== this.photoVersion) return;
      this.clearPhotoURL();
      this.photoStatus = 'Lokales Hausfoto entfernt.';
    } catch {
      if (version !== this.photoVersion) return;
      this.photoStatus = 'Das Foto konnte nicht aus dem Browserspeicher entfernt werden.';
    } finally {
      if (version === this.photoVersion) {
        this.photoBusy = false;
        this.render();
      }
    }
  }

  previewPhotoSetting(event) {
    const field = event.target.dataset.photoSetting;
    if (!field) return;
    const value = Number(event.target.value);
    this.appearance[field] = value;
    for (const picture of this.shadowRoot.querySelectorAll('.board[data-photo="true"], .house-photo-preview')) {
      picture.style.setProperty('--house-x', this.appearance.photoX + '%');
      picture.style.setProperty('--house-y', this.appearance.photoY + '%');
      picture.style.setProperty('--house-shade', String(this.appearance.photoShade / 100));
    }
    event.target.closest('label').querySelector('output').textContent = value + ' %';
  }

  photoPanel() {
    const photo = this.scenePhoto;
    const slider = (name, key, min, max) => `<label><span>${name} <output aria-hidden="true">${this.appearance[key]} %</output></span>
      <input type="range" aria-label="${name}" data-photo-setting="${key}" min="${min}" max="${max}" value="${this.appearance[key]}"></label>`;
    const failed = this.config.photo && this.failedPhoto === this.config.photo && !this.localPhoto;
    const status = failed
      ? 'Das hinterlegte Hausfoto konnte nicht geladen werden. Prüfe die Adresse im Karteneditor.'
      : this.photoStatus;
    return `<section class="settings house-settings" id="solar-house-photo" ${this.panel === 'photo' ? '' : 'hidden'}>
      <h3>Hausfoto</h3><div class="house-upload"><label>Eigenes Foto auswählen
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-photo-file ${this.photoBusy ? 'disabled' : ''}></label>
      ${this.localPhoto ? '<button class="tool" type="button" data-photo-action="remove" ' + (this.photoBusy ? 'disabled' : '') + '>Lokales Foto entfernen</button>' : ''}</div>
      <p>Das ausgewählte Foto bleibt in diesem Browser. Eine Bildadresse im Home-Assistant-Karteneditor gilt für alle Geräte.</p>
      <div class="house-frame-editor">${photo ? `<div class="house-photo-preview" ${this.photoFraming()}>
        <div class="house-scene-picture"><img class="house-scene-image" src="${escape(photo)}" alt="" referrerpolicy="no-referrer"></div></div>` : ''}
        <div class="house-sliders">${slider('Ausschnitt horizontal', 'photoX', 0, 100)}
          ${slider('Ausschnitt vertikal', 'photoY', 0, 100)}${slider('Abdunklung', 'photoShade', 15, 80)}</div></div>
      <p class="house-photo-status" role="status">${escape(status)}</p>
      ${failed ? '<button class="tool" type="button" data-photo-action="retry">Foto erneut laden</button>' : ''}</section>`;
  }

  get scenePhoto() {
    if (!this.scene) return '';
    return [this.localPhoto, this.config.photo]
      .find(src => src && src !== this.failedPhoto) || '';
  }

  photoFraming() {
    return `style="--house-x:${this.appearance.photoX}%;--house-y:${this.appearance.photoY}%;--house-shade:${this.appearance.photoShade / 100}"`;
  }

  active(reading) { return reading.value !== null && Math.abs(reading.value) > this.config.threshold; }

  node(kind, key, name, reading, x, y, sub = '', secondary = '', source = reading?.id) {
    const state = reading?.value === null ? reading.status : reading && !this.active(reading) ? 'idle' : 'ok';
    const color = kind === 'inverter' ? 'neutral' : kind;
    const tag = source ? 'button' : 'div';
    const action = source ? `type="button" data-source="${escape(source)}" title="Messwert öffnen"` : '';
    return `<${tag} ${action} class="node node--${kind}" data-status="${state}" style="--x:${x}%;--y:${y}%;--accent:var(--${color})">
      ${this.art(kind, key, reading ? this.active(reading) : this.active(this.data.solar))}
      <span class="node-caption"><span class="name">${name}</span>
      ${reading ? `<span class="readout"><strong>${amount(reading.value)}</strong></span>` : ''}
      ${reading?.value === null ? `<span class="sub">${problem(reading)}</span>` : sub ? `<span class="sub">${sub}</span>` : ''}${secondary}</span>
    </${tag}>`;
  }

  wire(path, color, reading, reverse = false) {
    const base = `<path class="wire" d="${path}"/>`;
    if (!this.active(reading)) return base;
    const speed = (5.4 - Math.min(3.9, Math.sqrt(Math.abs(reading.value) / 350))).toFixed(2);
    const width = (1.4 + Math.min(3.9, Math.sqrt(Math.abs(reading.value) / 800))).toFixed(2);
    return `${base}<g style="--wire:var(--${color});--speed:${speed}s;--width:${width};--direction:${reverse ? 'reverse' : 'normal'}">
      <path class="wire-live" d="${path}"/><path class="runner" pathLength="100" d="${path}"/></g>`;
  }

  board() {
    const { solar, grid, house, battery, ev, soc } = this.data;
    const batteryShown = Boolean(this.config.entities.battery || this.config.entities.battery_soc);
    const evShown = ev.status !== 'unset';
    const extra = batteryShown || evShown;
    const photo = this.scenePhoto;
    const center = extra ? 49 : 66;
    const solarY = this.scene ? (extra ? 19 : 25) : (extra ? 17 : 21);
    const extraY = this.scene ? 80 : 82;
    const y = center * 10 - 35;
    const gridShown = grid.status !== 'unset';
    const houseShown = house.status !== 'unset';
    const gridLabel = grid.value === null ? 'Stromnetz' : grid.value < 0 ? 'Einspeisung' : grid.value > 0 ? 'Netzbezug' : 'Stromnetz';
    const batteryLabel = battery.value < 0 ? 'Entlädt' : battery.value > 0 ? 'Lädt' : '';
    const socText = soc.value !== null ? format(soc.value, 'percent').join(' ') : '';
    const socOnly = battery.status === 'unset';
    const socReading = soc.status === 'unset' ? '' : `<span class="sub soc" aria-label="Ladezustand ${socText || problem(soc)}">
      ${this.art('battery', 'battery_soc', false)}${socText || problem(soc)}</span>`;
    const framing = photo ? this.photoFraming() : '';
    return `<div class="board" data-photo="${Boolean(photo)}" ${framing} data-extra="${extra}" data-flow="${this.appearance.flow}" data-solar="${this.active(solar) ? 'on' : 'off'}" role="group" aria-label="Stromfluss der Anlage">
      ${photo ? `<div class="house-scene-picture"><img class="house-scene-image" src="${escape(photo)}" alt="" referrerpolicy="no-referrer"></div>` : ''}
      ${this.scene ? `<button class="scene-photo-button" type="button" data-panel="photo" aria-expanded="${this.panel === 'photo'}" aria-controls="solar-house-photo">${this.config.photo && this.failedPhoto === this.config.photo && !this.localPhoto ? 'Foto prüfen' : 'Hausfoto'}</button>` : ''}
      <svg class="wires" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        ${this.wire(`M500 ${extra ? 291 : 358} V${y - 70}`, 'solar', solar)}
        ${gridShown ? this.wire(`M231 ${y} H449`, 'grid', grid, grid.value < 0) : ''}
        ${houseShown ? this.wire(`M551 ${y} H769`, 'home', house) : ''}
        ${batteryShown && !socOnly ? this.wire(`M470 ${y + 123} H421 Q397 ${y + 123} 397 ${y + 163} V711`, 'battery', battery, battery.value < 0) : ''}
        ${evShown && houseShown ? this.wire('M835 589 V718', 'ev', ev) : ''}
      </svg>
      ${this.node('solar', 'solar', 'PV-Module', solar, 50, solarY)}
      ${gridShown ? this.node('grid', 'grid', gridLabel, grid, 16.5, center) : ''}
      ${this.node('inverter', 'inverter', this.scene ? 'Verteilung' : 'Wechselrichter', null, 50, center)}
      ${houseShown ? this.node('home', 'house', 'Hausverbrauch', house, 83.5, center) : ''}
      ${batteryShown ? this.node('battery', socOnly ? 'battery_soc' : 'battery', 'Speicher', socOnly ? null : battery, 39.7, extraY, batteryLabel, socReading) : ''}
      ${evShown ? this.node('ev', 'ev', 'Wallbox', ev, 83.5, extraY) : ''}
    </div>`;
  }

  get scene() { return this.config.edition === 'pro' && this.config.layout === 'scene'; }

  updateSky() {
    const zone = this.config.demo ? 'Europe/Berlin' : this._hass?.config?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    let settings = this.config.pro;
    try {
      const key = this.storageKey + (this.config.demo ? ':' + this.config.subtitle : '') + ':pro';
      settings = { ...settings, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
    } catch {}
    const lat = settings.lat ?? decimal(this._hass?.config?.latitude, -90, 90);
    const lon = settings.lon ?? decimal(this._hass?.config?.longitude, -180, 180);
    const now = this.config.demo && this.config.demoHour !== null
      ? Date.parse('2026-06-21T00:00:00+02:00') + this.config.demoHour * 3600000 : Date.now();
    this.skyElement.configure({ zone, location: lat === null || lon === null ? null : { lat, lon }, now, motion: this.appearance.flow !== 'off' });
  }

  flowView() {
    if (!this.scene) return `<div class="main">${this.lead()}${this.board()}</div>${this.deviceStrip()}`;
    return `<div class="solar-scene">
      <div class="scene-sky" style="--landscape:url('${horizon}')">${this.lead()}<div class="sky-mount"></div></div>
      ${this.board()}${this.powerBalance()}
    </div>${this.deviceStrip()}`;
  }

  powerBalance() {
    const { solar, grid, house, battery, ev } = this.data;
    const list = (reading, value, name, color) => reading.status === 'unset' ? [] : [{ name, value, color }];
    const upstream = [
      ...list(solar, solar.value, 'Solar', 'solar'),
      ...list(grid, grid.value === null ? null : Math.max(0, grid.value), 'Netzbezug', 'grid'),
      ...list(battery, battery.value === null ? null : Math.max(0, -battery.value), 'Speicher entlädt', 'battery'),
    ];
    const downstream = [
      ...list(house, house.value, 'Haus', 'home'),
      ...list(grid, grid.value === null ? null : Math.max(0, -grid.value), 'Einspeisung', 'grid'),
      ...list(battery, battery.value === null ? null : Math.max(0, battery.value), 'Speicher lädt', 'battery'),
    ];
    const active = rows => rows.filter(row => row.value !== null && row.value > 0);
    const total = rows => active(rows).reduce((sum, row) => sum + row.value, 0);
    const peak = Math.max(total(upstream), total(downstream));
    if (peak <= 0) return '';
    const row = (title, rows) => `<div class="scene-balance-row"><span>${title}</span><div class="scene-segments" aria-hidden="true">
      ${active(rows).map(item => `<i style="--segment:var(--${item.color});width:${(item.value / peak * 100).toFixed(3)}%"></i>`).join('')}</div>
      <div class="scene-key">${rows.filter(item => item.value === null || item.value > 0).map(item =>
        `<span style="--segment:var(--${item.color})"><i></i>${item.name} <b>${amount(item.value)}</b></span>`).join('')}</div></div>`;
    const ribbons = (rows, incoming) => {
      const measured = active(rows);
      const gap = 8;
      const spread = total(rows) / peak * 53;
      let outer = (84 - spread - Math.max(0, measured.length - 1) * gap) / 2;
      let inner = (84 - spread) / 2;
      return measured.map(item => {
        const width = item.value / peak * 53;
        const a = (outer + width / 2).toFixed(2);
        const b = (inner + width / 2).toFixed(2);
        outer += width + gap;
        inner += width;
        const route = incoming ? `M3 ${a} C82 ${a} 116 ${b} 191 ${b}`
          : `M209 ${b} C284 ${b} 318 ${a} 397 ${a}`;
        return `<g style="--ribbon:var(--${item.color})">
          <path class="ribbon" d="${route}" stroke-width="${width.toFixed(2)}"/>
          ${width >= 3 ? `<path class="ribbon-shimmer" d="${route}" pathLength="100"/>` : ''}
        </g>`;
      }).join('');
    };
    return `<section class="scene-balance" aria-label="Gemessene Leistungsbilanz">
      ${row('Quellen', upstream)}
      <svg class="scene-ribbons" viewBox="0 0 400 84" aria-hidden="true">
        <path class="ribbon-guide" d="M200 6v72"/>
        ${ribbons(upstream, true)}${ribbons(downstream, false)}
      </svg>
      ${row('Abgänge', downstream)}
      ${ev.status !== 'unset' && house.status !== 'unset' ? '<small>Die Wallbox erscheint separat im Stromfluss. Im Hauswert kann ihre Leistung bereits enthalten sein.</small>' : ''}</section>`;
  }

  deviceStrip() {
    const { pvInputs, devices } = this.data;
    if (pvInputs.length < 2 && !devices.length) return '';
    const cards = [
      ...(pvInputs.length > 1 ? pvInputs.map((reading, i) => ({
        reading, label: this._hass?.states?.[reading.id]?.attributes?.friendly_name ?? 'PV-Eingang ' + (i + 1), art: 'solar', color: 'solar',
      })) : []),
      ...devices.map(device => ({
        reading: device.reading, label: device.label, color: device.kind === 'ev' ? 'ev' : 'home',
        art: device.kind === 'generic' ? 'home' : device.kind,
      })),
    ];
    return `<section class="device-section"><h3>Teilfelder und Geräte</h3><div class="device-strip">${cards.map(({ reading, label, art, color }) =>
      `<button type="button" data-source="${escape(reading.id)}" class="device-meter" data-art="${art}" style="--accent:var(--${color})">
        ${this.art(art, 'device', this.active(reading))}<span><span class="device-name">${escape(label)}</span>
        <strong>${amount(reading.value)}</strong>${reading.value === null ? `<small>${problem(reading)}</small>` : reading.value < 0 ? '<small>Gibt Leistung ab</small>' : ''}</span>
      </button>`).join('')}</div></section>`;
  }

  lead() {
    const { solar, grid } = this.data;
    const state = solar.value === null ? solar.status : this.active(solar) ? 'ok' : 'idle';
    const status = state === 'ok' ? 'PV produziert' : state === 'idle' ? 'PV im Leerlauf' : problem(solar);
    const note = grid.value === null ? '' : grid.value < -this.config.threshold ? 'Überschuss geht ins Netz'
      : grid.value > this.config.threshold ? 'Strombezug aus dem Netz' : 'Kein wesentlicher Netzfluss';
    const capacity = this.config.capacity_kwp;
    const fill = solar.value === null || capacity === null ? null : Math.min(100, solar.value / (capacity * 10));
    return `<div class="lead">
      <span class="kicker" data-state="${state}"><i aria-hidden="true"></i>${status}</span>
      <h3>Solarleistung</h3><div class="big">${amount(solar.value)}</div>
      ${note ? `<p class="lead-note">${note}</p>` : ''}
      ${capacity ? `${fill === null ? '' : `<div class="capacity" aria-hidden="true"><span style="width:${fill}%"></span></div>`}
        <p class="capacity-label">${new Intl.NumberFormat('de-DE').format(capacity)} kWp installierte Modulleistung</p>` : ''}
    </div>`;
  }

  metric(key, max) {
    const reading = this.data.daily[key];
    const kind = key.startsWith('forecast_') ? 'forecast'
      : key === 'house_today' ? 'home' : ['import_today', 'export_today'].includes(key) ? 'grid' : 'yield';
    const color = kind === 'yield' ? 'solar' : kind === 'forecast' ? 'grid' : kind;
    return `<div class="metric" data-kind="${kind}" style="--accent:var(--${color})">
      ${this.art(kind, key, false)}<div><span>${SIGNALS[key]}</span>
      <strong>${amount(reading.value, 'energy')}</strong>
      ${reading.value === null ? `<small>${problem(reading)}</small>` : ''}
      ${max > 0 && reading.value !== null ? `<span class="bar" aria-hidden="true"><i style="width:${reading.value / max * 100}%"></i></span>` : ''}
      </div></div>`;
  }

  overview(keys) {
    return keys.filter(key => this.config.entities[key]);
  }

  balance() {
    const blocks = [['Gemessen heute', DAILY_KEYS], ['Solarprognose', FORECAST_KEYS]];
    const sections = blocks.map(([name, keys]) => {
      const configured = this.overview(keys);
      if (!configured.length) return '';
      const max = Math.max(0, ...configured.map(key => this.data.daily[key].value ?? 0));
      return `<section><h3>${name}</h3>${configured.map(key => this.metric(key, max)).join('')}</section>`;
    }).join('');
    return `<div class="balance">${sections || '<section><h3>Tageswerte</h3><p>Hier erscheinen konfigurierte Energie- und Prognosesensoren.</p></section>'}</div>`;
  }

  settings() {
    const select = (label, field, map, value) => `<label>${label}<select aria-label="${label}" data-appearance="${field}">${options(map, value)}</select></label>`;
    const ids = this.config.entities;
    const shown = ART_KEYS.filter(key => ids[key] || key === 'inverter' || (key === 'grid' && (ids.grid_import || ids.grid_export)));
    return `<section class="settings" id="solar-appearance" ${this.panel === 'appearance' ? '' : 'hidden'}><h3>Darstellung</h3>
      <div class="settings-grid settings-main">
        ${select('Grafikstil', 'style', ART, this.appearance.style)}
        ${select('Animation', 'flow', MOTION, this.appearance.flow)}
      </div><div class="settings-grid">
        ${shown.map(key => select(SIGNALS[key], key, { '': 'Wie Grafikstil', ...ART }, pick(ART, this.appearance.icons[key], ''))).join('')}
      </div></section>`;
  }

  sources() {
    const entries = [
      ...Object.entries(this.config.entities).map(([key, id]) => [SIGNALS[key], id]),
      ...this.config.pvInputs.map((id, index) => ['PV-Eingang ' + (index + 2), id]),
      ...this.data.devices.map(device => [device.label, device.entity]),
    ];
    const rows = entries.map(([label, id]) => {
      const state = this._hass?.states?.[id];
      const raw = state && !['unknown', 'unavailable'].includes(state.state)
        ? `${state.state} ${state.attributes?.unit_of_measurement ?? ''}` : 'Keine Daten';
      const at = Date.parse(state?.last_reported || state?.last_updated || '');
      const time = Number.isFinite(at) ? new Intl.DateTimeFormat('de-DE', {
        timeStyle: 'short', dateStyle: 'short', timeZone: this._hass?.config?.time_zone,
      }).format(at) : '';
      return `<li><div><strong>${escape(label)}</strong><br><code>${escape(id)}</code></div>
        <span>${escape(raw)} ${time ? `· ${escape(time)}` : ''}</span>
        ${this.config.demo || !state ? '' : `<button type="button" data-source="${escape(id)}">Sensor öffnen</button>`}</li>`;
    }).join('');
    return `<section class="sources" id="solar-sources" ${this.panel === 'sources' ? '' : 'hidden'}><h3>Datenquellen</h3><ul>${rows}</ul></section>`;
  }

  render() {
    const old = this.shadowRoot.activeElement?.dataset ?? {};
    const keys = this.overview(['yield_today', 'forecast_today', 'forecast_remaining', 'forecast_tomorrow']);
    const pressed = name => this.view === name ? 'true' : 'false';
    const badge = this.config.demo ? 'Simulation' : 'Home Assistant';
    this.dataset.motion = this.appearance.flow;
    this.shadowRoot.innerHTML = `<style>${styles}</style><ha-card>
      <header>
        <div class="brand"><span class="brand-mark">${sunIcon}</span><div><h2>${escape(this.config.title)}</h2>
          ${this.config.subtitle ? `<p>${escape(this.config.subtitle)}</p>` : ''}</div></div>
        <div class="controls">
          <div class="tabs" role="group" aria-label="Ansicht">
            <button type="button" data-view="flow" aria-pressed="${pressed('flow')}">Stromfluss</button>
            <button type="button" data-view="balance" aria-pressed="${pressed('balance')}">Tagesbilanz</button>
            ${this.config.edition === 'pro' ? `<button type="button" data-view="pro" aria-pressed="${pressed('pro')}">Pro</button>` : ''}
          </div>
          <button class="tool" type="button" data-panel="appearance" aria-expanded="${this.panel === 'appearance'}" aria-controls="solar-appearance">${adjustIcon} Grafik</button>
        </div>
      </header>
      ${this.settings()}
      ${this.scene && this.view === 'flow' ? this.photoPanel() : ''}
      ${this.view === 'flow' ? `${this.flowView()}
        ${keys.length ? `<div class="metrics">${keys.map(key => this.metric(key)).join('')}</div>` : ''}` : this.view === 'pro' ? '<div data-pro-mount></div>' : this.balance()}
      ${this.sources()}
      <footer><span>${badge} · Leistung in W / kW · Energie in kWh</span>
        <button class="tool" type="button" data-panel="sources" aria-expanded="${this.panel === 'sources'}" aria-controls="solar-sources">Datenquellen</button>
      </footer>
    </ha-card>`;
    const sky = this.shadowRoot.querySelector('.sky-mount');
    if (sky) {
      this.skyElement ??= document.createElement('oled-solar-sky');
      sky.append(this.skyElement);
      this.updateSky();
    }
    if (this.view === 'pro') {
      this.proElement ??= document.createElement('oled-solar-pro');
      this.shadowRoot.querySelector('[data-pro-mount]').append(this.proElement);
      this.updatePro();
    }
    for (const key of ['view', 'panel', 'appearance', 'source']) {
      if (old[key]) {
        this.shadowRoot.querySelector(`[data-${key}="${CSS.escape(old[key])}"]`)?.focus({ preventScroll: true });
        break;
      }
    }
  }
}

if (!customElements.get('oled-solar-card')) {
  customElements.define('oled-solar-card', OledSolarCard);
  window.customCards ??= [];
  window.customCards.push({ type: 'oled-solar-card', name: 'OLED Solar', description: 'Animierte Sonnenbahn, live Stromfluss und PV-Auswertung im OLED-Stil.', preview: true });
}
