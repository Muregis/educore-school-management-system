import os

fp = 'src/pages/LoginView.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('color: "var(--color-text-primary)"', 'color: "#ffffff"')
content = content.replace('color: "var(--color-text-secondary)"', 'color: "#8ea3c4"')
content = content.replace('color: "var(--color-text-muted)"', 'color: "#64748b"')
content = content.replace('color: "var(--color-primary)"', 'color: "#3B82F6"')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed signup colors")
