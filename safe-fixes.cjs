const fs = require('fs');
const path = require('path');

// 1. Fix design-system.css
const dsPath = 'src/styles/design-system.css';
let ds = fs.readFileSync(dsPath, 'utf8');
ds = ds.replace(/background:\s*radial-gradient[^;]+;\n/g, 'background: var(--color-bg-base);\n');
ds = ds.replace(/\.ui-card:hover,\n\.premium-card:hover\s*\{[\s\S]*?\}/, '.ui-card:hover,\n.premium-card:hover {\n  border-color: var(--color-border-strong);\n  box-shadow: var(--shadow-md);\n}');
ds = ds.replace(/\.ui-btn:not\(:disabled\):hover\s*\{[\s\S]*?\}/, '.ui-btn:not(:disabled):hover {\n  filter: brightness(1.08);\n}');
ds = ds.replace(/\.stagger-in\s*>\s*\*\s*\{[\s\S]*?animation-delay:\s*200ms;\s*\}/, '.stagger-in > * {\n  animation: fadeIn var(--transition-base) both;\n}');
ds = ds.replace(/\.animate-in\s*\{[\s\S]*?\}/, '.animate-in {\n}');
fs.writeFileSync(dsPath, ds, 'utf8');
console.log('Fixed design-system.css');

// 2. Fix layout-foundation.css
const lfPath = 'src/styles/layout-foundation.css';
let lf = fs.readFileSync(lfPath, 'utf8');
if (!lf.includes('.ec-form-grid')) {
  lf += \n/* ---- Standard page patterns ---- */
.ec-page-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.ec-page-header-actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
.ec-form-grid { display: grid; gap: var(--space-3); grid-template-columns: 1fr; align-items: end; }
@media screen and (min-width: 640px) {
  .ec-form-grid-2 { grid-template-columns: 1fr 1fr; }
  .ec-form-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
}
@media screen and (max-width: 639px) {
  .ec-form-grid .ec-form-actions { display: grid; gap: var(--space-2); grid-template-columns: 1fr 1fr; }
}
.ec-grid-auto .ui-card, .ec-grid-auto .premium-card { contain: none; overflow: visible; }
@media screen and (max-width: 767px) {
  .ec-page-content .ec-form-grid { grid-template-columns: 1fr !important; }
  .ec-page-content .ec-form-grid .ec-form-actions { grid-template-columns: 1fr; }
  .ec-page-content div[style*="display: grid"], .ec-page-content div[style*="display:grid"],
  .ui-modal-content div[style*="display: grid"], .ui-modal-content div[style*="display:grid"],
  [data-modal-panel] div[style*="display: grid"], [data-modal-panel] div[style*="display:grid"] { grid-template-columns: 1fr !important; }
  .ec-page-content [style*="minWidth"], .ec-page-content [style*="min-width"] { min-width: 0 !important; }
  .ec-page-content input, .ec-page-content select, .ec-page-content textarea,
  .ui-modal-content input, .ui-modal-content select, .ui-modal-content textarea { width: 100% !important; max-width: 100% !important; box-sizing: border-box; }
}
.ui-table td, .ui-table-mobile-value { white-space: normal !important; overflow-wrap: break-word !important; word-break: normal !important; text-overflow: unset !important; max-width: 100%; line-height: 1.4; }
.ui-table-mobile-card { padding: 16px !important; }
.ui-table-mobile-row { align-items: flex-start !important; gap: 12px !important; padding: 10px 0 !important; }
.ui-table-mobile-label { flex-shrink: 0; min-width: 88px; }
.ui-table-mobile-value { text-align: right; min-width: 0; flex: 1; font-weight: 600; }
.ui-table td:first-child, .ui-table th:first-child { min-width: 140px; }\n;
  fs.writeFileSync(lfPath, lf, 'utf8');
  console.log('Fixed layout-foundation.css');
}

// 3. Fix Stat.jsx
const statPath = 'src/components/ui/Stat.jsx';
let stat = fs.readFileSync(statPath, 'utf8');
stat = stat.replace(/wordBreak:\s*["']break-all["']/g, 'wordBreak: "break-word"');
fs.writeFileSync(statPath, stat, 'utf8');
console.log('Fixed Stat.jsx');

// 4. Bulk Grid replacements in src/pages/*.jsx
const dir = 'src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));
let reps = 0;
for (const file of files) {
  const fp = path.join(dir, file);
  let content = fs.readFileSync(fp, 'utf8');
  let orig = content;

  // Replace standard 1fr 1fr modal grids
  content = content.replace(
    /style=\{\{\s*display:\s*['"]grid['"],\s*gridTemplateColumns:\s*['"]1fr 1fr['"],\s*gap:\s*['"]var\(--space-\d\)['"](?:,\s*marginBottom:\s*['"]var\(--space-\d\)['"])?\s*\}\}/g,
    'className="ec-form-grid ec-form-grid-2"'
  );

  // Replace auto-fit grids for filters (like 180px, 1fr)
  content = content.replace(
    /style=\{\{\s*display:\s*['"]grid['"],\s*gridTemplateColumns:\s*['"]repeat\(auto-fit,\s*minmax\(180px,\s*1fr\)\)['"],\s*gap:\s*['"]var\(--space-\d\)['"],\s*alignItems:\s*['"]end['"]\s*\}\}/g,
    'className="ec-form-grid ec-form-grid-3"'
  );

  // Replace auto-fit grids with 160px (often used in forms/stats)
  content = content.replace(
    /style=\{\{\s*display:\s*['"]grid['"],\s*gridTemplateColumns:\s*['"]repeat\(auto-fit,\s*minmax\(min\(100%,\s*160px\),\s*1fr\)\)['"],\s*gap:\s*['"]var\(--space-\d\)['"]\s*\}\}/g,
    'className="ec-grid-auto"'
  );

  if (content !== orig) {
    fs.writeFileSync(fp, content, 'utf8');
    reps++;
  }
}
console.log('Bulk grids replaced in ' + reps + ' pages');
