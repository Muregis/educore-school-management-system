import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const outPath = join(srcDir, 'App.jsx');

let b64 = '';
const single = join(srcDir, 'App.jsx.b64');
if (existsSync(single) && readFileSync(single, 'utf8').trim().length > 1000) {
  b64 = readFileSync(single, 'utf8').trim();
} else {
  const parts = readdirSync(srcDir)
    .filter((f) => /^App\.jsx\.b64\.part\d+$/.test(f))
    .sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  if (!parts.length) {
    console.error('[restore-app] missing App.jsx.b64 or parts');
    process.exit(1);
  }
  b64 = parts.map((f) => readFileSync(join(srcDir, f), 'utf8').trim()).join('');
}

const js = gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
if (!js.includes('export default function App')) {
  console.error('[restore-app] decoded App.jsx is invalid, b64 len=' + b64.length);
  process.exit(1);
}
writeFileSync(outPath, js);
console.log('[restore-app] restored src/App.jsx (' + js.length + ' chars from b64 ' + b64.length + ')');
