export const SIGNALS = {
  solar: 'PV-Leistung', house: 'Hausverbrauch', grid: 'Netzleistung', grid_import: 'Netzbezug',
  grid_export: 'Einspeisung', battery: 'Speicherleistung', battery_soc: 'Ladezustand',
  ev: 'Wallbox', yield_today: 'Ertrag heute', forecast_today: 'Prognose heute',
  forecast_remaining: 'Prognose Rest heute', forecast_tomorrow: 'Prognose morgen',
  import_today: 'Netzbezug heute', export_today: 'Einspeisung heute',
  house_today: 'Hausverbrauch heute', inverter: 'Wechselrichter',
};

const units = {
  power: { W: 1, kW: 1000, MW: 1000000 },
  energy: { Wh: 0.001, kWh: 1, MWh: 1000 },
  percent: { '%': 1 },
};

export function snapshot(hass, config, now = Date.now()) {
  const ids = config.entities;
  const states = hass?.states ?? {};
  const date = new Intl.DateTimeFormat('de-DE', { timeZone: hass?.config?.time_zone, dateStyle: 'short' });
  const day = date.format(now);

  function read(key, kind, signed = false, id = ids[key]) {
    if (!id) return { value: null, status: 'unset' };
    const entity = states[id];
    const raw = entity?.state;
    const factor = units[kind][entity?.attributes?.unit_of_measurement];
    const value = raw == null || !String(raw).trim() || factor === undefined ? NaN : Number(raw) * factor;
    const at = Date.parse(entity?.last_reported || entity?.last_updated || '');
    if (!Number.isFinite(value) || (!signed && value < 0) || (kind === 'percent' && value > 100)) {
      return { id, value: null, status: 'missing' };
    }
    const daily = kind === 'energy';
    const forecast = key.startsWith('forecast_');
    const maxAge = daily ? (forecast ? 6 * 60 : 36 * 60) : config.max_age_minutes;
    if (!Number.isFinite(at) || at > now + 60000 || now - at > maxAge * 60000 || (daily && date.format(at) !== day)) {
      return { id, value: null, status: 'stale', at };
    }
    return { id, value, status: 'ok', at };
  }

  const pvInputs = [ids.solar, ...(config.pvInputs ?? [])].filter(Boolean).map(id => read('solar', 'power', false, id));
  const solar = pvInputs.length <= 1 ? read('solar', 'power')
    : pvInputs.every(input => input.status === 'ok')
      ? { value: pvInputs.reduce((sum, input) => sum + input.value, 0), status: 'ok' }
      : { value: null, status: pvInputs.some(input => input.status === 'stale') ? 'stale' : 'missing' };
  const devices = (config.devices ?? []).map(device => ({
    ...device,
    label: device.name || states[device.entity]?.attributes?.friendly_name || device.entity,
    reading: read('device', 'power', device.signed, device.entity),
  }));
  const house = read('house', 'power');
  const battery = read('battery', 'power', true);
  const ev = read('ev', 'power');
  let grid = read('grid', 'power', true);
  if (grid.value !== null) {
    if (config.grid_positive === 'export') grid.value *= -1;
  } else if (ids.grid_import && ids.grid_export && ids.grid_import !== ids.grid_export) {
    const incoming = read('grid_import', 'power');
    const outgoing = read('grid_export', 'power');
    grid = incoming.value !== null && outgoing.value !== null
      ? { value: incoming.value - outgoing.value, status: 'ok', at: Math.min(incoming.at, outgoing.at) }
      : { value: null, status: [incoming, outgoing].some(r => r.status === 'stale') ? 'stale' : 'missing' };
  } else if (ids.grid_import || ids.grid_export) {
    grid = { ...grid, status: grid.status === 'stale' ? 'stale' : 'missing' };
  }
  if (battery.value !== null && config.battery_positive === 'discharge') battery.value *= -1;

  const daily = Object.fromEntries(Object.keys(SIGNALS)
    .filter(key => key.endsWith('_today') || key.startsWith('forecast_'))
    .map(key => [key, read(key, 'energy')]));
  return { solar, pvInputs, house, grid, battery, ev, devices, soc: read('battery_soc', 'percent'), daily };
}

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
export function format(value, kind = 'power') {
  if (value === null) return ['—', ''];
  if (kind === 'energy') return [number.format(value), 'kWh'];
  if (kind === 'percent') return [number.format(value), '%'];
  return Math.abs(value) >= 1000
    ? [number.format(Math.abs(value) / 1000), 'kW']
    : [number.format(Math.round(Math.abs(value))), 'W'];
}
