import os

fp = 'src/pages/GradesPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(r'useEntitySync\(\{ url: \/grades\$\{currentTerm \? \?term=\$\{encodeURIComponent\(currentTerm\)\} : ""\}, token: auth\?\.token, setter: setResults, dependencies: \[currentTerm\] \}\);',
'''  const fetchTerm = term === "all" ? null : (term || currentTerm);
  const fetchUrl = fetchTerm ? /grades?term= : /grades;
  useEntitySync({ url: fetchUrl, token: auth?.token, setter: setResults, dependencies: [fetchUrl], enabled: true });''',
content)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated GradesPage sync via python regex")
