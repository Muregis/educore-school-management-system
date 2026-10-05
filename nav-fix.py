import os
import re

fp = 'src/App.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'<span>\{n\.label\.length > 8 \? n\.label\.slice\(0,7\)\+[^:]+ : n\.label\}</span>',
    r'<span>{n.label === "Dashboard" ? "Home" : n.label === "Attendance" ? "Att." : n.label}</span>',
    content
)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated nav labels regex")
