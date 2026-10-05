import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add missing imports
if 'import Table from' not in content:
    content = content.replace('import Card from "../components/ui/Card";', 'import Card from "../components/ui/Card";\nimport Table from "../components/ui/Table";\nimport Button from "../components/ui/Button";\nimport EmptyState from "../components/ui/EmptyState";')

# 2. Add missing functions
idx = content.find('  const toggleStatus')
if idx != -1:
    methods = '''  const editTerm = (term) => {
    alert("Edit term functionality to be implemented.");
  };

  const deleteTerm = async (termId) => {
    alert("Delete term functionality to be implemented.");
  };

  const toggleStatus = async (termId, currentStatus) => {
    if (currentStatus === "active") {
      alert("Please use the 'Close Current Term' button above.");
      return;
    }
    activateTerm(termId);
  };

'''
    content = content[:idx] + methods + content[idx:]

# If the script did not find toggleStatus, let's inject before loading block
if 'const editTerm =' not in content:
    idx2 = content.find('  if (loading) {')
    methods = '''  const editTerm = (term) => {
    alert("Edit term functionality to be implemented.");
  };

  const deleteTerm = async (termId) => {
    alert("Delete term functionality to be implemented.");
  };

  const toggleStatus = async (termId, currentStatus) => {
    if (currentStatus === "active") {
      alert("Please use the 'Close Current Term' button above.");
      return;
    }
    activateTerm(termId);
  };

'''
    content = content[:idx2] + methods + content[idx2:]

# 3. Fix inputStyle
style_match = re.search(r'const inputStyle = \{.*?\};\n', content, re.DOTALL)
if style_match:
    style_text = style_match.group(0)
    content = content.replace(style_text, '')
    idx_export = content.find('export default function TermManagementPage')
    content = content[:idx_export] + style_text + '\n' + content[idx_export:]

# 4. Add EmptyState correctly
table_start = '''<div style={{ overflowX: "auto" }}>
          <Table'''
new_table_start = '''{terms.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No Terms Configured"
            description="There are no academic terms in the system yet."
            actionLabel="Create First Term"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table'''
content = content.replace(table_start, new_table_start)

# 5. Fix end of table block
table_end = '''              />
        </div>
      </Card>'''
new_table_end = '''              />
          </div>
        )}
      </Card>'''
content = content.replace(table_end, new_table_end)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed everything cleanly")
