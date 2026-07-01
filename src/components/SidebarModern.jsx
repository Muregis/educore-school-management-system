import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Banknote,
  BookMarked,
  BookOpen,
  BriefcaseBusiness,
  BusFront,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Megaphone,
  MessageSquareText,
  NotebookPen,
  ReceiptText,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  School,
  Settings2,
  ShieldAlert,
  Sparkles,
  Users,
  WalletCards,
  FileSpreadsheet,
  BadgeDollarSign,
  UserRoundPlus,
  FileCheck2,
} from "lucide-react";

const NAVIGATION_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [],
  },
  {
    id: "core",
    label: "Core Daily Use",
    icon: Sparkles,
    items: [
      { id: "students", label: "Students", icon: Users },
      { id: "attendance", label: "Attendance", icon: CalendarCheck2 },
      { id: "grades", label: "Grades", icon: BookOpen },
      { id: "fees", label: "Fees", icon: Banknote },
      { id: "expenditures", label: "Expenditures", icon: BadgeDollarSign },
      { id: "mpesa-reconcile", label: "M-Pesa Reconcile", icon: WalletCards },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: FileCheck2,
    items: [
      { id: "reportcards", label: "Report Cards", icon: FileSpreadsheet },
      { id: "admissions", label: "Admissions", icon: UserRoundPlus },
      { id: "bulk-import", label: "Import / Export", icon: ScanSearch },
      { id: "timetable", label: "Timetable", icon: CalendarDays },
      { id: "discipline", label: "Discipline", icon: ShieldAlert },
      { id: "communication", label: "Communication", icon: MessageSquareText },
    ],
  },
  {
    id: "management",
    label: "Management",
    icon: BriefcaseBusiness,
    items: [
      { id: "teachers", label: "Teachers", icon: Users },
      { id: "staff", label: "Staff", icon: School },
      { id: "hr", label: "HR", icon: BriefcaseBusiness },
      { id: "library", label: "Library", icon: LibraryBig },
      { id: "transport", label: "Transport", icon: BusFront },
      { id: "exams", label: "Exams", icon: NotebookPen },
      { id: "announcements", label: "Announcements", icon: Megaphone },
      { id: "subjects", label: "Subjects", icon: BookMarked },
      { id: "invoices", label: "Invoices", icon: ReceiptText },
      { id: "lessonplans", label: "Lesson Plans", icon: FileSpreadsheet },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Banknote,
    items: [
      { id: "trial-balance", label: "Trial Balance", icon: ArrowLeftRight },
      { id: "income-statement", label: "Income Statement", icon: FileSpreadsheet },
      { id: "balance-sheet", label: "Balance Sheet", icon: Banknote },
      { id: "chart-of-accounts", label: "Chart of Accounts", icon: BookMarked },
      { id: "journal-entries", label: "Journal Entries", icon: NotebookPen },
      { id: "general-ledger", label: "General Ledger", icon: BookOpen },
    ],
  },
  {
    id: "system",
    label: "System Admin",
    icon: Settings2,
    systemOnly: true,
    items: [
      { id: "reports", label: "Reports", icon: BarChart3 },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "accounts", label: "Accounts", icon: CircleUserRound },
      { id: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

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

function getRoleColor(role) {
  const roleColors = {
    admin: "var(--color-role-admin, #3B82F6)",
    teacher: "var(--color-role-teacher, #06B6D4)",
    finance: "var(--color-role-finance, #10B981)",
    hr: "var(--color-role-hr, #8B5CF6)",
    librarian: "var(--color-role-librarian, #F59E0B)",
    director: "var(--color-role-director, var(--color-primary))",
    parent: "var(--color-role-parent, #F43F5E)",
    student: "var(--color-role-student, #EC4899)",
  };
  return roleColors[role] || "var(--color-primary)";
}

function findGroupForPage(pageId) {
  const group = NAVIGATION_GROUPS.find((entry) => entry.id === pageId || entry.items.some((item) => item.id === pageId));
  return group?.id ?? null;
}

export default function SidebarModern({
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
  allowedPages = [],
}) {
  const [openGroup, setOpenGroup] = useState(() => findGroupForPage(page));
  const [hoveredNav, setHoveredNav] = useState(null);

  const roleColor = getRoleColor(auth?.role);
  const isParent = auth?.role === "parent";

  const filteredGroups = useMemo(() => {
    const roleLimit = ROLE_NAV_LIMITS[auth?.role];
    let groups = NAVIGATION_GROUPS;

    if (roleLimit) {
      groups = groups
        .map((group) => ({ ...group, items: group.items.filter((item) => roleLimit.includes(item.id)) }))
        .filter((group) => group.id === "dashboard" || group.items.length > 0);
    }

    if (allowedPages.length) {
      groups = groups
        .map((group) => ({ ...group, items: group.items.filter((item) => allowedPages.includes(item.id)) }))
        .filter((group) => group.id === "dashboard" || group.items.length > 0);
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
    const Icon = item.icon || LayoutDashboard;
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
          display: "flex",
          alignItems: "center",
          gap: collapsed ? "0" : "var(--space-3)",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "var(--space-2) 0" : "10px var(--space-3)",
          borderRadius: "var(--radius-md)",
          border: "1px solid transparent",
          background: isActive ? "color-mix(in srgb, var(--color-primary) 14%, transparent)" : isHovered ? "var(--color-bg-hover)" : "transparent",
          color: isActive ? "var(--color-primary)" : isHovered ? "var(--color-text-primary)" : "var(--color-text-secondary)",
          cursor: "pointer",
          fontSize: "var(--text-sm)",
          fontWeight: isActive ? 700 : 600,
          transition: "all var(--transition-base)",
          boxShadow: isActive ? "inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent)" : "none",
          position: "relative",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-md)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            background: isActive ? "color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-card))" : "var(--color-bg-card)",
            color: isActive ? "var(--color-primary)" : "inherit",
            transition: "all var(--transition-fast)",
            boxShadow: isActive ? "0 6px 16px color-mix(in srgb, var(--color-primary) 18%, transparent)" : "none",
          }}
        >
          <Icon size={17} />
        </span>
        {!collapsed && <span style={{ flex: 1, whiteSpace: "nowrap" }}>{item.label}</span>}
      </button>
    );
  };

  const renderGroup = (group) => {
    if (group.id === "dashboard") {
      return (
        <div key="dashboard" style={{ padding: "0 var(--space-2)", marginBottom: "var(--space-3)" }}>
          {renderNavItem(group, page === "dashboard")}
        </div>
      );
    }

    const isOpen = openGroup === group.id;
    const hasActiveItem = group.items.some((item) => page === item.id);
    const GroupIcon = group.icon || Sparkles;

    return (
      <div key={group.id} style={{ padding: "0 var(--space-2)", marginBottom: "var(--space-3)" }}>
        {!collapsed && (
          <button
            onClick={() => handleGroupClick(group.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-2)",
              padding: "8px var(--space-3)",
              marginBottom: "var(--space-2)",
              borderRadius: "var(--radius-md)",
              border: "none",
              background: "transparent",
              color: hasActiveItem ? "var(--color-primary)" : "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
              <GroupIcon size={14} />
              {group.label}
            </span>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {(!collapsed || isOpen) && (
          <div
            style={{
              maxHeight: isOpen ? "900px" : "0",
              opacity: isOpen ? 1 : 0,
              overflow: "hidden",
              transition: "max-height 260ms var(--ease-standard), opacity 220ms var(--ease-standard)",
              display: "grid",
              gap: "var(--space-1)",
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
      <div
        style={{
          padding: "var(--space-4)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          minHeight: "76px",
          borderBottom: "1px solid var(--color-border)",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-base)) 0%, var(--color-bg-base) 100%)",
          position: "relative",
        }}
      >
        {school.logo_url ? (
          <img src={school.logo_url} alt="School logo" style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0, boxShadow: "var(--shadow-sm)" }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--color-text-inverse)", background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))", boxShadow: "var(--shadow-glow-primary)" }}>
            <School size={18} />
          </div>
        )}

        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "17px", color: "var(--color-text-primary)", fontFamily: "var(--font-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              EduCore
            </div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {school.name || "School Portal"}
            </div>
          </div>
        )}

        {isMobile ? (
          <button onClick={() => setDrawerOpen(false)} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", borderRadius: "var(--radius-md)", padding: "8px", cursor: "pointer" }}>
            ✕
          </button>
        ) : (
          <button
            onClick={() => setSideCollapsed(!collapsed)}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-card)",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow: "var(--shadow-sm)",
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        )}
      </div>

      {!collapsed && isParent && myChildren.length > 0 && (
        <div style={{ padding: "var(--space-3)", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-base)" }}>
          <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "var(--space-2)" }}>
            Viewing Child
          </div>
          {myChildren.length === 1 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-primary)", fontWeight: 600 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--color-primary) 16%, transparent)", color: "var(--color-primary)" }}>
                {(activeChild?.firstName || activeChild?.first_name || "S")[0]}
              </div>
              {activeChild?.firstName || activeChild?.first_name} {activeChild?.lastName || activeChild?.last_name}
            </div>
          ) : (
            <select
              style={{ width: "100%", background: "var(--color-bg-card)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "8px 10px", fontSize: "13px", outline: "none" }}
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
                const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
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

      <nav style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) 0", minHeight: 0, background: "var(--color-bg-surface)" }}>
        {filteredGroups.map(renderGroup)}
      </nav>

      <div style={{ padding: "var(--space-4)", borderTop: "1px solid var(--color-border)", background: "var(--color-bg-base)", flexShrink: 0 }}>
        {!collapsed ? (
          <div style={{ background: "var(--color-bg-card)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", border: "1px solid var(--color-border)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `color-mix(in srgb, ${roleColor} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${roleColor} 28%, transparent)`, display: "grid", placeItems: "center", fontWeight: 700, color: roleColor }}>
              {auth?.role === "superadmin" ? "A" : auth?.role === "director" ? "D" : auth?.role === "teacher" ? "T" : auth?.role === "finance" ? "F" : auth?.role === "hr" ? "H" : auth?.role === "librarian" ? "L" : auth?.role === "parent" ? "P" : auth?.role === "student" ? "S" : "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{auth?.name}</div>
              <div style={{ fontSize: "11px", color: roleColor, textTransform: "capitalize", fontWeight: 700, letterSpacing: "0.02em" }}>{auth?.role === "director" ? "Main Director" : auth?.role}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `color-mix(in srgb, ${roleColor} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${roleColor} 28%, transparent)`, display: "grid", placeItems: "center", fontWeight: 700, color: roleColor }}>
              {auth?.role === "superadmin" ? "A" : auth?.role === "director" ? "D" : auth?.role === "teacher" ? "T" : auth?.role === "finance" ? "F" : auth?.role === "hr" ? "H" : auth?.role === "librarian" ? "L" : auth?.role === "parent" ? "P" : auth?.role === "student" ? "S" : "?"}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: collapsed ? "var(--space-2) 0" : "10px var(--space-3)",
            borderRadius: "var(--radius-md)",
            border: "1px solid color-mix(in srgb, var(--color-danger) 18%, transparent)",
            background: "var(--color-danger-muted)",
            color: "var(--color-danger)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "var(--space-2)",
            fontWeight: 700,
            transition: "all var(--transition-fast)",
          }}
        >
          <LogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

SidebarModern.propTypes = {
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
