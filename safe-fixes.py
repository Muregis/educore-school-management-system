import os
import re

# 1. Fix design-system.css
dsPath = 'src/styles/design-system.css'
with open(dsPath, 'r', encoding='utf-8') as f:
    ds = f.read()

ds = re.sub(r'background:\s*radial-gradient[^;]+;\n', 'background: var(--color-bg-base);\n', ds)
ds = re.sub(r'\.ui-card:hover,\n\.premium-card:hover\s*\{[\s\S]*?\}', '.ui-card:hover,\n.premium-card:hover {\n  border-color: var(--color-border-strong);\n  box-shadow: var(--shadow-md);\n}', ds)
ds = re.sub(r'\.ui-btn:not\(:disabled\):hover\s*\{[\s\S]*?\}', '.ui-btn:not(:disabled):hover {\n  filter: brightness(1.08);\n}', ds)
ds = re.sub(r'\.stagger-in\s*>\s*\*\s*\{[\s\S]*?animation-delay:\s*200ms;\s*\}', '.stagger-in > * {\n  animation: fadeIn var(--transition-base) both;\n}', ds)
ds = re.sub(r'\.animate-in\s*\{[\s\S]*?\}', '.animate-in {\n}', ds)

with open(dsPath, 'w', encoding='utf-8') as f:
    f.write(ds)

# 2. Fix layout-foundation.css
lfPath = 'src/styles/layout-foundation.css'
with open(lfPath, 'r', encoding='utf-8') as f:
    lf = f.read()

if '.ec-form-grid' not in lf:
    lf += '''
/* ---- Standard page patterns ---- */
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
.ui-table td:first-child, .ui-table th:first-child { min-width: 140px; }
'''
    with open(lfPath, 'w', encoding='utf-8') as f:
        f.write(lf)

# 3. Fix Stat.jsx
statPath = 'src/components/ui/Stat.jsx'
with open(statPath, 'r', encoding='utf-8') as f:
    stat = f.read()
stat = re.sub(r'wordBreak:\s*["\']break-all["\']', 'wordBreak: "break-word"', stat)
with open(statPath, 'w', encoding='utf-8') as f:
    f.write(stat)

# 4. Bulk Grid replacements in src/pages/*.jsx
dir_path = 'src/pages'
files = [f for f in os.listdir(dir_path) if f.endswith('.jsx')]
reps = 0
for file in files:
    fp = os.path.join(dir_path, file)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    
    content = re.sub(r'style=\{\{\s*display:\s*[\'"]grid[\'"],\s*gridTemplateColumns:\s*[\'"]1fr 1fr[\'"],\s*gap:\s*[\'"]var\(--space-\d\)[\'"](?:,\s*marginBottom:\s*[\'"]var\(--space-\d\)[\'"])?\s*\}\}', 'className="ec-form-grid ec-form-grid-2"', content)
    content = re.sub(r'style=\{\{\s*display:\s*[\'"]grid[\'"],\s*gridTemplateColumns:\s*[\'"]repeat\(auto-fit,\s*minmax\(180px,\s*1fr\)\)[\'"],\s*gap:\s*[\'"]var\(--space-\d\)[\'"],\s*alignItems:\s*[\'"]end[\'"]\s*\}\}', 'className="ec-form-grid ec-form-grid-3"', content)
    content = re.sub(r'style=\{\{\s*display:\s*[\'"]grid[\'"],\s*gridTemplateColumns:\s*[\'"]repeat\(auto-fit,\s*minmax\(min\(100%,\s*160px\),\s*1fr\)\)[\'"],\s*gap:\s*[\'"]var\(--space-\d\)[\'"]\s*\}\}', 'className="ec-grid-auto"', content)
    
    if content != orig:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        reps += 1
print('Bulk grids replaced in ' + str(reps) + ' pages')
