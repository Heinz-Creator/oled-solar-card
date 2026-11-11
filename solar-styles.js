export const styles = `
:host{display:block;color-scheme:dark;container-type:inline-size;--ink:#080909;--surface:#101211;--border:#282d29;--text:#f8f6ed;--muted:#a9afa9;--solar:#ffd16a;--home:#71e8cb;--grid:#9cbaff;--battery:#c3ed88;--ev:#ffa981;--neutral:#c7cecc;font:15px/1.45 "Instrument Sans",system-ui,sans-serif;color:var(--text)}
*{box-sizing:border-box}button,select{font:inherit;color:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid var(--solar);outline-offset:3px}
[hidden]{display:none!important}
ha-card{display:block;background:var(--ink);color:var(--text);border:1px solid var(--border);border-radius:26px;overflow:hidden}
h2,h3,p{margin:0}header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px 25px 18px;border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:13px;min-width:0}.brand-mark{width:45px;height:45px;display:grid;place-items:center;border-radius:13px;background:#292316;color:var(--solar);flex:none}.brand-mark svg{width:25px;height:25px}.brand h2{font-size:23px;letter-spacing:-.04em;line-height:1.1}.brand p{font-size:12px;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}
.controls{display:flex;gap:8px;align-items:center}.tabs{display:flex;padding:3px;background:#141715;border:1px solid var(--border);border-radius:12px}.tabs button,.tool{border:0;background:none;min-height:44px;padding:0 12px;border-radius:8px;white-space:nowrap;color:var(--muted);font-weight:650;font-size:13px}.tabs button[aria-pressed="true"]{background:#2c302b;color:var(--text)}.tool{border:1px solid var(--border);display:inline-flex;gap:7px;align-items:center}.tool svg{width:17px;height:17px}.tool[aria-expanded="true"],.tool:hover,.tabs button:hover{color:var(--text);background:#202421}
.main{display:grid;grid-template-columns:minmax(215px,.85fr) minmax(0,2.6fr);gap:12px;padding:14px}
.lead{padding:24px 17px 20px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-width:0}
.kicker{font-size:12px;font-weight:650;color:var(--solar);display:flex;align-items:center;gap:8px}.kicker i{width:7px;height:7px;background:currentColor;border-radius:50%;box-shadow:0 0 12px currentColor}.kicker[data-state="stale"],.kicker[data-state="missing"]{color:#ffbc92}.kicker[data-state="idle"]{color:var(--muted)}
.lead h3{font-weight:650;letter-spacing:-.046em;font-size:25px;line-height:1.07;margin:25px 0 4px}
.big{display:flex;align-items:baseline;gap:6px;line-height:1;font-size:clamp(40px,5.8cqw,77px);font-weight:680;letter-spacing:-.082em;color:var(--solar);font-variant-numeric:tabular-nums}.big small{font-size:.32em;letter-spacing:-.025em;font-weight:600}.lead-note{font-size:13px;color:var(--muted);margin-top:11px}
.capacity{height:5px;width:100%;background:#26241c;border-radius:8px;margin-top:20px;overflow:hidden}.capacity span{display:block;height:100%;background:linear-gradient(90deg,#de8a48,var(--solar));border-radius:inherit}.capacity-label{font-size:11px;color:var(--muted);margin-top:7px}
.board{position:relative;isolation:isolate;overflow:hidden;min-width:0;min-height:350px;border-radius:18px;border:1px solid #282c27;background:radial-gradient(ellipse at 50% 0%,#2a2112 0%,#141611 42%,#101512 100%);}
.board::before{content:"";position:absolute;inset:0;background:radial-gradient(circle,#9aab8735 1px,transparent 1.4px) 0 0/17px 17px;mask-image:linear-gradient(#000b,#0005);pointer-events:none;z-index:-1}
.board[data-solar="off"]{background:radial-gradient(ellipse at 50% 0%,#141a26,#0d1517 80%)}.board[data-extra="true"]{min-height:447px}
.wires{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.wire{fill:none;stroke:#66776b55;stroke-width:1.35;vector-effect:non-scaling-stroke}.wire-live{fill:none;stroke:var(--wire);stroke-width:1.5;opacity:.64;vector-effect:non-scaling-stroke}.runner{fill:none;stroke:var(--wire);stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 3px var(--wire));animation:flow var(--speed) linear infinite;animation-direction:var(--direction);stroke-dasharray:1 22}
.board[data-flow="comet"] .runner{stroke-dasharray:9 29}.board[data-flow="dash"] .runner{stroke-dasharray:4 9;filter:none}.board[data-flow="off"] .runner,:host([data-hidden]) .runner{display:none}
@keyframes flow{to{stroke-dashoffset:-92}}.board[data-flow="comet"] .runner{animation-name:comet}.board[data-flow="dash"] .runner{animation-name:dash}@keyframes comet{to{stroke-dashoffset:-152}}@keyframes dash{to{stroke-dashoffset:-52}}
.node{position:absolute;left:var(--x);top:var(--y);translate:-50% -50%;width:min(30%,158px);min-width:0;text-align:center;color:var(--accent);padding:0 2px;display:flex;flex-direction:column;align-items:center}
.node .art{width:76px;height:68px;filter:drop-shadow(0 3px 8px color-mix(in srgb,var(--accent) 21%,transparent))}.node strong{display:block;line-height:1.1;font-size:clamp(14px,2.25cqw,25px);font-weight:700;letter-spacing:-.055em;white-space:nowrap;font-variant-numeric:tabular-nums}.node strong small{font-size:.62em;letter-spacing:0}.node .name,.node .sub{display:block;font-size:12px;font-weight:650;color:#e0e6e0;text-shadow:0 1px 3px #000;background:#101411;border-radius:6px;padding:0 4px}.node .sub{font-size:10px;font-weight:550;color:var(--muted);margin-top:2px}.node .readout{background:#101411;padding:1px 5px 3px;border-radius:8px;max-width:100%}
.node .soc{display:flex;gap:3px;align-items:center}.node .soc .art{width:13px;height:13px}.node--inverter .art{width:63px;height:56px}.node--inverter .name{color:#d2dcd5}.node[data-status="missing"],.node[data-status="stale"]{--accent:var(--neutral)!important}.node[data-status="idle"] .art{opacity:.7}
.art{overflow:visible;color:var(--accent);stroke:currentColor;stroke-width:1.75;stroke-linejoin:round;stroke-linecap:round;fill:none}.art-orbit{display:none}.art-face{fill:color-mix(in srgb,var(--accent) 35%,#0c1412)}.art-side{fill:color-mix(in srgb,var(--accent) 16%,#121614);stroke-width:1.25}.art-signal{fill:currentColor;stroke-width:1.35;opacity:.8}.art-line{stroke-width:1.35}.art--active .art-signal{animation:signal 3.6s ease-in-out infinite}@keyframes signal{50%{opacity:.35}}
.art--line .art-face,.art--line .art-side,.art--line .art-signal{fill:none}.art--line .art-side{opacity:.57}.art--line{stroke-width:2.65}
.art--blueprint .art-orbit{display:block;opacity:.38;stroke-dasharray:2 3;stroke-width:1}.art--blueprint .art-face,.art--blueprint .art-side{fill:#0d1a19;stroke-dasharray:4 2}.art--blueprint .art-line{opacity:.8}
.art--glyph .art-face{fill:currentColor;stroke-width:3.5}.art--glyph .art-line{stroke:#14201d;stroke-width:2.7}.art--glyph .art-side{opacity:.3}.art--glyph .art-signal{stroke:#14201d}
:host([data-hidden]) .art-signal,.board[data-flow="off"] .art-signal,:host([data-motion="off"]) .art-signal{animation:none}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,48%),1fr));gap:9px;padding:0 14px 14px}.metric{display:flex;gap:10px;align-items:center;min-width:0;min-height:73px;padding:9px 10px;background:var(--surface);border:1px solid var(--border);border-radius:13px;--accent:var(--solar)}.metric .art{width:35px;height:34px;flex:none}.metric span,.metric small{display:block;font-size:11px;color:var(--muted);line-height:1.25}.metric strong{display:block;font-size:19px;font-weight:700;letter-spacing:-.035em;color:var(--text);font-variant-numeric:tabular-nums}.metric strong small{display:inline;font-size:11px}.metric[data-kind="forecast"]{--accent:var(--grid)}
.balance{margin:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(255px,100%),1fr));gap:12px}.balance section,.settings,.sources{border:1px solid var(--border);background:var(--surface);border-radius:16px;padding:16px}.balance h3,.settings h3,.sources h3{font-size:16px;margin-bottom:10px}.balance .metric{border:none;border-radius:0;border-top:1px solid var(--border);padding-left:0}.balance .metric>div{flex:1}.bar{display:block;margin:5px 0 1px;height:4px;background:#2e332f;border-radius:8px}.bar i{height:100%;display:block;background:var(--accent);border-radius:8px}
.settings,.sources{margin:12px 14px}.settings label{display:flex;justify-content:space-between;gap:9px;align-items:center;font-size:13px;color:var(--muted)}.settings select{min-width:110px;max-width:100%;height:43px;border:1px solid #3b463c;border-radius:8px;background:#1a1e1b;padding:0 7px}.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(225px,100%),1fr));gap:7px 16px}.settings .settings-main{border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px}
footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px 10px 25px;font-size:11px;color:var(--muted)}footer .tool{min-height:44px}.sources ul{padding:0;margin:0;list-style:none}.sources li{display:flex;flex-wrap:wrap;gap:3px 10px;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding:7px 0;font-size:13px}.sources code{font-size:11px;color:var(--muted);overflow-wrap:anywhere}.sources button{background:none;border:1px solid var(--border);border-radius:6px;padding:5px 8px;min-height:44px}
@container (max-width:640px){header{padding:14px;gap:10px;flex-wrap:wrap}.brand-mark{width:38px;height:38px}.brand h2{font-size:20px}.main{grid-template-columns:1fr;padding:10px;gap:7px}.lead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;padding:4px 5px 9px}.lead h3{margin:0;font-size:20px;grid-column:1;grid-row:2}.lead .big{grid-column:2;grid-row:1/span 2;font-size:44px}.lead-note{margin:0;font-size:11px}.capacity{margin:5px 0 0;grid-column:1/-1}.capacity-label{margin:0;grid-column:1/-1}.board{min-height:290px}.board[data-extra="true"]{min-height:400px}.node .art{width:60px;height:53px}.node--inverter .art{width:48px;height:43px}.node .name{font-size:10px}.node .sub{font-size:9px}.node strong{font-size:18px}.metrics{padding:0 10px 10px}.metric{min-height:62px;padding:7px;gap:6px}.metric .art{width:28px;height:28px}footer{padding-left:14px}}
@container (max-width:420px){.controls{width:100%;justify-content:space-between}.node .name{padding:0 1px}.node .sub{padding:0}.node .art{width:52px;height:47px}.node--inverter .art{width:43px;height:39px}.lead .big{font-size:39px}.lead h3{font-size:18px}}
@media(prefers-reduced-motion:reduce){.runner{display:none}.art-signal{animation:none!important}}

/* The original OLED motifs are embedded in the module, including their transparent edges. */
.board{background:radial-gradient(ellipse at 50% 4%,#382712 0%,#171510 34%,#101415 70%,#0c0f11 100%)}
.board::before{background:radial-gradient(circle,#a9aeab24 1px,transparent 1.45px) 0 0/21px 21px;mask-image:linear-gradient(#0008,#0003)}
.board[data-solar="off"]{background:radial-gradient(ellipse at 50% 4%,#182031,#0e1118 75%)}
.node .oled-art{width:min(100%,115px);height:95px;object-fit:contain;filter:drop-shadow(0 5px 14px color-mix(in srgb,var(--accent) 24%,transparent))}
.node--inverter .oled-art{width:82px;height:80px}
.node .soc .oled-art{width:14px;height:14px}
.metric .oled-art{width:42px;height:38px;object-fit:contain;filter:drop-shadow(0 0 7px color-mix(in srgb,var(--accent) 22%,transparent))}
.node[data-status="idle"] .oled-art{filter:saturate(.5) brightness(.67)}
.node[data-status="missing"] .oled-art,.node[data-status="stale"] .oled-art{filter:grayscale(1) brightness(.72)}
.oled-art--active{animation:oled-motif 5s ease-in-out infinite}
@keyframes oled-motif{50%{translate:0 -3px}}
:host([data-hidden]) .oled-art,:host([data-motion="off"]) .oled-art{animation:none}
@container (min-width:641px){.board{min-height:385px}.board[data-extra="true"]{min-height:490px}}
@container (max-width:640px){.node .oled-art{width:min(100%,76px);height:63px}.node--inverter .oled-art{width:58px;height:53px}.metric .oled-art{width:32px;height:30px}}
@media(prefers-reduced-motion:reduce){.oled-art--active{animation:none}}

button.node{background:transparent;border:0;font:inherit;color:var(--accent);border-radius:12px;cursor:pointer}
button.node:hover .name,button.node:focus-visible .name{background:#273330}
.solar-scene{margin:14px 14px 12px;border:1px solid #394a4c;border-radius:22px;overflow:hidden;background:#080f13}
.scene-sky{position:relative;display:grid;grid-template-columns:minmax(210px,.78fr) minmax(0,2.45fr);align-items:center;gap:8px;isolation:isolate;padding:10px 20px 18px;background:#101820}
.scene-sky::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,#070c13f0,#08111840 45%,#14171b12),linear-gradient(0deg,#091216 2%,transparent 34%),var(--landscape) center 69%/cover}
.scene-sky:has(oled-solar-sky[data-phase="night"])::before{filter:saturate(.48) brightness(.65)}
.scene-sky .lead{padding:10px 12px 10px 13px}.scene-sky .lead h3{margin-top:17px}.scene-sky .big{font-size:clamp(47px,6.5cqw,83px)}
.scene-sky .capacity{background:#463321aa}
.sky-mount{min-width:0}.solar-scene .board{min-height:295px;border:0;border-top:1px solid #56707945;border-radius:0;background:radial-gradient(ellipse at 50% 0%,#192220,#10171b 56%,#090e12 100%)}
.solar-scene .board[data-extra="true"]{min-height:468px}
.solar-scene .board[data-solar="off"]{background:radial-gradient(ellipse at 50% 0%,#132033,#0a111a 85%)}
.solar-scene .board::before{background:radial-gradient(circle,#aac6cf35 1px,transparent 1.35px) 0 0/18px 18px;mask-image:linear-gradient(#0008,transparent)}
.solar-scene .node .name,.solar-scene .node .readout,.solar-scene .node .sub{background:#11191d}
.solar-scene .node .oled-art{width:min(100%,127px);height:95px}
.solar-scene .node--battery .oled-art,.solar-scene .node--ev .oled-art{width:108px;height:84px}
.solar-scene .node--inverter .oled-art{width:80px;height:76px}.solar-scene .node .soc .oled-art{width:14px;height:14px}
.solar-scene .wire{stroke:#657f8f6b}.solar-scene .wire-live{stroke-width:var(--width);opacity:.77;filter:drop-shadow(0 0 5px var(--wire))}
.solar-scene .runner{stroke:#fff6dc;stroke-width:2.6;filter:drop-shadow(0 0 5px var(--wire))}
.scene-balance{display:grid;gap:9px;padding:12px 24px 14px;border-top:1px solid #36454d79;background:#0d1418}
.scene-balance-row{display:grid;grid-template-columns:70px minmax(90px,.9fr) minmax(0,1.2fr);align-items:center;gap:10px;font-size:12px}
.scene-balance-row>span{color:#c3d0d4;font-weight:650}
.scene-segments{height:7px;border-radius:12px;display:flex;overflow:hidden;background:#26343c}
.scene-segments i{display:block;background:var(--segment);border-right:1px solid #11181f;min-width:1px}
.scene-key{display:flex;flex-wrap:wrap;gap:4px 12px}.scene-key span{color:#c9d4d7}.scene-key b{white-space:nowrap;color:#f8faf4}.scene-key b small{font-size:inherit;color:inherit}
.scene-key i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--segment);margin-right:4px}
.scene-balance>small{font-size:10px;color:#aebdc3}
.device-section{margin:0 14px 12px}.device-section h3{font-size:14px;margin:0 0 7px}
.device-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(155px,100%),1fr));gap:7px}
.device-meter{display:flex;align-items:center;gap:7px;text-align:left;min-width:0;min-height:63px;background:#11191d;border:1px solid #2c4047;border-radius:11px;padding:6px 8px;color:var(--text)}
.device-meter:hover{border-color:var(--accent)}.device-meter .art{width:37px;height:36px;object-fit:contain;flex:none}.device-meter[data-art="heat"] .oled-art,.device-meter[data-art="pool"] .oled-art{mix-blend-mode:screen}.device-meter>span{min-width:0}
.device-meter .device-name{display:block;font-size:11px;overflow-wrap:anywhere;color:#c0cbd0}.device-meter strong{font-size:16px;font-variant-numeric:tabular-nums;color:var(--accent)}.device-meter>span>small{display:block;font-size:10px;color:var(--muted)}
@container(max-width:640px){
  .solar-scene{margin:10px;border-radius:16px}.scene-sky{grid-template-columns:1fr;gap:0;padding:9px 8px 7px}
  .scene-sky .lead{padding:4px 7px 2px}.scene-sky .lead h3{margin:0}.scene-sky .big{font-size:43px}
  .scene-sky .capacity{margin-top:3px}.solar-scene .board{min-height:258px}.solar-scene .board[data-extra="true"]{min-height:396px}
  .solar-scene .node .oled-art{width:min(100%,75px);height:60px}.solar-scene .node--inverter .oled-art{width:56px;height:51px}
  .scene-balance{padding:8px 11px;gap:8px}.scene-balance-row{grid-template-columns:55px 1fr;gap:4px 7px;font-size:11px}.scene-key{grid-column:2}
  .device-section{margin-inline:10px}.device-strip{grid-template-columns:repeat(auto-fit,minmax(min(137px,100%),1fr))}
}
@container(max-width:420px){.controls{flex-wrap:wrap}.tabs button,.tool{padding-inline:8px}}
@container(max-width:355px){.controls{justify-content:flex-start}.scene-sky .big{font-size:36px}}

.scene-ribbons{display:none;max-width:100%;width:100%;overflow:visible}.ribbon,.ribbon-shimmer,.ribbon-guide{fill:none}.ribbon{stroke:var(--ribbon);opacity:.66}
.ribbon-guide{stroke:#7a939c65;stroke-dasharray:3 5}.ribbon-shimmer{stroke:#fff;stroke-width:1.3;opacity:.68;stroke-dasharray:4 15;stroke-linecap:round;animation:ribbon-flow 6s linear infinite}
@keyframes ribbon-flow{to{stroke-dashoffset:-95}}
:host([data-hidden]) .ribbon-shimmer,:host([data-motion="off"]) .ribbon-shimmer{display:none}
@container(min-width:641px){
  .scene-balance{grid-template-columns:minmax(115px,1fr) minmax(180px,2.3fr) minmax(115px,1fr);align-items:center;gap:8px 15px;padding-block:9px}
  .scene-ribbons{display:block;height:80px}.scene-balance-row{grid-template-columns:1fr;gap:5px}.scene-segments{display:none}
  .scene-balance-row:last-of-type{text-align:right}.scene-balance-row:last-of-type .scene-key{justify-content:flex-end}.scene-balance>small{grid-column:1/-1;text-align:center}
}
@media(prefers-reduced-motion:reduce){.ribbon-shimmer{display:none}}

.node-caption{display:contents}
.solar-scene{border-radius:17px;border-color:#344348}
.scene-sky::before{background:linear-gradient(90deg,#070e16f5,#0a141959 46%,#14171b20),linear-gradient(0deg,#091216 1%,transparent 32%),var(--landscape) center 71%/cover}
.scene-sky .lead .big{letter-spacing:-.045em}
.scene-photo-button{position:absolute;z-index:3;top:12px;right:12px;min-height:42px;padding:0 13px;border:1px solid #adbfcb60;border-radius:9px;background:#0e1822eb;color:#f7f4ec;font-size:12px;font-weight:650}
.scene-photo-button:hover,.scene-photo-button[aria-expanded="true"]{background:#243441;border-color:#d8e6ef9e}
.solar-scene .board[data-photo="true"]{min-height:355px;background:#0d141d}
.solar-scene .board[data-photo="true"][data-extra="true"]{min-height:468px}
.solar-scene .board[data-photo="true"]::before{display:none}
.house-scene-picture{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.house-scene-image{width:100%;height:100%;display:block;object-fit:cover;object-position:var(--house-x,50%) var(--house-y,48%)}
.house-scene-picture::after{position:absolute;inset:0;content:"";background:
  linear-gradient(180deg,#080e18a6 0%,#080e1814 29%,#080e1800 53%,#090e17c9 100%),
  linear-gradient(90deg,#060e1782 0%,transparent 27%,transparent 73%,#060e1782 100%),
  rgb(6 13 22 / var(--house-shade,.31))}
.board[data-solar="off"] .house-scene-image{filter:saturate(.76) brightness(.83)}
.board[data-photo="true"] .node-caption{display:flex;flex-direction:column;align-items:center;gap:2px;max-width:100%;min-width:min(100%,76px);padding:6px 7px;background:#0a131df0;border:1px solid color-mix(in srgb,var(--accent) 35%,#16202e);border-radius:10px}
.board[data-photo="true"] .node .name,.board[data-photo="true"] .node .readout,.board[data-photo="true"] .node .sub{background:transparent;padding:0;text-shadow:none;margin:0}
.board[data-photo="true"] .node--home .oled-art{width:83px;height:75px}
.board[data-photo="true"] .node .oled-art{filter:drop-shadow(0 6px 10px #02060caa)}
.board[data-photo="true"] .node[data-status="idle"] .oled-art{filter:saturate(.5) brightness(.75) drop-shadow(0 6px 10px #02060caa)}
.board[data-photo="true"] .wire-live{filter:drop-shadow(0 0 2px #05101c) drop-shadow(0 0 4px var(--wire))}
.house-settings{border-color:#52606a;background:#111a22;padding:14px 16px}
.house-settings h3{margin-bottom:8px}.house-settings p{margin:6px 0;color:#c6d2dc;font-size:12px;max-width:68ch}
.house-upload{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.house-settings label{display:grid;gap:5px;font-size:12px;font-weight:650}
.house-settings input[type="file"]{color:#e0eaf0;max-width:100%;font:inherit;min-height:44px;cursor:pointer}
.house-settings input::file-selector-button{font:inherit;min-height:42px;border:1px solid #667585;background:#263746;color:#f6f7fa;border-radius:8px;margin-right:8px;padding:0 10px;cursor:pointer}
.house-frame-editor{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:10px}
.house-photo-preview{position:relative;width:158px;height:76px;border-radius:8px;overflow:hidden;background:#0a131b;flex:none}
.house-sliders{flex:1 1 230px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:7px 16px;margin-top:9px}
.house-sliders label>span{display:flex;justify-content:space-between;gap:8px}
.house-sliders input{width:100%;min-height:35px;accent-color:var(--solar);margin:0}
.house-sliders output{color:#f7daa1;white-space:nowrap}
.house-settings input:focus-visible{outline:2px solid var(--solar);outline-offset:2px}
.house-settings .house-photo-status:not(:empty){color:#f7daa1}
@container(max-width:640px){
  .solar-scene .board[data-photo="true"]{min-height:284px}.solar-scene .board[data-photo="true"][data-extra="true"]{min-height:410px}
  .scene-photo-button{top:8px;right:8px;padding:0 8px;font-size:11px;min-height:37px}
  .board[data-photo="true"] .node--home .oled-art{width:65px;height:57px}
  .board[data-photo="true"] .node-caption{padding:4px 4px;min-width:min(100%,58px)}
}
`;
