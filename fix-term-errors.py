import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add deleteTerm
idx = content.find('  const toggleStatus')
if idx != -1:
    methods = '''  const deleteTerm = async (termId) => {
    alert("Delete term functionality to be implemented.");
  };

'''
    content = content[:idx] + methods + content[idx:]

# 2. Move inputStyle to the top
style_match = re.search(r'const inputStyle = \{.*?\};\n', content, re.DOTALL)
if style_match:
    style_text = style_match.group(0)
    content = content.replace(style_text, '')
    
    idx_export = content.find('export default function TermManagementPage')
    content = content[:idx_export] + style_text + '\n' + content[idx_export:]

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed deleteTerm and inputStyle")
