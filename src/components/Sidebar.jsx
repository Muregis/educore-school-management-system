import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";

const NAVIGATION_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "📊",
    items: []
  },
  {
    id: "core",
    label: "CORE • DAILY USE",
    items: [
      { id: "students", label: "Students", icon: "👥" },
      { id: "attendance", label: "Attendance", icon: "✅" },
      { id: "grades", label: "Grades", icon: "🧾" },
      { id: "fees", label: "Fees", icon: "💳" },
      { id: "expenditures", label: "Expenditures", icon: "💸" },
      { id: "mpesa-reconcile", label: "M-Pesa Reconcile", icon: "📱" }
    ]
  },
  {
    id: "operations",
    label: "OPERATIONS • WEEKLY USE",
    items: [
      { id: "reportcards", label: "Report Cards", icon: "📄" },
      { id: "admissions", label: "Admissions", icon: "📝" },
      { id: "bulk-import", label: "Import/Export", icon: "📁" },
      { id: "timetable", label: "Timetable", icon: "🗓️" },
      { id: "discipline", label: "Discipline", icon: "⚖️" },
      { id: "communication", label: "Communication", icon: "💬" }
    ]
  },
  {
    id: "management",
    label: "MANAGEMENT",
    items: [
      { id: "teachers", label: "Teachers", icon: "👩‍🏫" },
      { id: "staff", label: "Staff", icon: "🏫" },
      { id: "hr", label: "HR", icon: "🧑‍💼" },
      { id: "library", label: "Library", icon: "📚" },
      { id: "transport", label: "Transport", icon: "🚌" },
      { id: "exams", label: "Exams", icon: "📝" },
      { id: "announcements", label: "Announcements", icon: "📢" },
      { id: "subjects", label: "Subjects", icon: "📘" },
      { id: "invoices", label: "Invoices", icon: "🧾" },
      { id: "lessonplans", label: "Lesson Plans", icon: "📋" },
    ]
  },
  {
    id: "system",
    label: "SYSTEM • ADMIN ONLY",
    systemOnly: true,
    items: [
      { id: "reports", label: "Reports", icon: "📊" },
      { id: "analytics", label: "Analytics", icon: "📈" },
      { id: "accounts", label: "Accounts", icon: "🔐" },
      { id: "settings", label: "Settings", icon: "⚙️" },
    ]
  }
];

const getRoleColor = (role) => {
  const roleColors = {
    admin: "var(--color-role-admin, #3B82F6)",
    teacher: "var(--color-role-teacher, #06B6D4)", 
    finance: "var(--color-role-finance, #10B981)",
    hr: "var(--color-role-hr, #8B5CF6)",
    librarian: "var(--color-role-librarian, #F59E0B)",
    director: "var(--color-role-director, var(--color-primary))",
    parent: "var(--color-role-parent, #F43F5E)",
    student: "var(--color-role-student, #EC4899)"
  };
  return roleColors[role] || "var(--color-primary)";
};

