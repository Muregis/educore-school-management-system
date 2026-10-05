import os

fp = 'src/styles/layout-foundation.css'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('minmax(min(100%, 160px), 1fr)', 'minmax(min(100%, 110px), 1fr)')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated grid")
