import os
import re

fp = 'src/pages/GradesPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the specific useEntitySync line
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'useEntitySync({ url: `/grades${currentTerm' in line:
        lines[i] = '''  const fetchTerm = term === "all" ? null : (term || currentTerm);
  const fetchUrl = fetchTerm ? `/grades?term=${encodeURIComponent(fetchTerm)}` : `/grades`;
  useEntitySync({ url: fetchUrl, token: auth?.token, setter: setResults, dependencies: [fetchUrl], enabled: true });'''
        break

content = '\n'.join(lines)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated GradesPage properly")
