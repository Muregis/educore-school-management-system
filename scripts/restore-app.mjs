import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const b64Path = join(root, 'src', 'App.jsx.b64');
const outPath = join(root, 'src', 'App.jsx');

if (!existsSync(b64Path)) {
  console.error('[restore-app] missing src/App.jsx.b64');
  process.exit(1);
}

const b64 = readFileSync(b64Path, 'utf8').trim();
const js = gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
if (!js.includes('export default function App')) {
  console.error('[restore-app] decoded App.jsx is invalid');
  process.exit(1);
}
writeFileSync(outPath, js);
console.log('[restore-app] restored src/App.jsx (' + js.length + ' chars)');
