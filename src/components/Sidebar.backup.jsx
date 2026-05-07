import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";

const NAVIGATION_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "\u{1F4CA}",
    items: []
  },
  {
    id: "core",
    label: "CORE",
    subtitle: "Daily Use",
    items: [
      { id: "students", label: "Students", icon: "\u{1F468}\u200D\u{1F393}" },
      { id: "attendance", label: "Attendance", icon: "\u2714" },
      { id: "grades", label: "Grades", icon: "\u{1F4DD}" },
      { id: "fees", label: "Fees", icon: "\u{1F4B0}" },
      { id: "mpesa-reconcile", label: "M-Pesa Reconcile", icon: "\u{1F4F1}" }
    ]
  },
  {
    id: "operations",
    label: "OPERATIONS",
    subtitle: "Weekly Use",
    items: [
      { id: "reportcards", label: "Report Cards", icon: "\u{1F4CB}" },
      { id: "admissions", label: "Admissions", icon: "\u{1F6AA}" },
      { id: "bulk-import", label: "Import/Export", icon: "\u{1F4C1}" },
      { id: "timetable", label: "Timetable", icon: "\u23F0" },
      { id: "discipline", label: "Discipline", icon: "\u2696\uFE0F" },
      { id: "communication", label: "Communication", icon: "\u{1F4AC}" }
    ]
  },
  {
    id: "management",
    label: "MANAGEMENT",
    items: [
      { id: "staff", label: "Staff", icon: "\u{1F468}\u200D\u{1F3EB}" },
      { id: "hr", label: "HR", icon: "\u{1F9D1}" },
      { id: "library", label: "Library", icon: "\u{1F4DA}" },
      { id: "transport", label: "Transport", icon: "\u{1F68C}" },
      { id: "lessonplans", label: "Lesson Plans", icon: "\u{1F4DD}" },
      { id: "pendingplans", label: "Pending Plans", icon: "\u23F3" }
    ]
  },
  {
    id: "system",
    label: "SYSTEM",
    subtitle: "Admin Only",
    items: [
      { id: "reports", label: "Reports", icon: "\u{1F4CA}" },
      { id: "analytics", label: "Analytics", icon: "\u{1F4C8}" },
      { id: "accounts", label: "Accounts", icon: "\u{1F465}" },
      { id: "settings", label: "Settings", icon: "\u2699\uFE0F" }
    ]
  }
];

