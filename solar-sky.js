import { sunPath } from './solar-pro-data.js';
import sunImage from './motifs/forecast.webp';

const coords = {
  left: 30, width: 640, horizon: 166, vertical: 144,
};
const hour = 3600000;

class OledSolarSky extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.playing = false;
    this.manual = false;
    this.shadowRoot.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.sky;
      if (action === 'play') this.togglePlay();
      if (action === 'now') {
        this.stop();
        this.manual = false;
        this.draw(this.currentIndex);
      }
    });
    this.shadowRoot.addEventListener('input', event => {
      if (event.target.matches('input[type="range"]')) {
        this.stop();
        this.manual = true;
        this.draw(Number(event.target.value));
      }
    });
  }

  connectedCallback() {
    if (this.playing) this.animate();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  configure({ zone, location, now, motion }) {
    this.zone = zone;
    this.motion = motion;
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const signature = [zone, day, location?.lat, location?.lon].join('/');
    const changed = signature !== this.signature;
    if (changed) {
      this.stop();
      this.manual = false;
      this.signature = signature;
      this.clock = new Intl.DateTimeFormat('de-DE', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      this.points = location ? sunPath(day, now, zone, location, []) : [];
      this.firstLight = this.points.findIndex(point => point.altitude >= 0);
      this.lastLight = this.points.findLastIndex(point => point.altitude >= 0);
      this.render();
    }
    this.currentIndex = this.points.length ? Math.min(this.points.length - 1, Math.max(0, (now - this.points[0].time) / (hour / 4))) : 0;
    if (changed || (!this.manual && Math.abs(this.currentIndex - this.index) > .01)) this.draw(this.currentIndex);
    if (!motion && this.playing) this.stop();
  }

  x(index) {
    return coords.left + coords.width * index / Math.max(1, this.points.length - 1);
  }

  y(altitude) {
    return coords.horizon - Math.max(0, altitude) * coords.vertical / 90;
  }

  draw(index) {
    if (!this.points?.length) return;
    const i = Math.max(0, Math.min(index, this.points.length - 1));
    const a = this.points[Math.floor(i)];
    const b = this.points[Math.ceil(i)];
    const t = i % 1;
    const time = a.time + (b.time - a.time) * t;
    const elevation = a.altitude + (b.altitude - a.altitude) * t;
    const night = elevation < 0;
    const x = this.x(i);
    const y = this.y(elevation) + (night ? 10 : 0);
    const root = this.shadowRoot;
    const plot = root.querySelector('.track');
    const phase = night ? 'night' : 'day';
    plot.dataset.phase = phase;
    this.dataset.phase = phase;
    plot.style.setProperty('--glow-x', (x / 700 * 100).toFixed(2) + '%');
    plot.style.setProperty('--glow-y', (y / 190 * 100).toFixed(2) + '%');
    const marker = root.querySelector('.marker');
    marker.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    root.querySelector('.arc-past').setAttribute('width', x.toFixed(2));
    const text = `${this.clock.format(time)} · ${night ? 'Unter dem Horizont' : Math.round(elevation) + '° Sonnenhöhe'}`;
    if (root.querySelector('output').textContent !== text) root.querySelector('output').textContent = text;
    root.querySelector('input').value = String(i);
    root.querySelector('input').setAttribute('aria-valuetext', text);
    root.querySelector('[data-sky="now"]').hidden = !this.manual;
    this.index = i;
  }

  togglePlay() {
    if (this.playing) {
      this.stop();
      return;
    }
    if (this.lastLight <= this.firstLight) return;
    this.manual = true;
    if (!this.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const next = this.index < this.firstLight || this.index >= this.lastLight ? this.firstLight : this.index + 1;
      this.draw(next);
      return;
    }
    this.playing = true;
    this.draw(this.firstLight);
    this.shadowRoot.querySelector('[data-sky="play"]').textContent = 'Pause';
    this.lastFrame = null;
    this.animate();
  }

  animate() {
    if (!this.isConnected || !this.playing || this.frame) return;
    const step = at => {
      this.frame = null;
      if (!this.playing) return;
      const delta = this.lastFrame === null ? 0 : Math.min(80, at - this.lastFrame);
      this.lastFrame = at;
      const index = Math.min(this.lastLight, this.index + (this.lastLight - this.firstLight) * delta / 9500);
      this.draw(index);
      if (index >= this.lastLight) this.stop();
      else this.animateFrame(step);
    };
    this.lastFrame = null;
    this.animateFrame(step);
  }

  animateFrame(step) {
    this.frame = requestAnimationFrame(step);
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = null;
    this.playing = false;
    const button = this.shadowRoot.querySelector('[data-sky="play"]');
    if (button) button.textContent = 'Tageslauf';
  }

  render() {
    const root = this.shadowRoot;
    const visible = this.points.map((point, index) => [this.x(index), this.y(point.altitude)])
      .slice(Math.max(0, this.firstLight - 1), this.lastLight + 2)
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const edges = this.firstLight >= 0 ? [
      [this.firstLight, 'Aufgang'], [this.lastLight, 'Untergang'],
    ].map(([i, label]) => `<span>${label} <b>ca. ${this.clock.format(this.points[i].time)}</b></span>`).join('') : '';
    root.innerHTML = `<style>
      :host{display:block;min-width:0;font:inherit;color:#faf5e7}*{box-sizing:border-box}
      .track{position:relative;isolation:isolate;background:radial-gradient(ellipse at var(--glow-x,50%) var(--glow-y,35%),#ed9b2935,transparent 47%);border-radius:24px}
      .track[data-phase="night"]{background:radial-gradient(ellipse at var(--glow-x,50%) 70%,#708dcd32,transparent 58%)}
      svg{display:block;width:100%;overflow:visible}.guide{stroke:#f8ebdb37;stroke-width:1;stroke-dasharray:2 8}.horizon{stroke:#e2e6eb59;stroke-width:1}
      .future,.past{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.future{stroke:#f9dba584;stroke-dasharray:4 7;stroke-width:1.3}.past{stroke:#ffd381;stroke-width:2.2;filter:drop-shadow(0 0 5px #ff9938)}
      .sun-picture{filter:drop-shadow(0 0 13px #ff9c37)}.night-dot{display:none}.track[data-phase="night"] .sun-picture{display:none}.track[data-phase="night"] .night-dot{display:block}
      .horizon-times{display:flex;justify-content:space-between;gap:8px;color:#cdd6dc;font-size:11px;padding:0 4.2%;margin-top:-5px}.horizon-times b{font-weight:650;color:#fff}
      .tools{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;margin:7px 4.2% 0}
      button,input{font:inherit}button{min-height:42px;background:#141a20e8;border:1px solid #63737b80;border-radius:9px;color:#fff;padding:0 10px;font-size:12px;font-weight:650;cursor:pointer;white-space:nowrap}
      button:hover{background:#283038}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible{outline:2px solid #ffd381;outline-offset:2px}
      input{accent-color:#ffca72;width:100%;min-width:0;margin:0;min-height:38px}output{font-size:12px;font-weight:650;color:#f3e9d7;white-space:nowrap;grid-column:1/-1;text-align:center}
      [hidden]{display:none}.missing{display:grid;place-items:center;min-height:155px;color:#cdd6dc;font-size:13px;padding:20px;text-align:center}
    </style>
    ${!this.points.length ? '<div class="missing">Für die Sonnenbahn fehlen die Standortkoordinaten.</div>' : `
      <div class="track">
        <svg viewBox="0 0 700 190" aria-hidden="true">
          <defs><clipPath id="elapsed"><rect class="arc-past" width="0" height="190"/></clipPath></defs>
          <path class="guide" d="M30 30H670 M30 76H670 M30 121H670 M190 18V166 M350 18V166 M510 18V166"/>
          <path class="horizon" d="M30 166H670"/>
          <polyline class="future" points="${visible}"/><polyline class="past" clip-path="url(#elapsed)" points="${visible}"/>
          <g class="marker"><image class="sun-picture" href="${sunImage}" x="-29" y="-29" width="58" height="58"/>
            <circle class="night-dot" r="5" fill="#afc8ff" stroke="#e5eeff" stroke-width="1.5"/></g>
        </svg>
        <div class="horizon-times">${edges || '<span>Sonne heute unter dem Horizont</span>'}</div>
      </div>
      <div class="tools"><button type="button" data-sky="play" ${this.lastLight <= this.firstLight ? 'disabled' : ''}>Tageslauf</button>
        <input type="range" aria-label="Uhrzeit auf der Sonnenbahn" min="0" max="${this.points.length - 1}" step="any">
        <button type="button" data-sky="now" hidden>Jetzt</button><output aria-live="off"></output></div>`}`;
  }
}

if (!customElements.get('oled-solar-sky')) customElements.define('oled-solar-sky', OledSolarSky);
