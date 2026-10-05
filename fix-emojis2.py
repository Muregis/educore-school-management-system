import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace any invalid icon string with a simple star
content = re.sub(r'icon="[^"]*"\.', 'icon="📅"', content)
content = re.sub(r'icon="dY[^"]*"', 'icon="📅"', content)

# A manual sweep just in case
content = content.replace('icon="dY"."\n', 'icon="📅"\n')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed regex")
