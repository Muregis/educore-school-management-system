import os

fp = 'src/pages/DashboardPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('No grades found for . Switch terms in Grades page.', '`No grades found for ${currentTerm}. Switch terms in Grades page.`')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed another template string")