function findGroupForPage(pageId) {
  const group = NAVIGATION_GROUPS.find(
    (entry) => entry.id === pageId || entry.items.some((item) => item.id === pageId)
  );
  return group?.id ?? null;
}

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
  handleLogout,
  allowedPages = []
}) => {
  const [openGroup, setOpenGroup] = useState(() => findGroupForPage(page));
  const [hoveredNav, setHoveredNav] = useState(null);
  
  const roleColor = getRoleColor(auth?.role);
  const isParent = auth?.role === "parent";

  // ROLE FILTERING LOGIC
  const ROLE_NAV_LIMITS = {
    admin: ["dashboard", "students", "teachers", "subjects", "attendance", "grades", "fees", "expenditures", "invoices", "reportcards", "discipline", "transport", "communication", "timetable", "library", "lessonplans", "announcements", "exams", "admissions", "hr", "bulk-import"],
    director: null, 
    superadmin: null, 
    teacher: ["dashboard", "subjects", "attendance", "grades", "reportcards", "discipline", "timetable", "communication", "library", "analysis", "lessonplans", "announcements", "exams"],
    finance: ["dashboard", "fees", "expenditures", "mpesa-reconcile", "invoices", "announcements", "reports"],
    hr: ["dashboard", "hr", "staff", "expenditures", "announcements"],
    librarian: ["dashboard", "library", "announcements"],
    parent: ["dashboard", "grades", "fees", "attendance", "communication", "announcements"],
    student: ["dashboard", "grades", "attendance", "reportcards", "library", "announcements"],
  };

  const filteredGroups = useMemo(() => {
    const roleLimit = ROLE_NAV_LIMITS[auth?.role];
    let groups = NAVIGATION_GROUPS;

    if (roleLimit) {
      groups = groups.map(group => ({
        ...group,
        items: group.items.filter(item => roleLimit.includes(item.id))
      })).filter(group => group.id === "dashboard" || group.items.length > 0);
    }

    if (allowedPages.length) {
      groups = groups.map(group => ({
        ...group,
        items: group.items.filter(item => allowedPages.includes(item.id))
      })).filter(group => group.id === "dashboard" || group.items.length > 0);
    }

    return groups;
  }, [allowedPages, auth?.role]);

  useEffect(() => {
    setOpenGroup(findGroupForPage(page));
  }, [page]);

  const handleNavClick = (navId) => {
    setOpenGroup(findGroupForPage(navId));
    setPage(navId);
    if (isMobile) setDrawerOpen(false);
  };

  const handleGroupClick = (groupId) => {
    setOpenGroup((currentGroup) => (currentGroup === groupId ? null : groupId));
  };

  const renderNavItem = (item, isActive = false) => {
    const isHovered = hoveredNav === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        onMouseEnter={() => setHoveredNav(item.id)}
        onMouseLeave={() => setHoveredNav(null)}
        title={collapsed ? item.label : ""}
        style={{
          width: "100%",
          textAlign: "left",
          marginBottom: "var(--space-1)",
          borderRadius: "var(--radius-md)",
          padding: collapsed ? "var(--space-3) 0" : "var(--space-2) var(--space-3)",
          background: isActive ? "var(--color-primary-muted)" : (isHovered ? "var(--color-bg-hover)" : "transparent"),
          color: isActive ? "var(--color-primary)" : (isHovered ? "var(--color-text-primary)" : "var(--color-text-secondary)"),
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "all var(--transition-base)",
          fontWeight: isActive ? "600" : "500",
          border: "none",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {isActive && !collapsed && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            height: '60%',
            width: '4px',
            background: 'var(--color-primary)',
            borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
            boxShadow: 'var(--shadow-glow)'
          }} />
        )}
        <span style={{ 
          fontSize: collapsed ? "20px" : "18px", 
          flexShrink: 0,
          transform: isHovered ? "scale(1.1)" : "scale(1)",
          transition: "transform var(--transition-fast)"
        }}>
          {item.icon}
        </span>
        {!collapsed && <span style={{ flex: 1, fontFamily: 'var(--font-body)' }}>{item.label}</span>}
      </button>
    );
  };

  const renderGroup = (group) => {
    if (group.id === "dashboard") {
      return (
        <div key="dashboard" style={{ padding: "0 var(--space-2)", marginBottom: "var(--space-2)" }}>
          {renderNavItem(group, page === "dashboard")}
        </div>
      );
    }

    const isOpen = openGroup === group.id;
    const hasActiveItem = group.items.some((item) => page === item.id);

    return (
      <div key={group.id} style={{ marginBottom: collapsed ? "var(--space-2)" : "var(--space-4)", padding: "0 var(--space-2)" }}>
        {!collapsed && (
          <button
            onClick={() => handleGroupClick(group.id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "var(--space-2) var(--space-3)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all var(--transition-fast)",
              marginBottom: "var(--space-1)",
              borderRadius: "var(--radius-md)"
            }}
          >
            <div>
              <span style={{ 
                fontSize: "11px", 
                fontWeight: "700", 
                color: hasActiveItem ? "var(--color-primary)" : "var(--color-text-muted)", 
                textTransform: "uppercase", 
                letterSpacing: "0.1em",
                fontFamily: "var(--font-heading)"
              }}>
                {group.label}
              </span>
            </div>
            <span
              style={{
                fontSize: "10px",
                color: "var(--color-text-muted)",
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform var(--transition-base)"
              }}
            >
              {"\u25B6"}
            </span>
          </button>
        )}
        {(!collapsed || isOpen) && (
          <div
            style={{
              maxHeight: isOpen ? "800px" : "0",
              opacity: isOpen ? 1 : 0,
              overflow: "hidden",
              transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          >
            {group.items.map((item) => renderNavItem(item, page === item.id))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--color-bg-surface)" }}>
      {/* Brand Header */}
      <div
        style={{
          padding: "var(--space-4)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          minHeight: "72px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-base)",
          position: "relative"
        }}
      >
        {school.logo_url ? (
          <img
            src={school.logo_url}
            alt="Logo"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "var(--radius-md)",
              objectFit: "cover",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}
          />
        ) : (
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "var(--radius-md)",
              flexShrink: 0,
              background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "20px",
              color: "#ffffff",
              boxShadow: "var(--shadow-glow-primary)"
            }}
          >
            🎓
          </div>
        )}
        
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: "800",
                fontSize: "18px",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              EduCore
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: "500"
              }}
            >
              {school.name || "School Portal"}
            </div>
          </div>
        )}

        {isMobile ? (
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "auto"
            }}
          >
            ✕
          </button>
        ) : (
          <button
            onClick={() => setSideCollapsed(!collapsed)}
            style={{
              position: "absolute",
              right: "-12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              boxShadow: "var(--shadow-card)",
              zIndex: 10,
              fontSize: "10px",
              transition: "all var(--transition-fast)"
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "▶" : "◀"}
          </button>
        )}
      </div>

      {/* Parent Switcher */}
      {!collapsed && isParent && myChildren.length > 0 && (
        <div
          style={{
            padding: "var(--space-3)",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg-base)"
          }}
        >
          <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>
            Viewing Child
          </div>
          {myChildren.length === 1 ? (
            <div style={{ fontSize: "14px", color: "var(--color-text-primary)", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--color-primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", fontSize: "10px", fontWeight: "bold" }}>
                {(activeChild?.firstName || activeChild?.first_name || "S")[0]}
              </div>
              {activeChild?.firstName || activeChild?.first_name} {activeChild?.lastName || activeChild?.last_name}
            </div>
          ) : (
            <select
              style={{
                width: "100%",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                fontSize: "13px",
                outline: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)"
              }}
              value={linkedStudentId || ""}
              onChange={(e) => {
                setActiveChildId(Number(e.target.value));
                setOpenGroup(findGroupForPage("dashboard"));
                setPage("dashboard");
                if (isMobile) setDrawerOpen(false);
              }}
            >
              {myChildren.map((s) => {
                const sid = s.id ?? s.student_id;
                const name = s.firstName
                  ? `${s.firstName} ${s.lastName}`
                  : `${s.first_name} ${s.last_name}`;
                return (
                  <option key={sid} value={sid}>
                    {name}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      )}

      {/* Navigation List */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-4) 0",
          minHeight: 0,
          background: "var(--color-bg-surface)"
        }}
      >
        {filteredGroups.map(renderGroup)}
      </nav>

      {/* User Profile / Logout */}
      <div
        style={{
          padding: "var(--space-4)",
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-bg-base)",
          flexShrink: 0
        }}
      >
        {!collapsed ? (
          <div
            style={{
              background: "var(--color-bg-card)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-3)",
              border: "1px solid var(--color-border)",
              marginBottom: "var(--space-3)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              boxShadow: "var(--shadow-card)"
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: `${roleColor}22`,
                border: `1px solid ${roleColor}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "14px",
                color: roleColor,
                flexShrink: 0
              }}
            >
              {auth?.role === "superadmin" ? "A" : auth?.role === "director" ? "D" : auth?.role === "teacher" ? "T" : auth?.role === "finance" ? "F" : auth?.role === "hr" ? "H" : auth?.role === "librarian" ? "L" : auth?.role === "parent" ? "P" : auth?.role === "student" ? "S" : "?"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "var(--color-text-primary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontFamily: "var(--font-body)"
                }}
              >
                {auth?.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: roleColor,
                  textTransform: "capitalize",
                  fontWeight: "600",
                  letterSpacing: "0.02em"
                }}
              >
                {auth?.role === "director" ? "Main Director" : auth?.role}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: `${roleColor}22`,
                border: `1px solid ${roleColor}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "14px",
                color: roleColor
              }}
            >
              {auth?.role === "superadmin" ? "A" : auth?.role === "director" ? "D" : auth?.role === "teacher" ? "T" : auth?.role === "finance" ? "F" : auth?.role === "hr" ? "H" : auth?.role === "librarian" ? "L" : auth?.role === "parent" ? "P" : auth?.role === "student" ? "S" : "?"}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: collapsed ? "var(--space-2) 0" : "var(--space-2) var(--space-4)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-danger-muted)",
            border: "1px solid transparent",
            color: "var(--color-danger)",
            cursor: "pointer",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "var(--space-2)",
            fontWeight: "600",
            transition: "all var(--transition-fast)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-danger)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-danger-muted)';
            e.currentTarget.style.color = 'var(--color-danger)';
          }}
        >
          <span style={{ fontSize: "16px" }}>{"\u23FB"}</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
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
  allowedPages: PropTypes.arrayOf(PropTypes.string),
};

export default Sidebar;
