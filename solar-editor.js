import { SIGNALS } from './solar-model.js';
import { safe } from './solar-pro-view.js';
import { photoSource } from './solar-photo.js';

const CORE = ['solar', 'house', 'grid', 'grid_import', 'grid_export', 'battery', 'battery_soc', 'ev'];
const DAILY = ['yield_today', 'import_today', 'export_today', 'house_today', 'forecast_today', 'forecast_remaining', 'forecast_tomorrow'];
export const DEVICE_TYPES = { generic: 'Gerät', heat: 'Wärmepumpe', pool: 'Pool', ev: 'Ladepunkt', battery: 'Speicher' };
export const sensorId = value => typeof value === 'string' && /^sensor\.[a-z0-9_]+$/.test(value);

export function normalizeDevices(devices) {
  const ids = new Set();
  return (Array.isArray(devices) ? devices : []).filter(device => {
    if (!sensorId(device?.entity) || ids.has(device.entity)) return false;
    ids.add(device.entity);
    return true;
  }).slice(0, 8).map(device => ({
    entity: device.entity,
    name: typeof device.name === 'string' ? device.name.trim().slice(0, 70) : '',
    kind: Object.hasOwn(DEVICE_TYPES, device.kind) ? device.kind : 'generic',
    signed: device.signed === true,
  }));
}

const textField = (label, key, value, attrs = '') =>
  `<label>${label}<input name="${key}" value="${safe(value)}" ${attrs}></label>`;
const selectField = (label, key, values, value) => `<label>${label}<select name="${key}" aria-label="${label}">${Object.entries(values).map(([id, title]) =>
  `<option value="${id}" ${id === value ? 'selected' : ''}>${title}</option>`).join('')}</select></label>`;
const entityField = (label, name, value, kind = 'power') =>
  textField(label, name, value, `list="solar-${kind}" placeholder="Sensor auswählen" autocomplete="off" spellcheck="false"`);

class OledSolarCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.addEventListener('change', event => this.commit(event));
    this.shadowRoot.addEventListener('click', event => this.onClick(event));
    this.shadowRoot.addEventListener('submit', event => event.preventDefault());
  }

  setConfig(config) {
    if (JSON.stringify(config) === JSON.stringify(this.config)) return;
    this.config = config;
    this.lastEmittedConfig = JSON.stringify(config);
    this.devices = normalizeDevices(config.devices);
    this.inputs = [...new Set((Array.isArray(config.pv_inputs) ? config.pv_inputs : []).filter(sensorId))].slice(0, 7);
    this.render();
  }

  set hass(value) {
    this._hass = value;
    const count = Object.keys(value?.states ?? {}).length;
    if (count !== this.entityCount) {
      this.entityCount = count;
      this.populate();
    }
  }

  onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const kind = button.dataset.add ?? button.dataset.remove;
    if (!kind) return;
    const list = kind === 'device' ? this.devices : this.inputs;
    if (button.dataset.add && list.length < (kind === 'device' ? 8 : 7)) {
      list.push(kind === 'device' ? { entity: '', name: '', kind: 'generic' } : '');
      this.render();
      this.shadowRoot.querySelector(`[name="${kind === 'device' ? 'device' : 'pv'}.${list.length - 1}${kind === 'device' ? '.entity' : ''}"]`)?.focus();
    }
    if (button.dataset.remove) {
      list.splice(Number(button.dataset.index), 1);
      this.emit();
      this.render();
    }
  }

  commit(event) {
    const { name, value, checked } = event.target;
    if (!name) return;
    const [section, index, key] = name.split('.');
    if (section === 'device') {
      if (key === 'entity' && value && !sensorId(value.trim())) return this.invalid(event.target);
      this.devices[Number(index)][key] = key === 'signed' ? checked : value.trim();
    } else if (section === 'pv') {
      if (value && !sensorId(value.trim())) return this.invalid(event.target);
      this.inputs[Number(index)] = value.trim();
    } else if (section === 'entity') {
      const id = value.trim();
      if ((!id && index === 'solar') || (id && !sensorId(id))) return this.invalid(event.target);
      const entities = { ...this.config.entities };
      if (id) entities[index] = id;
      else delete entities[index];
      this.config = { ...this.config, entities };
    } else {
      const next = { ...this.config };
      if (name === 'capacity_kwp') {
        if (value && !event.target.checkValidity()) return this.invalid(event.target);
        if (value) next[name] = Number(value);
        else delete next[name];
      } else if (name === 'house_image') {
        if (value.trim() && !photoSource(value)) {
          this.shadowRoot.querySelector('[role="status"]').textContent = 'Verwende einen Pfad unter /local/ oder eine HTTPS-Bildadresse.';
          event.target.focus();
          return;
        }
        if (value.trim()) next[name] = photoSource(value);
        else delete next[name];
      } else next[name] = value;
      this.config = next;
    }
    this.shadowRoot.querySelector('[role="status"]').textContent = '';
    this.emit();
  }

  invalid(input) {
    this.shadowRoot.querySelector('[role="status"]').textContent = 'Bitte wähle einen gültigen Sensor oder überprüfe den Zahlenwert.';
    input.focus();
  }

  emit() {
    const devices = normalizeDevices(this.devices);
    const pv_inputs = [...new Set(this.inputs.filter(sensorId))].filter(id => id !== this.config.entities?.solar);
    this.config = { ...this.config, devices, pv_inputs };
    const signature = JSON.stringify(this.config);
    if (signature === this.lastEmittedConfig) return;
    this.lastEmittedConfig = signature;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this.config }, bubbles: true, composed: true }));
  }

  populate() {
    const lists = { power: [], energy: [], percent: [] };
    for (const [id, state] of Object.entries(this._hass?.states ?? {})) {
      if (!sensorId(id)) continue;
      const unit = state.attributes?.unit_of_measurement;
      const kind = ['W', 'kW', 'MW'].includes(unit) ? 'power' : ['Wh', 'kWh', 'MWh'].includes(unit) ? 'energy' : unit === '%' ? 'percent' : '';
      if (kind) lists[kind].push([id, state.attributes?.friendly_name ?? id]);
    }
    for (const [kind, values] of Object.entries(lists)) {
      const target = this.shadowRoot.getElementById('solar-' + kind);
      if (!target) continue;
      target.innerHTML = values.sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([id, label]) =>
        `<option value="${safe(id)}" label="${safe(label)}"></option>`).join('');
    }
  }

  render() {
    const c = this.config ?? {};
    const open = new Set([...this.shadowRoot.querySelectorAll('details[open]')].map(node => node.dataset.group));
    const field = key => entityField(SIGNALS[key], 'entity.' + key, c.entities?.[key], key === 'battery_soc' ? 'percent' : 'power');
    const remove = (kind, index, label) => `<button type="button" data-remove="${kind}" data-index="${index}">${label} entfernen</button>`;
    const inputs = this.inputs.map((id, index) => `<div class="pair">
      ${entityField('Weiterer PV-Sensor ' + (index + 1), 'pv.' + index, id)}${remove('pv', index, 'PV-Sensor')}</div>`);
    const devices = this.devices.map(({ entity, name, kind, signed }, index) => `<div class="device">
      <div class="fields">
        ${entityField('Leistungssensor ' + (index + 1), `device.${index}.entity`, entity)}
        ${textField('Name', `device.${index}.name`, name, 'maxlength="70"')}
        ${selectField('Grafik', `device.${index}.kind`, DEVICE_TYPES, kind)}
      </div>
      <div class="pair"><label class="check"><input type="checkbox" name="device.${index}.signed" ${signed ? 'checked' : ''}>Bidirektional · positiv für Verbrauch</label>
      ${remove('device', index, 'Gerät')}</div>
    </div>`);
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;font:inherit;color:var(--primary-text-color,#eef4ef)}*{box-sizing:border-box}form{display:grid;gap:12px}
      fieldset,details{border:1px solid var(--divider-color,#465049);border-radius:12px;margin:0;padding:12px;min-width:0}
      legend,summary{font-size:15px;font-weight:650}summary{cursor:pointer}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(185px,100%),1fr));gap:10px}
      label{display:grid;gap:4px;font-size:12px;color:var(--secondary-text-color,#aebdb2);min-width:0}
      input,select,button{font:inherit;color:var(--primary-text-color,#eef4ef);background:var(--secondary-background-color,#171c1a);border:1px solid var(--divider-color,#465049);border-radius:7px;min-height:42px;padding:5px 9px}
      input,select{width:100%;min-width:0}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--primary-color,#ffd16a)}
      p{font-size:12px;color:var(--secondary-text-color,#aebdb2);margin:8px 0}.pair{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin:8px 0}.pair label{flex:1}.check{display:flex;align-items:center;gap:8px;white-space:normal}.check input{width:16px;min-height:16px}.device{padding:9px 0;border-bottom:1px solid var(--divider-color,#465049)}[role=status]{min-height:0;margin:0;color:var(--error-color,#ffbe92)}
    </style><form>
      <fieldset><legend>Karte und PV-Erzeugung</legend><div class="fields">
        ${textField('Titel', 'title', c.title ?? '')}${textField('Anlagenleistung in kWp', 'capacity_kwp', c.capacity_kwp, 'type="number" min="0.01" step="0.01"')}
        ${selectField('Ansicht', 'edition', { light: 'Kompakt', pro: 'Pro mit Sonnenbahn' }, c.edition === 'pro' ? 'pro' : 'light')}
        ${selectField('Stromfluss-Layout', 'layout', { scene: 'Mit Sonnenbahn', compact: 'Kompakt' }, c.layout ?? 'scene')}
        ${selectField('Startansicht', 'default_view', { flow: 'Stromfluss', pro: 'Pro-Auswertung' }, c.default_view ?? 'flow')}
        ${field('solar')}
      </div><p>Weitere PV-Sensoren nur für separat gemessene Teilanlagen auswählen.</p>${inputs.join('')}
      ${this.inputs.length < 7 ? '<button type="button" data-add="pv">PV-Sensor ergänzen</button>' : ''}</fieldset>
      <details data-group="flow" ${open.has('flow') ? 'open' : ''}><summary>Netz, Haus, Speicher und Wallbox</summary><div class="fields">
        ${CORE.slice(1).map(field).join('')}
        ${selectField('Positiver Netzsensor', 'grid_positive', { import: 'Bezug', export: 'Einspeisung' }, c.grid_positive ?? 'import')}
        ${selectField('Positiver Speichersensor', 'battery_positive', { charge: 'Lädt', discharge: 'Entlädt' }, c.battery_positive ?? 'charge')}
      </div></details>
      <details data-group="devices" ${open.has('devices') ? 'open' : ''}><summary>Weitere Geräte und Verbraucher</summary>
        <p>Die Leistung zusätzlicher Geräte erscheint einzeln. Bereits im Hausverbrauch enthaltene Werte werden nicht erneut addiert.</p>
        ${devices.join('')}${this.devices.length < 8 ? '<button type="button" data-add="device">Gerät ergänzen</button>' : ''}
      </details>
      <details data-group="daily" ${open.has('daily') ? 'open' : ''}><summary>Tageswerte und Prognose</summary>
        <div class="fields">${DAILY.map(key => entityField(SIGNALS[key], 'entity.' + key, c.entities?.[key], 'energy')).join('')}</div>
      </details>
      <details data-group="photo" ${open.has('photo') ? 'open' : ''}><summary>Hausfoto für alle Geräte</summary>
        ${textField('Bildadresse', 'house_image', c.house_image, 'placeholder="/local/mein-haus.webp" autocomplete="off" spellcheck="false"')}
        <p>Für die Pro-Ansicht mit Sonnenbahn. Lege das Foto in Home Assistants Ordner www ab und verwende /local/ als Pfad.</p>
      </details>
      <p role="status"></p><datalist id="solar-power"></datalist><datalist id="solar-energy"></datalist><datalist id="solar-percent"></datalist>
    </form>`;
    this.populate();
  }
}

if (!customElements.get('oled-solar-card-editor')) customElements.define('oled-solar-card-editor', OledSolarCardEditor);
