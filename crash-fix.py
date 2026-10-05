import os
import re

# 1. TermManagementPage.jsx
fp = 'src/pages/TermManagementPage.jsx'
with open(fp, 'r', encoding='utf-8') as f: content = f.read()
# Fix setTerms
content = re.sub(
    r'setTerms\(Array\.isArray\(allRes\)\s*\?\s*allRes\s*:\s*\[\]\);',
    r'setTerms(Array.isArray(allRes) ? allRes : (Array.isArray(allRes?.data) ? allRes.data : []));',
    content
)
# Ensure actionResult?.summary?.promoted
content = content.replace('actionResult.summary.promoted', 'actionResult.summary?.promoted')
content = content.replace('actionResult.summary.balancesCarriedForward', 'actionResult.summary?.balancesCarriedForward')
with open(fp, 'w', encoding='utf-8') as f: f.write(content)

# 2. AcademicTransitionPage.jsx
fp = 'src/pages/AcademicTransitionPage.jsx'
with open(fp, 'r', encoding='utf-8') as f: content = f.read()
# Fix classes and students
old_classes = 'setClasses(classesRes?.data || classesRes || []);'
new_classes = 'const cls = classesRes?.data || classesRes; setClasses(Array.isArray(cls) ? cls : []);'
content = content.replace(old_classes, new_classes)

old_students = 'setStudents((studentsRes?.data || studentsRes || []).length);'
new_students = 'const st = studentsRes?.data || studentsRes; setStudents(Array.isArray(st) ? st.length : 0);'
content = content.replace(old_students, new_students)

content = content.replace('termResult.summary.promoted', 'termResult.summary?.promoted')
content = content.replace('termResult.summary.balancesCarriedForward', 'termResult.summary?.balancesCarriedForward')
content = content.replace('yearResult.summary.promoted', 'yearResult.summary?.promoted')
content = content.replace('yearResult.summary.balancesCarriedForward', 'yearResult.summary?.balancesCarriedForward')

# Fix promotedCount in YearConfirmModal
content = content.replace('const promotedCount = classes.filter(c => c.next_class_name).length;', 'const promotedCount = Array.isArray(classes) ? classes.filter(c => c.next_class_name).length : 0;')

with open(fp, 'w', encoding='utf-8') as f: f.write(content)

# 3. SettingsPage.jsx (UsersTab)
fp = 'src/pages/SettingsPage.jsx'
with open(fp, 'r', encoding='utf-8') as f: content = f.read()
# Fix UsersTab
old_users = '.then(d => { setUsers(d || []); setLoading(false); })'
new_users = '.then(d => { setUsers(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])); setLoading(false); })'
content = content.replace(old_users, new_users)
# Fix data mapping in SettingsPage UsersTab
content = content.replace('data={users.map', 'data={(Array.isArray(users) ? users : []).map')

with open(fp, 'w', encoding='utf-8') as f: f.write(content)

print("Pages crash fixes applied")
