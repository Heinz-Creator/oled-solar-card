import { economics } from './solar-pro-data.js';

export const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const formatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const euros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const fmt = (value, unit = '') => value == null ? '—' : formatter.format(value) + (unit ? ' ' + unit : '');
const money = value => value == null ? '—' : euros.format(value);
const scalar = value => Number(value.toFixed(2));
const token = name => name.toLowerCase().replace(/[^a-z_-]/g, '');

export function reportContent(report, settings, allowBalance, capacity) {
  const { totals, previous, window } = report;
  const finances = economics(totals, settings, allowBalance);
  const canCompare = report.intervals === report.priorIntervals && totals.solar !== null && previous.solar > 0;
  const delta = canCompare ? (totals.solar / previous.solar - 1) * 100 : null;
  const kpis = [
    ['Solarertrag', fmt(totals.solar, 'kWh'), delta === null ? 'Vorjahr ' + fmt(previous.solar, 'kWh')
      : (delta >= 0 ? '+' : '−') + fmt(Math.abs(delta), '%') + ' zum Vorjahr'],
    ['Stromkosten gespart', money(finances.savings), 'Eigenverbrauch ' + fmt(finances.own, 'kWh')],
    ['Einspeisevergütung', money(finances.revenue), 'Einspeisung ' + fmt(totals.export, 'kWh')],
    ['PV-Vorteil gesamt', money(finances.benefit), 'Ersparnis plus Vergütung'],
  ];
  const tiles = kpis.map(([name, value, note]) => `<div class="pro-kpi"><span>${name}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  const grid = [['import', 'Netzbezug', 'blue'], ['export', 'Einspeisung', 'mint']];
  return `<div class="pro-kpis">${tiles}</div>
    <p class="pro-caption">Arbeitspreis ${fmt(settings.buy, 'ct/kWh')} · Vergütung ${fmt(settings.sell, 'ct/kWh')}. ${safe(finances.method)}. Geldbeträge sind Schätzwerte mit den eingestellten Preisen.</p>
    <div class="pro-charts">
      ${chart('PV-Ertrag im Vorjahresvergleich', report.now, report.before, [['solar', window.label, 'gold'], ['solar', window.priorLabel, 'silver']])}
      ${chart('Austausch mit dem Stromnetz', report.now, report.now, grid)}
    </div>
    <p class="pro-caption">${safe(report.source)} · Abgeschlossene Intervalle. „—“ steht für fehlende oder unvollständige Daten.${capacity ? ' Anlagenleistung ' + fmt(capacity, 'kWp') + '.' : ''}</p>`;
}

function chart(title, first, second, series) {
  const index = rows => {
    const occurrences = new Map();
    return new Map(rows.map(row => {
      const occurrence = (occurrences.get(row.label) ?? 0) + 1;
      occurrences.set(row.label, occurrence);
      return [row.label + '/' + occurrence, row];
    }));
  };
  const left = index(first);
  const right = index(second);
  const keys = [...new Set([...left.keys(), ...right.keys()])];
  const count = keys.length;
  const points = keys.map(key => ({
    label: (left.get(key) ?? right.get(key)).label,
    values: [left.get(key)?.[series[0][0]] ?? null, right.get(key)?.[series[1][0]] ?? null],
  }));
  const maximum = Math.max(0, ...points.flatMap(point => point.values.map(value => value ?? 0)));
  const legend = series.map(([, label, color]) =>
    `<span><i class="swatch ${token(color)}"></i>${safe(label)}</span>`).join('');
  const body = points.map((point, index) => {
    const bars = point.values.map((value, i) =>
      `<i class="chart-bar ${token(series[i][2])}${value === null ? ' gap' : ''}" style="--bar:${maximum ? scalar((value ?? 0) / maximum * 100) : 0}%"></i>`).join('');
    const tip = `${point.label} | ${series[0][1]} ${fmt(point.values[0], 'kWh')} | ${series[1][1]} ${fmt(point.values[1], 'kWh')}`;
    return `<div class="chart-slot" title="${safe(tip)}">${bars}<small>${index % Math.max(1, Math.ceil(count / 7)) === 0 ? safe(point.label) : ''}</small></div>`;
  }).join('');
  const table = points.map(point => `<tr><th scope="row">${safe(point.label)}</th>${point.values.map(value => '<td>' + fmt(value) + '</td>').join('')}</tr>`).join('');
  return `<section class="pro-box pro-chart"><h3>${title}</h3><div class="chart-key">${legend}</div>
    ${points.length && points.some(point => point.values.some(value => value !== null))
      ? `<div class="chart-scale" aria-hidden="true">${fmt(maximum, 'kWh')}</div><div class="chart-plot" aria-hidden="true" style="--slots:${count}">${body}</div>`
      : '<p class="pro-empty">Für diesen Zeitraum sind keine Messintervalle verfügbar.</p>'}
    ${points.length ? `<details class="chart-details"><summary>Messwerte in kWh</summary>
      <table><thead><tr><th scope="col">Intervall</th>${series.map(([, label]) => '<th scope="col">' + safe(label) + '</th>').join('')}</tr></thead><tbody>${table}</tbody></table></details>` : ''}
    </section>`;
}

export function benchmark(report, reference, capacity, key) {
  const own = report?.totals.solar;
  const theirs = reference?.key === key ? reference.specific ?? reference.kwh / reference.kwp : null;
  const ours = own != null && capacity ? own / capacity : null;
  const rows = [['Eigene Anlage', ours, 'gold'], [reference?.key === key ? reference.name : 'Vergleichsanlage', theirs, 'mint']];
  const max = Math.max(0, ours ?? 0, theirs ?? 0);
  return `<section class="pro-box pro-near manual-reference"><h3>Eigene Vergleichsanlage</h3>
    <p class="pro-caption">Ertrag pro installiertem kWp im selben Zeitraum. Wetter, Verschattung und Ausrichtung können den Vergleich beeinflussen.</p>
    ${rows.map(([name, value, color]) => `<div class="pro-benchmark"><span>${safe(name)}</span><strong>${fmt(value, 'kWh/kWp')}</strong>
      <div><i class="${color}" style="width:${max ? scalar((value ?? 0) / max * 100) : 0}%"></i></div></div>`).join('')}
    ${theirs === null ? '<p class="pro-caption">Unter Einstellungen kannst du den Ertrag einer konkreten Vergleichsanlage übernehmen.</p>'
      : `<p class="pro-caption">Vergleichswert manuell übernommen · Quelle ${safe(reference.source ?? 'Eigene Angabe')}</p>`}
  </section>`;
}

export const printStyles = `
:root{color-scheme:light;font:11pt/1.4 system-ui;color:#202529;--gold:#8b5700;--silver:#647480;--blue:#234b9a;--mint:#08766a;--solar:#825300;--muted:#4d5256;--border:#bdc3c7}
body{max-width:870px;margin:28px auto;padding:0 12px}h1{margin-bottom:4px}h3{margin:0 0 6px}button{padding:8px 14px}
.pro-kpis,.pro-charts{display:grid;gap:12px}.pro-kpis{grid-template-columns:repeat(4,1fr)}.pro-charts{grid-template-columns:1fr}
.pro-kpi,.pro-box{border:1px solid var(--border);padding:10px;break-inside:avoid}.pro-kpi strong{display:block;font-size:1.45rem}.pro-kpi span,.pro-kpi small{display:block}
.chart-key{display:flex;flex-wrap:wrap;gap:12px}.swatch{display:inline-block;width:9px;height:9px;margin-right:5px}.gold{background:var(--gold)}.silver{background:var(--silver)}.blue{background:var(--blue)}.mint{background:var(--mint)}
.chart-scale{font-size:9pt}.chart-plot{display:grid;grid-template-columns:repeat(var(--slots),minmax(0,1fr));height:125px;border-bottom:1px solid #79858b;margin-bottom:24px;gap:3px}
.chart-slot{position:relative;display:flex;gap:2px;align-items:end}.chart-bar{display:block;width:50%;height:var(--bar)}.chart-bar.gap{height:3px;background:repeating-linear-gradient(45deg,#777 0 1px,transparent 1px 2px)}.chart-slot small{position:absolute;top:100%;white-space:nowrap;font-size:8pt}
.pro-caption{font-size:9pt;color:var(--muted)}table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border-bottom:1px solid #ddd;text-align:left;padding:3px 5px}
.pro-benchmark{display:flex;gap:12px}.pro-benchmark div{display:none}.pro-near a{display:none}
@page{margin:14mm;size:A4}@media print{body{margin:0;max-width:none;padding:0}button{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}.chart-details{display:none}}
`;
