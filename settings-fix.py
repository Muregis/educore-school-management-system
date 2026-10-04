import os
import re

fp = 'src/pages/SettingsPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

users_regex = r'(<Table\s+headers=\{\["Name", "Email", "Role", "Status", "Action"\]\}.*?data=\{users\.map.*?\]\)}\s*)/>'
users_mobile = r'''renderMobileCard={(_row, i) => {
                const u = users[i];
                if (!u) return null;
                return (
                  <div key={u.id} className="ui-table-mobile-card" style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--color-text-primary)" }}>{u.full_name}</div>
                        <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: 4 }}>{u.email}</div>
                      </div>
                      <Badge text={u.status} variant={u.status === "active" ? "success" : "danger"} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Badge text={u.role} variant={u.role === "admin" ? "primary" : u.role === "finance" ? "warning" : u.role === "hr" ? "danger" : u.role === "librarian" ? "success" : "info"} />
                      {u.role !== "admin" && (
                        <Button size="sm" variant="secondary" onClick={() => toggleStatus(u)}>
                          {u.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }}
            />'''

content = re.sub(users_regex, r'\1' + users_mobile, content, flags=re.DOTALL)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("SettingsPage updated safely")
