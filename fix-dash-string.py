import os

fp = 'src/pages/DashboardPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('subtitle={currentTerm ? Grades for  : "Current performance split"}', 'subtitle={currentTerm ? `Grades for ${currentTerm}` : "Current performance split"}')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed Dashboard template string")
