const fs = require('fs');
const path = require('path');

const dir = 'src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

let replacements = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

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

  // Replace auto-fit grids with 160px (often used in forms)
  content = content.replace(
    /style=\{\{\s*display:\s*['"]grid['"],\s*gridTemplateColumns:\s*['"]repeat\(auto-fit,\s*minmax\(min\(100%,\s*160px\),\s*1fr\)\)['"],\s*gap:\s*['"]var\(--space-\d\)['"]\s*\}\}/g,
    'className="ec-grid-auto"'
  );

  // Replace top KPI flex wraps that had Cards
  // This is harder via regex, we'll leave it to subagents if needed

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    replacements++;
    console.log('Updated grids in ' + file);
  }
}

console.log('Total files updated: ' + replacements);
