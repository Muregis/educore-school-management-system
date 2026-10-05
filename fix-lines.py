import os

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if line.strip().startswith('const editTerm ='):
        skip = True
    elif line.strip().startswith('const deleteTerm ='):
        skip = True
    elif line.strip().startswith('const toggleStatus ='):
        skip = True
    
    if skip:
        if line.strip() == '};':
            skip = False
        continue
        
    new_lines.append(line)

content = "".join(new_lines)

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
print("Removed duplicates by line parsing")
