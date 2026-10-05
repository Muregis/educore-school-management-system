import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
if 'import Table from' not in content:
    content = content.replace('import Card from "../components/ui/Card";', 'import Card from "../components/ui/Card";\nimport Table from "../components/ui/Table";\nimport Button from "../components/ui/Button";\nimport EmptyState from "../components/ui/EmptyState";')

# 2. Methods
if 'const editTerm =' not in content:
    methods = '''  const editTerm = (term) => { alert("Edit functionality to be implemented."); };
  const deleteTerm = async (termId) => { alert("Delete functionality to be implemented."); };
  const toggleStatus = async (termId, currentStatus) => {
    if (currentStatus === "active") { alert("Please use 'Close Current Term'."); return; }
    activateTerm(termId);
  };
'''
    idx = content.find('  const activateTerm')
    if idx != -1:
        content = content[:idx] + methods + content[idx:]
    else:
        idx2 = content.find('  if (loading)')
        content = content[:idx2] + methods + content[idx2:]

# 3. Fix inputStyle
style_match = re.search(r'const inputStyle = \{.*?\};\n', content, re.DOTALL)
if style_match:
    style_text = style_match.group(0)
    content = content.replace(style_text, '')
    idx_export = content.find('export default function TermManagementPage')
    content = content[:idx_export] + style_text + '\n' + content[idx_export:]

# 4. Add EmptyState correctly by replacing the ENTIRE Table block
old_table_block_start = '''<div style={{ overflowX: "auto" }}>
          <Table'''
old_table_block_end = '''                  </div>
              ])}
          />
        </div>'''

idx_start = content.find(old_table_block_start)
idx_end = content.find(old_table_block_end) + len(old_table_block_end)

if idx_start != -1 and idx_end != -1:
    old_table_block = content[idx_start:idx_end]
    new_table_block = '''{terms.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No Terms Configured"
            description="There are no academic terms in the system yet."
            actionLabel="Create First Term"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          ''' + old_table_block + '''
        )}'''
    content = content[:idx_start] + new_table_block + content[idx_end:]

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch applied successfully")
