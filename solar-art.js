import solar from './motifs/solar.webp';
import home from './motifs/home.webp';
import grid from './motifs/grid.webp';
import inverter from './motifs/inverter.webp';
import battery from './motifs/battery.webp';
import ev from './motifs/ev.webp';
import yieldArt from './motifs/yield.webp';
import forecast from './motifs/forecast.webp';
import heat from './motifs/heat.webp';
import pool from './motifs/pool.webp';

const motifs = { solar, home, grid, inverter, battery, ev, yield: yieldArt, forecast, heat, pool };

// The lightweight graphic sets remain available alongside the OLED illustrations.
const drawings = {
  solar: [
    'M9 35 58 24 81 44 26 58Z', 'M26 58v6l55-14v-6M9 35v6l17 23M43 60l-4 14m23-19 7 13M33 75l42-9',
    'M22 32l18 22m-2-26 20 21m-4-24 21 20M17 44l51-12M22 51l53-13',
    '<circle cx="65" cy="19" r="9"/><path d="M65 5v4m14 10h5M75 9l3-3m-26 7-4-2"/>',
  ],
  home: [
    'M13 41 41 17l27 24v32H18V42Z', 'M41 17 58 12l29 24-19 5v32l14-10V38',
    'M29 73V51h13v22m10-24h9v10h-9Zm-29-5 18-15 18 15M71 47l7-3v9l-7 4',
    '<path d="M52 49h9v10h-9Z"/>',
  ],
  grid: [
    'M29 76 42 19h10l14 57-19-16Z', 'M42 19l5-10 5 10M37 33l-20 9h59l-20-9M34 46l-23 9h73l-25-9',
    'M34 54l24-13M59 54 36 41m-5 28 31-15m2 14L33 54M17 42v7m59-7v7M11 55v7m73-7v7',
    '<path d="M17 43v5m59-5v5M11 56v5m73-5v5"/>',
  ],
  inverter: [
    'M27 17h37a5 5 0 0 1 5 5v48H23V22a5 5 0 0 1 4-5Z', 'M64 17l10-6 7 7v44l-12 8M27 17l10-6h37M32 70v8m27-8v8',
    'M31 28h30v20H31Zm5 11h5l3-5 4 8 4-3h5M36 60h4m5 0h4m5 0h4',
    '<circle cx="46" cy="55" r="2"/>',
  ],
  battery: [
    'M25 20h40v52H25Z', 'M65 20l12-7v52l-12 7M25 20l11-7h41M39 20V9h14v11',
    'M33 28h24v32H33Zm6 22h12m-12-8h12m-12-8h12',
    '<path d="M37 57h16v-5H37Z"/>',
  ],
  ev: [
    'M17 52 26 31h36l12 21v15H17Z', 'M62 31l14 4 10 17-12 15M28 32l13-7h25l10 10',
    'M25 50l6-12h26l8 12Zm-8 5h13m32 0h12M22 67v7h9v-7m28 0v7h9v-7M39 57h13',
    '<path d="M20 55h8m35 0h8"/>',
  ],
  yield: [
    'M18 63h60v10H18Z', 'M25 62V48h10v14m8 0V38h10v24m8 0V28h10v34',
    'M22 37l15-11 13 2 19-14m-9 0h9v9',
    '<circle cx="69" cy="14" r="3"/>',
  ],
  forecast: [
    'M20 65h54a11 11 0 0 0 1-22 15 15 0 0 0-27-3 12 12 0 0 0-18 6 10 10 0 0 0-10 19Z',
    'M37 40a15 15 0 1 1 18-15M41 11V5M24 20l-5-4m5 16-7 2m41-15 6-3',
    'M37 73h30m-17 6h25',
    '<circle cx="42" cy="25" r="7"/>',
  ],
};

export const ART = {
  pop: 'OLED Zuhause',
  line: 'Kontur',
  blueprint: 'Bauplan',
  glyph: 'Piktogramm',
};

export function artwork(kind, style, active = false) {
  if (style === 'pop') {
    return `<img class="art art--pop oled-art${active ? ' oled-art--active' : ''}" src="${motifs[kind]}" alt="" draggable="false">`;
  }
  const [front, side, lines, signal] = drawings[kind] ?? drawings.home;
  return `<svg class="art art--${style}${active ? ' art--active' : ''}" viewBox="0 0 96 86" aria-hidden="true">
    <path class="art-orbit" d="M9 68h78M16 77h64M48 5v76M8 45h80"/>
    <path class="art-side" d="${side}"/><path class="art-face" d="${front}"/>
    <path class="art-line" d="${lines}"/><g class="art-signal">${signal}</g>
  </svg>`;
}
