import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Add Table import if missing
if 'import Table' not in content:
    content = content.replace('import { getSession }', 'import Table from "../components/ui/Table";\nimport { getSession }')
if 'import Badge' not in content:
    content = content.replace('import Table', 'import Badge from "../components/ui/Badge";\nimport Table')

old_table = r'<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>.*?</table>'
old_table_match = re.search(old_table, content, re.DOTALL)
if old_table_match:
    new_table = '''<Table
              headers={["Term", "Year", "Start", "End", "Status", "Actions"]}
              data={terms.map(term => [
                <span key="t" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{term.name}</span>,
                <span key="y" style={{ color: "var(--color-text-secondary)" }}>{term.academic_year}</span>,
                <span key="s" style={{ color: "var(--color-text-secondary)" }}>{new Date(term.start_date).toLocaleDateString()}</span>,
                <span key="e" style={{ color: "var(--color-text-secondary)" }}>{new Date(term.end_date).toLocaleDateString()}</span>,
                <Badge key="st" text={term.status} variant={term.status === "active" ? "success" : "secondary"} />,
                <div key="a" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <Button size="sm" variant="ghost" onClick={() => editTerm(term)}>Edit</Button>
                  <Button size="sm" variant={term.status === "active" ? "secondary" : "primary"} onClick={() => toggleStatus(term.term_id, term.status)}>
                    {term.status === "active" ? "End Term" : "Activate"}
                  </Button>
                  {term.status !== "active" && (
                    <Button size="sm" variant="danger" onClick={() => {
                      if (window.confirm("Delete this term?")) deleteTerm(term.term_id);
                    }}>Delete</Button>
                  )}
                </div>
              ])}
              renderMobileCard={(_row, i) => {
                const term = terms[i];
                if (!term) return null;
                return (
                  <div key={term.term_id} className="ui-table-mobile-card" style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-card)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--color-text-primary)" }}>{term.name}</div>
                        <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: 4 }}>{term.academic_year}</div>
                      </div>
                      <Badge text={term.status} variant={term.status === "active" ? "success" : "secondary"} />
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                      <div><strong>Start:</strong> {new Date(term.start_date).toLocaleDateString()}</div>
                      <div><strong>End:</strong> {new Date(term.end_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                      <Button size="sm" variant="ghost" onClick={() => editTerm(term)}>Edit</Button>
                      <Button size="sm" variant={term.status === "active" ? "secondary" : "primary"} onClick={() => toggleStatus(term.term_id, term.status)}>
                        {term.status === "active" ? "End Term" : "Activate"}
                      </Button>
                    </div>
                  </div>
                );
              }}
            />'''
    content = content[:old_table_match.start()] + new_table + content[old_table_match.end():]

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("TermManagementPage updated safely")
