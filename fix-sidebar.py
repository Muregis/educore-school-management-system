import os
import re

fp = 'src/components/SidebarModern.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

items_to_beta = [
    "expenditures", "mpesa-reconcile", "reportcards", "admissions", "bulk-import",
    "timetable", "discipline", "communication", "staff", "hr", "library", "transport",
    "exams", "announcements", "subjects", "invoices", "lessonplans"
]

for item_id in items_to_beta:
    pattern = r'(\{ *id: *"' + item_id + r'"[^}]*)\}'
    content = re.sub(pattern, r'\1, isBeta: true }', content)

render_str = '''          <Icon size={17} />
        </span>
        {!collapsed && (
          <span style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "space-between" }}>
            {item.label}
            {item.isBeta && (
              <span style={{ fontSize: "9px", background: "color-mix(in srgb, var(--color-warning) 15%, transparent)", color: "var(--color-warning)", padding: "2px 6px", borderRadius: "10px", fontWeight: 800, letterSpacing: "0.05em", marginLeft: "4px" }}>BETA</span>
            )}
          </span>
        )}
      </button>'''

old_render = '''          <Icon size={17} />
        </span>
        {!collapsed && <span>{item.label}</span>}
      </button>'''

content = content.replace(old_render, render_str)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added BETA badges successfully")
