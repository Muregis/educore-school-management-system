import os

fp = 'src/pages/DashboardPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

stagger_in = '''  return (
    <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>'''

checklist = '''  const isEmptyTenant = (auth?.role === "director" || auth?.role === "superadmin") && totalStudents === 0 && teachers.length === 0 && feeStructures.length === 0;

  return (
    <div className="stagger-in" style={{ display: "grid", gap: "var(--space-4)" }}>
      {isEmptyTenant && (
        <Card style={{ border: "1px solid var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-card))" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
            <div style={{ background: "var(--color-primary)", color: "white", padding: 8, borderRadius: "50%" }}>🚀</div>
            <div>
              <h3 style={{ margin: "0 0 8px", color: "var(--color-text-primary)" }}>Welcome to EduCore</h3>
              <p style={{ margin: "0 0 16px", color: "var(--color-text-secondary)", fontSize: 14 }}>Let's get your school set up. Complete these steps to start managing operations.</p>
              <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: feeStructures.length > 0 ? "var(--color-success)" : "var(--color-text-primary)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: feeStructures.length > 0 ? "none" : "1px solid var(--color-border)", background: feeStructures.length > 0 ? "var(--color-success)" : "transparent", color: "white", display: "grid", placeItems: "center", fontSize: 10 }}>{feeStructures.length > 0 && "✓"}</div>
                  Create a Fee Structure (Fees Module)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: totalStudents > 0 ? "var(--color-success)" : "var(--color-text-primary)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: totalStudents > 0 ? "none" : "1px solid var(--color-border)", background: totalStudents > 0 ? "var(--color-success)" : "transparent", color: "white", display: "grid", placeItems: "center", fontSize: 10 }}>{totalStudents > 0 && "✓"}</div>
                  Add your first Student
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: teachers.length > 0 ? "var(--color-success)" : "var(--color-text-primary)" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: teachers.length > 0 ? "none" : "1px solid var(--color-border)", background: teachers.length > 0 ? "var(--color-success)" : "transparent", color: "white", display: "grid", placeItems: "center", fontSize: 10 }}>{teachers.length > 0 && "✓"}</div>
                  Invite a Teacher
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}'''

content = content.replace(stagger_in, checklist)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added Empty Tenant Checklist")
