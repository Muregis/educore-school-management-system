import os
import re

fp = 'src/pages/AdminAccountsPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# First Table (Staff)
staff_regex = r'(<Table\s+headers=\{\["Name", "Email", "Phone", "Role", "Status", "Actions"\]\}.*?rows=\{staffRows\.map.*?\]\)}\s*)/>'
staff_mobile = r'''renderMobileCard={(_row, i) => {
                      const s = staffRows[i];
                      if (!s) return null;
                      return (
                        <div key={s.id} className="ui-table-mobile-card" style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--color-text-primary)" }}>{s.name}</div>
                              <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: 4 }}>{s.email}</div>
                            </div>
                            <Badge text={s.status} tone={s.status === "active" ? "success" : "danger"} />
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                            <div><strong>Phone:</strong> {s.phone || "—"}</div>
                            <div style={{ marginTop: 4 }}><Badge text={s.role} tone={roleTone(s.role)} /></div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                            <Btn variant="ghost" onClick={() => openEditStaff(s)}>Edit</Btn>
                            <Btn variant="ghost" onClick={() => toggleStaffStatus(s)}>
                              {s.status === "active" ? "Deactivate" : "Activate"}
                            </Btn>
                          </div>
                        </div>
                      );
                    }}
                  />'''
content = re.sub(staff_regex, r'\1' + staff_mobile, content, flags=re.DOTALL)

# Second Table (Portal)
portal_regex = r'(<Table\s+headers=\{\["Name", "Role", "Student", "Class", "Admission", "Status", "Actions"\]\}.*?rows=\{portalRows\.map.*?\]\)}\s*)/>'
portal_mobile = r'''renderMobileCard={(_row, i) => {
                      const a = portalRows[i];
                      if (!a) return null;
                      return (
                        <div key={a.id} className="ui-table-mobile-card" style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--color-text-primary)" }}>{a.name}</div>
                              <div style={{ marginTop: 4 }}><Badge text={a.role} tone={roleTone(a.role)} /></div>
                            </div>
                            <Badge text={a.status} tone={a.status === "active" ? "success" : "danger"} />
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                            <div><strong>Student:</strong> {a.studentName || "—"}</div>
                            <div><strong>Class:</strong> {a.className || "—"}</div>
                            <div><strong>Admission:</strong> {a.admission || "—"}</div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                            <Btn variant="ghost" onClick={() => togglePortalStatus(a)}>
                              {a.status === "active" ? "Deactivate" : "Activate"}
                            </Btn>
                            <Btn variant="ghost" onClick={() => resetPortalPassword(a)}>Reset Password</Btn>
                          </div>
                        </div>
                      );
                    }}
                  />'''
content = re.sub(portal_regex, r'\1' + portal_mobile, content, flags=re.DOTALL)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("AdminAccountsPage updated safely")
