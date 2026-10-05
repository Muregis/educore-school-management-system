import os

fp = 'src/pages/StudentsPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('placeholder="Search name, admission, phone..."', 'placeholder="Search students..."')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated placeholder")
