import PropTypes from "prop-types";
import { C } from "../lib/theme";

const Sidebar = ({
  auth,
  school,
  page,
  setPage,
  collapsed,
  setSideCollapsed,
  isMobile,
  setDrawerOpen,
  myChildren,
  activeChild,
  linkedStudentId,
  setActiveChildId,
  handleLogout
}) => {
  const roleColors = {
    admin: "#ef4444",
    teacher: "#3b82f6",
    finance: "#10b981",
    hr: "#f59e0b",
    librarian: "#8b5cf6",
    parent: "#ec4899",
    student: "#06b6d4"
  };
  const roleColor = auth?.role ? roleColors[auth.role] || C.accent : C.accent;
  const isParent = auth?.role === "parent";

  // Navigation structure organized by usage frequency and logical grouping
  const navigationGroups = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "📊",
      items: []
    },
    {
      id: "core",
      label: "CORE",
      subtitle: "Daily Use",
      items: [
        { id: "students", label: "Students", icon: "👨‍🎓" },
        { id: "attendance", label: "Attendance", icon: "✅" },
        { id: "grades", label: "Grades", icon: "📝" },
        { id: "fees", label: "Fees", icon: "💰" },
        { id: "mpesa-reconcile", label: "M-Pesa Reconcile", icon: "📱" }
      ]
    },
    {
      id: "operations",
      label: "OPERATIONS",
      subtitle: "Weekly Use",
      items: [
        { id: "reportcards", label: "Report Cards", icon: "📋" },
        { id: "admissions", label: "Admissions", icon: "🚪" },
        { id: "timetable", label: "Timetable", icon: "⏰" },
        { id: "discipline", label: "Discipline", icon: "⚖️" },
        { id: "communication", label: "Communication", icon: "💬" }
      ]
    },
    {
      id: "management",
      label: "MANAGEMENT",
      items: [
        { id: "staff", label: "Staff", icon: "👨‍🏫" },
        { id: "hr", label: "HR", icon: "🧑" },
        { id: "library", label: "Library", icon: "📚" },
        { id: "transport", label: "Transport", icon: "🚌" },
        { id: "lessonplans", label: "Lesson Plans", icon: "📝" }
      ]
    },
    {
      id: "system",
      label: "SYSTEM",
      subtitle: "Admin Only",
      items: [
        { id: "reports", label: "Reports", icon: "📊" },
        { id: "analytics", label: "Analytics", icon: "📈" },
        { id: "accounts", label: "Accounts", icon: "👥" },
        { id: "settings", label: "Settings", icon: "⚙️" }
      ]
    }
  ];

  const handleNavClick = (navId) => {
    setPage(navId);
    if (isMobile) setDrawerOpen(false);
  };

  const renderNavItem = (item, isActive = false) => (
    <button
      key={item.id}
      onClick={() => handleNavClick(item.id)}
      title={collapsed ? item.label : ""}
      style={{
        width: "100%",
        textAlign: "left",
        marginBottom: 2,
        border: `1px solid ${isActive ? C.accentDim : "transparent"}`,
        borderRadius: 8,
        padding: collapsed ? "8px 0" : "8px 12px",
        background: isActive ? C.accentGlow : "transparent",
        color: isActive ? C.accent : C.textSub,
        cursor: "pointer",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
        justifyContent: collapsed ? "center" : "flex-start",
        transition: "all 0.15s ease",
        fontWeight: isActive ? 600 : 400,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
      {!collapsed && isActive && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.accent,
            flexShrink: 0
          }}
        />
      )}
    </button>
  );

  const renderGroup = (group) => {
    if (group.id === "dashboard") {
      return renderNavItem(group, page === "dashboard");
    }

    return (
      <div key={group.id} style={{ marginBottom: collapsed ? 12 : 16 }}>
        {!collapsed && (
          <div style={{
            padding: "4px 12px 6px",
            fontSize: 10,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            borderBottom: `1px solid ${C.border}`,
            marginBottom: 8
          }}>
            {group.label}
            {group.subtitle && (
              <span style={{ fontWeight: 400, marginLeft: 6 }}>
                • {group.subtitle}
              </span>
            )}
          </div>
        )}
        <div style={{ padding: collapsed ? "0 4px" : "0 4px" }}>
          {group.items.map(item => renderNavItem(item, page === item.id))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div style={{
        padding: "16px 12px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 64
      }}>
        {school.logo_url ? (
          <img
            src={school.logo_url}
            alt="Logo"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              objectFit: "cover",
              flexShrink: 0
            }}
          />
        ) : (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: `linear-gradient(135deg, ${C.accent}, #6366f1)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 16,
            color: "#fff",
            letterSpacing: -1
          }}>
            E
          </div>
        )}
        {!collapsed && (
          <div>
            <div style={{
              fontWeight: 800,
              fontSize: 15,
              color: C.text,
              lineHeight: 1.1
            }}>
              EduCore
            </div>
            <div style={{
              fontSize: 10,
              color: C.textMuted,
              marginTop: 2
            }}>
              {school.name}
            </div>
          </div>
        )}
        {isMobile ? (
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              color: C.textMuted,
              cursor: "pointer",
              padding: "3px 8px",
              fontSize: 14
            }}
          >
            ✕
          </button>
        ) : (
          <button
            onClick={() => setSideCollapsed(v => !v)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              color: C.textMuted,
              cursor: "pointer",
              padding: "3px 7px",
              fontSize: 12,
              flexShrink: 0
            }}
          >
            {collapsed ? "▶" : "◀"}
          </button>
        )}
      </div>

      {/* Child Selector for Parents */}
      {!collapsed && isParent && myChildren.length > 0 && (
        <div style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${C.border}`,
          background: C.bg
        }}>
          <div style={{
            fontSize: 10,
            color: C.textMuted,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: 1
          }}>
            Viewing child
          </div>
          {myChildren.length === 1 ? (
            <div style={{
              fontSize: 13,
              color: C.text,
              fontWeight: 600
            }}>
              {activeChild?.firstName} {activeChild?.lastName}
            </div>
          ) : (
            <select
              style={{
                width: "100%",
                background: C.card,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "5px 8px",
                fontSize: 13
              }}
              value={linkedStudentId || ""}
              onChange={e => {
                setActiveChildId(Number(e.target.value));
                setPage("dashboard");
                if (isMobile) setDrawerOpen(false);
              }}
            >
              {myChildren.map(s => {
                const sid = s.id ?? s.student_id;
                const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                return <option key={sid} value={sid}>{name}</option>;
              })}
            </select>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 8px",
        minHeight: 0
      }}>
        {navigationGroups.map(renderGroup)}
      </nav>

      {/* User Profile & Logout */}
      <div style={{
        padding: "10px 8px",
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0
      }}>
        {!collapsed ? (
          <div style={{
            background: C.card,
            borderRadius: 10,
            padding: "10px 12px",
            border: `1px solid ${C.border}`,
            marginBottom: 8
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${roleColor}22`,
                border: `1px solid ${roleColor}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
                color: roleColor,
                flexShrink: 0
              }}>
                {auth?.role === "admin" ? "A" :
                 auth?.role === "teacher" ? "T" :
                 auth?.role === "finance" ? "F" :
                 auth?.role === "hr" ? "H" :
                 auth?.role === "librarian" ? "L" :
                 auth?.role === "parent" ? "P" :
                 auth?.role === "student" ? "S" : "?"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}>
                  {auth?.name}
                </div>
                <div style={{
                  fontSize: 10,
                  color: roleColor,
                  textTransform: "capitalize",
                  fontWeight: 600
                }}>
                  {auth?.role}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${roleColor}22`,
              border: `1px solid ${roleColor}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14,
              color: roleColor
            }}>
              {auth?.role === "admin" ? "A" :
               auth?.role === "teacher" ? "T" :
               auth?.role === "finance" ? "F" :
               auth?.role === "hr" ? "H" :
               auth?.role === "librarian" ? "L" :
               auth?.role === "parent" ? "P" :
               auth?.role === "student" ? "S" : "?"}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: collapsed ? "7px 0" : "7px 12px",
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.textSub,
            cursor: "pointer",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 7,
          }}
          title="Logout"
        >
          <span>⇐</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
};

Sidebar.propTypes = {
  auth: PropTypes.object,
  school: PropTypes.object,
  page: PropTypes.string,
  setPage: PropTypes.func,
  collapsed: PropTypes.bool,
  setSideCollapsed: PropTypes.func,
  isMobile: PropTypes.bool,
  setDrawerOpen: PropTypes.func,
  myChildren: PropTypes.array,
  activeChild: PropTypes.object,
  linkedStudentId: PropTypes.number,
  setActiveChildId: PropTypes.func,
  handleLogout: PropTypes.func,
};

export default Sidebar;