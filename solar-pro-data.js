import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import {
  energyDateKey, energyDayWindow, energyMonthWindow, energyWindow,
  energySources, fetchEnergyComparison,
} from './energy-history.ts';

export const CHANNELS = ['solar', 'import', 'export', 'self_use'];
const hour = 3600000;
export const decimal = (value, min, max) => {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const number = Number(raw);
  return number >= min && number <= max ? number : null;
};

export function periodWindow(range, selected, now, zone) {
  const today = energyDateKey(now, zone);
  if (range === 'day') return energyDayWindow(selected || today, now, zone);
  if (range === 'month') return energyMonthWindow(selected || today.slice(0, 7), now, zone);
  const year = Number(selected);
  if (!Number.isInteger(year) || year < 2000 || year >= Number(today.slice(0, 4))) {
    return energyWindow('year', now, zone);
  }
  const first = energyMonthWindow(year + '-01', now, zone);
  const last = energyMonthWindow(year + '-12', now, zone);
  return { ...first, end: last.end, priorEnd: last.priorEnd, label: String(year), priorLabel: String(year - 1) };
}

function expected(start, end, period, zone) {
  const dt = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hh = new Intl.DateTimeFormat('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const bins = new Map();
  for (let at = start; at < end; at += hour) {
    const day = dt.format(at);
    const id = period === 'hour' ? at : day;
    if (!bins.has(id)) bins.set(id, { id, at, day, label: period === 'hour' ? hh.format(at) : day.slice(8) + '.' + day.slice(5, 7) + '.' });
  }
  return [...bins.values()];
}

function summarize(stats, sources, start, end, window, range) {
  const bins = expected(start, end, window.period, window.zone);
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: window.zone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const maps = Object.fromEntries([...new Set(Object.values(sources).flat())].map(id => [
    id, new Map((stats[id] ?? []).map(row => [
      window.period === 'hour' ? row.start : date.format(row.start), row.change,
    ])),
  ]));
  const rows = bins.map(bin => {
    const values = Object.fromEntries(CHANNELS.map(key => {
      const values = (sources[key] ?? []).map(id => maps[id].get(bin.id));
      return [key, values.length && values.every(v => Number.isFinite(v) && v >= -0.00001)
        ? values.reduce((sum, v) => sum + Math.max(0, v), 0) : null];
    }));
    return { ...bin, ...values };
  });
  if (range !== 'year') return rows;
  const groups = new Map();
  for (const row of rows) {
    const month = row.day.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(row);
  }
  return [...groups.entries()].map(([month, items]) => ({
    label: new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(new Date(month + '-15T12:00:00Z')),
    ...totals(items),
  }));
}

export function totals(rows) {
  return Object.fromEntries(CHANNELS.map(key => [
    key, rows.length && rows.every(row => row[key] !== null)
      ? rows.reduce((sum, row) => sum + row[key], 0) : null,
  ]));
}

export async function energyReport(hass, config, window, range) {
  if (config.demo) {
    const mock = (start, end, previous) => {
      const bins = expected(start, end, window.period, window.zone);
      const power = config.capacity_kwp ?? 6.7;
      const hh = new Intl.DateTimeFormat('de-DE', { timeZone: window.zone, hour: '2-digit', hourCycle: 'h23' });
      const rows = bins.map(({ at, day }, i) => {
        const month = Number(day.slice(5, 7));
        const seasonal = .52 + .46 * Math.cos((month - 6) * Math.PI / 6);
        const weather = .63 + .24 * Math.cos(i * 1.9 + Number(day.slice(8))) + .13 * Math.sin(i * .83);
        const localHour = Number(hh.formatToParts(at).find(part => part.type === 'hour').value);
        const daytime = window.period === 'hour' ? Math.max(0, Math.cos((localHour - 12.5) * Math.PI / 11)) ** 1.7 : 1;
        const solar = power * (window.period === 'hour' ? .8 : 5.8) * (window.period === 'hour' ? .85 : seasonal) * daytime * weather * (previous ? .86 : 1);
        return { start: at, solar,
          import: window.period === 'hour' ? .28 + .1 * Math.cos(i) : 4.2 + .8 * Math.cos(i),
          export: solar * .56, self_use: solar * .44 };
      });
      return Object.fromEntries(CHANNELS.map(key => [key, rows.map(row => ({
        start: row.start, change: row[key],
      }))]));
    };
    const sources = Object.fromEntries(CHANNELS.map(key => [key, [key]]));
    return makeReport(mock(window.start, window.end, false), mock(window.priorStart, window.priorEnd, true),
      sources, window, range, 'Simulierte Zählerdaten');
  }
  if (!hass?.callWS) throw new Error('Home Assistant ist noch nicht verbunden.');
  let sources = config.statistics;
  if (!sources) {
    const prefs = await hass.callWS({ type: 'energy/get_prefs' });
    sources = energySources(prefs);
  }
  if (!Object.values(sources).some(ids => ids.length)) throw new Error('Im Energiedashboard sind keine passenden Zähler eingerichtet.');
  const { current, prior } = await fetchEnergyComparison(hass, window, sources);
  return makeReport(current, prior, sources, window, range,
    config.statistics ? 'Home Assistant · konfigurierte Zähler' : 'Home Assistant · Zähler des Energiedashboards');
}

function makeReport(current, prior, sources, window, range, source) {
  const now = summarize(current, sources, window.start, window.end, window, range);
  const before = summarize(prior, sources, window.priorStart, window.priorEnd, window, range);
  return { now, before, totals: totals(now), previous: totals(before), source,
    intervals: expected(window.start, window.end, window.period, window.zone).length,
    priorIntervals: expected(window.priorStart, window.priorEnd, window.period, window.zone).length,
    window };
}

export function economics(values, settings, allowBalance) {
  const { solar, export: fed, self_use: measured } = values;
  const own = measured ?? (allowBalance && solar !== null && fed !== null && solar + .00001 >= fed ? Math.max(0, solar - fed) : null);
  const savings = own !== null && settings.buy !== null ? own * settings.buy / 100 : null;
  const revenue = fed !== null && settings.sell !== null ? fed * settings.sell / 100 : null;
  return { own, savings, revenue, benefit: savings !== null && revenue !== null ? savings + revenue : null,
    method: measured !== null ? 'Gemessener Eigenverbrauch' : own !== null ? 'Geschätzt aus PV-Ertrag minus Einspeisung' : 'Eigenverbrauch benötigt einen Zähler oder eine passende Anlagenbilanz' };
}

export function sunPath(day, now, zone, location, arrays) {
  const window = energyDayWindow(day, Math.max(now, Date.parse(day + 'T12:00:00Z')) + 2 * 86400000, zone);
  const observer = new Observer(location.lat, location.lon, 0);
  const rad = Math.PI / 180;
  const points = [];
  for (let time = window.start; time < window.end; time += 15 * 60000) {
    const date = new Date(time);
    const equator = Equator(Body.Sun, date, observer, true, true);
    const { altitude, azimuth } = Horizon(date, observer, equator.ra, equator.dec, 'normal');
    const angles = arrays.map(({ tilt, az }) => {
      const cos = Math.sin(altitude * rad) * Math.cos(tilt * rad) +
        Math.cos(altitude * rad) * Math.sin(tilt * rad) * Math.cos((azimuth - az) * rad);
      return Math.acos(Math.max(-1, Math.min(1, cos))) / rad;
    });
    points.push({ time, altitude, azimuth, angles });
  }
  return points;
}
