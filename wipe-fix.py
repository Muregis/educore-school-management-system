import os

fp = 'src/hooks/useLocalState.js'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('educore.entityCacheCleared.v2', 'educore.entityCacheCleared.v3')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated wipe flag to v3")
