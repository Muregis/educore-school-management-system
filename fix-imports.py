import os

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

if 'import Table from' not in content:
    content = content.replace('import Card from "../components/ui/Card";', 'import Card from "../components/ui/Card";\nimport Table from "../components/ui/Table";\nimport Button from "../components/ui/Button";')

# Define dummy editTerm and toggleStatus to avoid crash if clicked
if 'const editTerm' not in content:
    idx = content.find('  if (loading) {')
    if idx != -1:
        methods = '''  const editTerm = (term) => {
    alert("Edit term functionality to be implemented.");
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

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed missing Table and Button imports and missing methods")
