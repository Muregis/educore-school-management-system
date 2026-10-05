import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all existing definitions of editTerm, deleteTerm, toggleStatus
content = re.sub(r'\s*const editTerm = [^}]+};\n', '', content)
content = re.sub(r'\s*const deleteTerm = [^}]+};\n', '', content)
content = re.sub(r'\s*const toggleStatus = [^}]+};\n', '', content)

dup_methods = '''  const editTerm = (term) => {
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

idx = content.find('  const activateTerm')
if idx != -1:
    content = content[:idx] + dup_methods + content[idx:]

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed duplicates forcefully via regex")
