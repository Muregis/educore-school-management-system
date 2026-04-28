import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { C } from "../lib/theme";

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

const ROLE_COLORS = {
  admin: "#ef4444",
  teacher: "#3b82f6",
  finance: "#10b981",
  hr: "#f59e0b",
  librarian: "#8b5cf6",
  director: "#8b5cf6", // Restored director color
  parent: "#ec4899",
  student: "#06b6d4"
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
  const roleColor = auth?.role ? ROLE_COLORS[auth.role] || C.accent : C.accent;
  const isParent = auth?.role === "parent";
  
  // Filter navigation groups based on allowed pages
  const filteredGroups = useMemo(() => {
    if (!allowedPages.length) return NAVIGATION_GROUPS;
    return NAVIGATION_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => allowedPages.includes(item.id))
    })).filter(group => group.id === "dashboard" || group.items.length > 0);
  }, [allowedPages]);

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

    const isOpen = openGroup === group.id;
    const hasActiveItem = group.items.some((item) => page === item.id);

    return (
      <div key={group.id} style={{ marginBottom: collapsed ? 12 : 16 }}>
        {!collapsed && (
          <button
            onClick={() => handleGroupClick(group.id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "4px 12px 6px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              color: hasActiveItem ? C.accent : C.textMuted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              borderBottom: `1px solid ${C.border}`,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.15s ease"
            }}
          >
            <div>
              {group.label}
              {group.subtitle && (
                <span style={{ fontWeight: 400, marginLeft: 6 }}>
                  {"\u2022"} {group.subtitle}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease"
              }}
            >
              {"\u25B6"}
            </span>
          </button>
        )}
        {(!collapsed || isOpen) && (
          <div
            style={{
              padding: "0 4px",
              maxHeight: isOpen ? "500px" : "0",
              overflow: "hidden",
              transition: "max-height 0.3s ease"
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
          padding: "16px 12px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 64
        }}
      >
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
          <div
            style={{
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
            }}
          >
            E
          </div>
        )}
        {!collapsed && (
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
                color: C.text,
                lineHeight: 1.1
              }}
            >
              EduCore
            </div>
            <div
              style={{
                fontSize: 10,
                color: C.textMuted,
                marginTop: 2
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
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              color: C.textMuted,
              cursor: "pointer",
              padding: "3px 8px",
              fontSize: 14
            }}
          >
            {"\u2715"}
          </button>
        ) : (
          <button
            onClick={() => setSideCollapsed((v) => !v)}
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
            {collapsed ? "\u25B6" : "\u25C0"}
          </button>
        )}
      </div>

      {!collapsed && isParent && myChildren.length > 0 && (
        <div
          style={{
            padding: "8px 12px",
            borderBottom: `1px solid ${C.border}`,
            background: C.bg
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.textMuted,
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: 1
            }}
          >
            Viewing child
          </div>
          {myChildren.length === 1 ? (
            <div
              style={{
                fontSize: 13,
                color: C.text,
                fontWeight: 600
              }}
            >
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
          padding: "12px 8px",
          minHeight: 0
        }}
      >
        {filteredGroups.map(renderGroup)}
      </nav>

      <div
        style={{
          padding: "10px 8px",
          borderTop: `1px solid ${C.border}`,
          flexShrink: 0
        }}
      >
        {!collapsed ? (
          <div
            style={{
              background: C.card,
              borderRadius: 10,
              padding: "10px 12px",
              border: `1px solid ${C.border}`,
              marginBottom: 8
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {auth?.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: roleColor,
                    textTransform: "capitalize",
                    fontWeight: 600
                  }}
                >
                  {auth?.role}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div
              style={{
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
