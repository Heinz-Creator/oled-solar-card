import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const path = name => new URL(name, import.meta.url);
const notices = ['astronomy-engine-MIT.txt', 'lumora-studio-MIT.txt']
  .map(name => readFileSync(path('licenses/' + name), 'utf8').trim()).join('\n\n');
const bundle = '/*!\n' + notices + '\n*/\n' + execFileSync(process.argv[2] || 'esbuild', [
  '--sourcefile=oled-solar-card.js', '--bundle', '--format=iife', '--charset=utf8', '--loader:.webp=dataurl',
], { cwd, input: readFileSync(path('solar-card.js')), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
mkdirSync(path('dist'), { recursive: true });
writeFileSync(path('dist/oled-solar-card.js'), bundle);
const preview = readFileSync(path('preview-source.html'), 'utf8');
writeFileSync(path('OLED-Solar-Vorschau.html'), preview.replace('<!-- CARD_BUNDLE -->', () =>
  '<script>\n' + bundle.replace(/<\/script/gi, '<\\/script') + '</script>'));
