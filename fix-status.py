import os

fp = 'src/components/SidebarModern.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the bottom part of Sidebar
logout_block = '''              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{school?.name || "EduCore"}</span>
            </div>
          )}
        </div>
      </div>
    </aside>'''

new_logout_block = '''              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{school?.name || "EduCore"}</span>
            </div>
          )}
        </div>
        
        {/* System Status Link */}
        <div style={{ padding: "0 var(--space-4) var(--space-4)", display: "flex", justifyContent: collapsed ? "center" : "flex-start" }}>
          <a href="https://educore-school-management-system.onrender.com/api/health/status" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 600 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-success) 20%, transparent)" }} />
            {!collapsed && "System Status"}
          </a>
        </div>
        
      </div>
    </aside>'''

content = content.replace(logout_block, new_logout_block)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added System Status link")
