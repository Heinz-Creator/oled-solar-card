import regions from './regionen-de.json';

const SFV = 'https://pv-ertraege.sfv.de/auswertung/region.html';
export const regionURL = (region, year) => SFV + '?' + new URLSearchParams({ j: year, r: region, a: 'jahr' });

export function regionCandidates(value) {
  const postal = String(value).match(/\b(\d{5})\b/);
  if (postal) return [postal[1].slice(0, 2)];
  const key = String(value).toLowerCase().replace(/[äöüß]/g, char => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[char]))
    .normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return Object.hasOwn(regions, key) ? regions[key].split(',') : [];
}

export function comparablePeriod(range, date, today) {
  const activeYear = Number(today.slice(0, 4));
  const activeMonth = Number(today.slice(5, 7));
  const validMonth = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(date);
  if (range === 'month' && validMonth && date < today.slice(0, 7)) {
    return { range, date, year: Number(validMonth[1]), month: Number(validMonth[2]) };
  }
  if (range === 'year' && /^\d{4}$/.test(date) && Number(date) >= 2000 && Number(date) < activeYear) {
    return { range, date, year: Number(date), month: null };
  }
  const year = activeMonth === 1 ? activeYear - 1 : activeYear;
  const month = activeMonth === 1 ? 12 : activeMonth - 1;
  return { range: 'month', date: year + '-' + String(month).padStart(2, '0'), year, month };
}

const plain = value => value.replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
const months = ['Jan.', 'Feb.', 'März', 'April', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.', 'Jahr'];
function cellNumber(cell) {
  const text = plain(cell?.textContent ?? '').replace(/[.\s]/g, '').replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
}

export async function loadSfvRegion(region, period, signal) {
  const url = regionURL(region, period.year);
  const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal });
  if (!response.ok) throw new Error('SFV-Auswertung ist zurzeit nicht erreichbar.');
  const html = new DOMParser().parseFromString(await response.text(), 'text/html');
  for (const table of html.querySelectorAll('table')) {
    const rows = [...table.rows];
    const mean = rows.find(row => plain(row.cells[0]?.textContent ?? '') === 'Regionaler Durchschnitt'
      && plain(row.cells[1]?.textContent ?? '') === 'kWh/kWp');
    const count = rows.find(row => plain(row.cells[0]?.textContent ?? '') === 'Anzahl PV-Anlagen mit Ertrag');
    const column = (period.month ?? 13) + 1;
    const head = plain(rows[0]?.cells[column]?.textContent ?? '').replace(/\s/g, '');
    if (!mean || head !== months[(period.month ?? 13) - 1] + period.year) continue;
    const specific = cellNumber(mean.cells[column]);
    const plants = period.month === null ? null : cellNumber(count?.cells[column]);
    return { specific: plants === 0 ? null : specific, plants, url };
  }
  const pageText = plain(html.querySelector('main')?.textContent ?? '');
  if (/keine (?:ertrags)?daten|keine PV-Anlagen|keine Erträge|keine Ergebnisse/i.test(pageText)) {
    return { specific: null, plants: null, url };
  }
  throw new Error('Der SFV hat für diesen Zeitraum keinen lesbaren Regionalwert geliefert.');
}
