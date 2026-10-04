import os
import re

fp = 'src/pages/UpdateRequestsPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

requests_regex = r'(return tableRow;\s*\}\)\s*)/>'
requests_mobile = r'''return tableRow;
              })}
              renderMobileCard={(_row, i) => {
                const row = rows[i];
                if (!row) return null;
                const student = students.find(s => (s.student_id ?? s.id) === row.studentId);
                const name = student ? ${student.firstName ?? student.first_name}  : "Unknown";
                return (
                  <div key={row.id} className="ui-table-mobile-card" style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--color-text-primary)" }}>{name}</div>
                        <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: 4 }}>{getFieldName(row.field)}</div>
                      </div>
                      <Badge text={row.status} variant={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"} />
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", background: "var(--color-bg-base)", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}>
                      <div><strong style={{ color: "var(--color-text-muted)" }}>Old:</strong><br/>{row.oldValue || "-"}</div>
                      <div><strong style={{ color: "var(--color-text-primary)" }}>New:</strong><br/>{row.newValue}</div>
                    </div>
                    {row.reason && (
                      <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                        <strong>Reason:</strong> {row.reason}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{new Date(row.createdAt).toLocaleDateString()}</span>
                      {isAdmin && row.status === "pending" && (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <Button size="sm" variant="success" onClick={() => updateStatus(row.id, "approved")}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => updateStatus(row.id, "rejected")}>Reject</Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />'''

content = re.sub(requests_regex, requests_mobile, content, flags=re.DOTALL)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("UpdateRequestsPage updated safely")
