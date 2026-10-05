import os

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('icon="dY"."', 'icon="📅"')
content = content.replace('A ', '') # Clean up any other weird characters like A that replaced • or |

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed corrupted emojis")
