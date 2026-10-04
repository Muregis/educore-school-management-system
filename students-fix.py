import os
fp = 'src/pages/StudentsPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'import StatCard' not in content:
    content = content.replace('import Badge from "../components/ui/Badge";', 'import Badge from "../components/ui/Badge";\nimport StatCard from "../components/ui/StatCard";')

# Replace stats
old_stats = '''          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Badge text={Total: } variant="success" />
            <Badge text={Boys: } variant="primary" />
            <Badge text={Girls: } variant="warning" />
          </div>'''

new_stats = '''          <div className="ec-grid-auto">
            <StatCard label="Total Students" value={filtered.length} icon="🎓" tone="primary" />
            <StatCard label="Boys" value={filtered.filter(s => s.gender === "male").length} icon="👦" tone="info" />
            <StatCard label="Girls" value={filtered.filter(s => s.gender === "female").length} icon="👧" tone="warning" />
          </div>'''
content = content.replace(old_stats, new_stats)

# Replace filter card grid
old_filter = '''        <Card style={{ padding: "var(--space-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", alignItems: "end" }}>'''
new_filter = '''        <Card style={{ padding: "var(--space-3)" }}>
          <div className="ec-form-grid ec-form-grid-3">'''
content = content.replace(old_filter, new_filter)

# Replace buttons wrapper
old_btns = '''          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: "var(--space-3)" }}>'''
new_btns = '''          <div className="ec-page-header" style={{ marginTop: "var(--space-3)" }}><div /><div className="ec-page-header-actions">'''
content = content.replace(old_btns, new_btns)
# And close the ec-page-header-actions
content = content.replace('            {canEdit && auth.role !== "finance" && <Button variant="primary" onClick={openAdd}>Add Student</Button>}\n          </div>', '            {canEdit && auth.role !== "finance" && <Button variant="primary" onClick={openAdd}>Add Student</Button>}\n          </div></div>')

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("StudentsPage updated safely")