// Use design system colors - fallback to semantic colors if needed
const getRoleColor = (role) => {
  const roleColors = {
    admin: "var(--color-rose)",
    teacher: "var(--color-sky)", 
    finance: "var(--color-green)",
    hr: "var(--color-amber)",
    librarian: "var(--color-purple)",
    director: "var(--color-primary)",
    parent: "var(--color-danger)",
    student: "var(--color-teal)"
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
  const roleColor = getRoleColor(auth?.role);
  const isParent = auth?.role === "parent";
  
  // Role-based navigation filtering
  const ROLE_NAV_LIMITS = {
    admin: ["dashboard", "students", "attendance", "grades", "fees", "reportcards", "admissions", "communication", "timetable", "library", "transport", "discipline", "mpesa-reconcile"],
    director: null, // null = all access
    superadmin: null, // null = all access
    teacher: ["dashboard", "grades", "attendance", "timetable", "lessonplans"],
    finance: ["dashboard", "fees", "invoices", "mpesa-reconcile", "reportcards"],
    hr: ["dashboard", "hr", "staff"],
    librarian: ["dashboard", "library"],
    parent: ["dashboard", "grades", "fees", "attendance", "communication"],
    student: ["dashboard", "grades", "attendance", "timetable", "library"],
  };

  // Filter navigation groups based on role and allowed pages
  const filteredGroups = useMemo(() => {
    const roleLimit = ROLE_NAV_LIMITS[auth?.role];
    let groups = NAVIGATION_GROUPS;

    // Apply role-based filtering if limits exist for this role
    if (roleLimit) {
      groups = groups.map(group => ({
        ...group,
        items: group.items.filter(item => roleLimit.includes(item.id))
      })).filter(group => group.id === "dashboard" || group.items.length > 0);
    }

    // Apply additional allowedPages filtering if provided
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

  const renderNavItem = (item, isActive = false) => (
    <button
      key={item.id}
      onClick={() => handleNavClick(item.id)}
      title={collapsed ? item.label : ""}
      style={{
        width: "100%",
        textAlign: "left",
        marginBottom: "var(--space-1)",
        border: `1px solid ${isActive ? "var(--color-primary-muted)" : "transparent"}`,
        borderRadius: "var(--radius-md)",
        padding: collapsed ? "var(--space-2) 0" : "var(--space-2) var(--space-3)",
        background: isActive ? "var(--color-primary-muted)" : "transparent",
        color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
        cursor: "pointer",
        fontSize: "var(--text-sm)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        justifyContent: collapsed ? "center" : "flex-start",
        transition: "all var(--transition-fast)",
        fontWeight: isActive ? "var(--font-semibold)" : "var(--font-normal)",
      }}
      className={isActive ? "focus-ring" : ""}
    >
      <span style={{ fontSize: "var(--text-base)", flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
      {!collapsed && isActive && (
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "var(--radius-full)",
            background: "var(--color-primary)",
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

    const isOpen = openGroup === group.id;
    const hasActiveItem = group.items.some((item) => page === item.id);

    return (
      <div key={group.id} style={{ marginBottom: collapsed ? "var(--space-3)" : "var(--space-4)" }}>
        {!collapsed && (
          <button
            onClick={() => handleGroupClick(group.id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "var(--space-1) var(--space-3) var(--space-2)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--font-bold)",
              color: hasActiveItem ? "var(--color-primary)" : "var(--color-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: `1px solid var(--color-border)`,
              marginBottom: "var(--space-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all var(--transition-fast)"
            }}
          >
            <div>
              {group.label}
              {group.subtitle && (
                <span style={{ fontWeight: "var(--font-normal)", marginLeft: "var(--space-2)" }}>
                  {"\u2022"} {group.subtitle}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: "var(--text-xs)",
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform var(--transition-fast)"
              }}
            >
              {"\u25B6"}
            </span>
          </button>
        )}
        {(!collapsed || isOpen) && (
          <div
            style={{
              padding: "0 var(--space-1)",
              maxHeight: isOpen ? "500px" : "0",
              overflow: "hidden",
              transition: "max-height var(--transition-base)"
            }}
          >
            {group.items.map((item) => renderNavItem(item, page === item.id))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        style={{
          padding: "var(--space-4) var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          minHeight: "64px"
        }}
      >
        {school.logo_url ? (
          <img
            src={school.logo_url}
            alt="Logo"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              objectFit: "cover",
              flexShrink: 0
            }}
          />
        ) : (
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              flexShrink: 0,
              background: "linear-gradient(135deg, var(--color-primary), #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "var(--font-extrabold)",
              fontSize: "var(--text-base)",
              color: "var(--color-text-inverse)",
              letterSpacing: "-1px"
            }}
          >
            E
          </div>
        )}
        {!collapsed && (
          <div>
            <div
              style={{
                fontWeight: "var(--font-extrabold)",
                fontSize: "var(--text-md)",
                color: "var(--color-text-primary)",
                lineHeight: "var(--leading-tight)"
              }}
            >
              EduCore
            </div>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-1)"
              }}
            >
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
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: "var(--space-1) var(--space-2)",
              fontSize: "var(--text-sm)"
            }}
            className="touch-target"
          >
            {"\u2715"}
          </button>
        ) : (
          <button
            onClick={() => setSideCollapsed((v) => !v)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: "var(--space-1) var(--space-2)",
              fontSize: "var(--text-xs)",
              flexShrink: 0
            }}
            className="touch-target"
          >
            {collapsed ? "\u25B6" : "\u25C0"}
          </button>
        )}
      </div>

      {!collapsed && isParent && myChildren.length > 0 && (
        <div
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)"
          }}
        >
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              marginBottom: "var(--space-1)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Viewing child
          </div>
          {myChildren.length === 1 ? (
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-primary)",
                fontWeight: "var(--font-semibold)"
              }}
            >
              {activeChild?.firstName} {activeChild?.lastName}
            </div>
          ) : (
            <select
              style={{
                width: "100%",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-1) var(--space-2)",
                fontSize: "var(--text-sm)"
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

      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-3) var(--space-2)",
          minHeight: 0
        }}
      >
        {filteredGroups.map(renderGroup)}
      </nav>

      <div
        style={{
          padding: "var(--space-3) var(--space-2)",
          borderTop: "1px solid var(--color-border)",
          flexShrink: 0
        }}
      >
        {!collapsed ? (
          <div
            style={{
              background: "var(--color-bg-card)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-3)",
              border: "1px solid var(--color-border)",
              marginBottom: "var(--space-2)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  background: `${roleColor}22`,
                  border: `1px solid ${roleColor}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "var(--font-bold)",
                  fontSize: "var(--text-sm)",
                  color: roleColor,
                  flexShrink: 0
                }}
              >
                {auth?.role === "superadmin" ? "A"
                  : auth?.role === "director" ? "D"
                    : auth?.role === "teacher" ? "T"
                      : auth?.role === "finance" ? "F"
                        : auth?.role === "hr" ? "H"
                          : auth?.role === "librarian" ? "L"
                            : auth?.role === "parent" ? "P"
                              : auth?.role === "student" ? "S" : "?"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-bold)",
                    color: "var(--color-text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {auth?.name}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: roleColor,
                    textTransform: "capitalize",
                    fontWeight: "var(--font-semibold)"
                  }}
                >
                  {auth?.role}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-2)" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-md)",
                background: `${roleColor}22`,
                border: `1px solid ${roleColor}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "var(--font-bold)",
                fontSize: "var(--text-sm)",
                color: roleColor
              }}
            >
              {auth?.role === "superadmin" ? "A"
                : auth?.role === "director" ? "D"
                  : auth?.role === "teacher" ? "T"
                    : auth?.role === "finance" ? "F"
                      : auth?.role === "hr" ? "H"
                        : auth?.role === "librarian" ? "L"
                          : auth?.role === "parent" ? "P"
                            : auth?.role === "student" ? "S" : "?"}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: collapsed ? "var(--space-2) 0" : "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-md)",
            background: "transparent",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontSize: "var(--text-xs)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "var(--space-2)",
          }}
          title="Logout"
          className="touch-target"
        >
          <span>{"\u21D0"}</span>
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
  allowedPages: PropTypes.arrayOf(PropTypes.string),
};

export default Sidebar;
