import os
import re

fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Deduplicate editTerm
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
# Replace multiple occurrences with nothing, then add it exactly once
while dup_methods in content:
    content = content.replace(dup_methods, '')

idx = content.find('  const activateTerm')
if idx != -1:
    content = content[:idx] + dup_methods + content[idx:]

# 2. Add missing )} before </Card>
# The structure currently is:
#             />
#         </div>
#       </Card>
bad_end = '''            />
        </div>
      </Card>'''
good_end = '''            />
          </div>
        )}
      </Card>'''

content = content.replace(bad_end, good_end)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed dupes and syntax")
