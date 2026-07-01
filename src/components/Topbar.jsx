import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Menu, Search, Sparkles } from "lucide-react";
import BranchSelector from "./BranchSelector";
import NotificationPanel from "./NotificationPanel";

const ROLE_COLORS = {
  admin: "#3B82F6",
  teacher: "#14B8A6",
  finance: "#F59E0B",
  hr: "#A855F7",
  librarian: "#22C55E",
  parent: "#F43F5E",
  student: "#38BDF8",
  director: "#3B82F6",
  superadmin: "#3B82F6",
};

const ROLE_AVATARS = {
  admin: "A",
  teacher: "T",
  finance: "F",
  hr: "H",
  librarian: "L",
  parent: "P",
  student: "S",
  director: "D",
  superadmin: "A",
};

export default function Topbar({
  auth,
  school,
  currentNav,
  page,
  isPortal,
  isParent,
  activeChild,
  isMobile,
  notifications,
  showBell,
  setShowBell,
  setDrawerOpen,
  onLogout,
  activeSchoolId,
  onSchoolSwitch,
}) {
  const roleColor = ROLE_COLORS[auth?.role] || "#3B82F6";
  const roleAvatar = ROLE_AVATARS[auth?.role] || "?";
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (!showProfileMenu) return undefined;
    const handler = () => setShowProfileMenu(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [showProfileMenu]);

  const breadcrumbs = useMemo(() => {
    const base = [{ label: "Home", value: "dashboard" }];
    if (currentNav?.label) {
      base.push({ label: currentNav.label, value: currentNav.id || page });
    }
    return base;
  }, [currentNav, page]);

  const CurrentIcon = currentNav?.icon && typeof currentNav.icon !== "string" ? currentNav.icon : Sparkles;

  return (
    <header
      className="ec-topbar"
      style={{
        minHeight: "var(--topbar-height)",
        background: "linear-gradient(90deg, var(--color-bg-surface) 0%, color-mix(in srgb, var(--color-bg-surface) 85%, var(--color-bg-card)) 100%)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        padding: isMobile ? "0 var(--space-4)" : "0 var(--space-5)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0, flex: 1 }}>
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-card)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
            className="touch-target"
          >
            <Menu size={18} />
          </button>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--color-primary) 16%, var(--color-bg-card))", color: "var(--color-primary)" }}>
              {typeof currentNav?.icon === "string" ? <span>{currentNav.icon}</span> : <CurrentIcon size={18} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: isMobile ? "18px" : "20px", color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {currentNav?.label || page}
              </div>
              <nav aria-label="Breadcrumbs" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-muted)", fontSize: "12px", marginTop: "2px" }}>
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.value}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span>{crumb.label}</span>
                    {index < breadcrumbs.length - 1 && <span>/</span>}
                  </span>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", background: "var(--color-bg-card)", padding: "8px 12px", minWidth: isMobile ? 0 : 240 }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input
            aria-label="Search"
            placeholder="Search"
            style={{ border: "none", background: "transparent", color: "var(--color-text-primary)", outline: "none", width: "100%", fontSize: "13px" }}
          />
        </div>

        {!isMobile && ["admin", "director", "superadmin"].includes(auth?.role) && (
          <BranchSelector token={auth?.token} activeSchoolId={activeSchoolId} onSwitch={onSchoolSwitch} />
        )}

        {!isMobile && (
          <div style={{ background: `${roleColor}15`, border: `1px solid ${roleColor}30`, borderRadius: "var(--radius-full)", padding: "4px 12px", fontSize: "11px", fontWeight: 700, color: roleColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {auth?.role}
          </div>
        )}

        {['admin', 'teacher', 'finance'].includes(auth?.role) && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowBell(!showBell)}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--color-border)", background: "var(--color-bg-card)", color: "var(--color-text-secondary)", display: "grid", placeItems: "center", cursor: "pointer", position: "relative" }}
              className="touch-target"
            >
              <Bell size={18} />
              {notifications.filter((n) => !n.read).length > 0 && <span style={{ position: "absolute", top: 2, right: 3, width: 10, height: 10, borderRadius: "50%", background: "var(--color-danger)", border: "2px solid var(--color-bg-surface)" }} />}
            </button>
            {showBell && <NotificationPanel list={notifications} markAll={() => setShowBell(false)} />}
          </div>
        )}

        <div style={{ position: "relative" }}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowProfileMenu((value) => !value);
            }}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", padding: "6px 10px", background: "var(--color-bg-card)", color: "var(--color-text-primary)", cursor: "pointer" }}
          >
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `color-mix(in srgb, ${roleColor} 18%, transparent)`, display: "grid", placeItems: "center", color: roleColor, fontWeight: 800 }}>
              {roleAvatar}
            </div>
            {!isMobile && <ChevronDown size={15} />}
          </button>
          {showProfileMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 200, padding: "var(--space-3)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-card)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-md)", display: "grid", gap: "var(--space-2)" }}>
              <div style={{ fontWeight: 700, color: "var(--color-text-primary)" }}>{auth?.name}</div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{auth?.role}</div>
              <button onClick={onLogout} style={{ border: "none", background: "var(--color-danger-muted)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", padding: "8px 10px", fontWeight: 700, cursor: "pointer" }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

Topbar.propTypes = {
  auth: PropTypes.object,
  school: PropTypes.object,
  currentNav: PropTypes.object,
  page: PropTypes.string,
  isPortal: PropTypes.bool,
  isParent: PropTypes.bool,
  activeChild: PropTypes.object,
  isMobile: PropTypes.bool,
  notifications: PropTypes.array,
  showBell: PropTypes.bool,
  setShowBell: PropTypes.func,
  setDrawerOpen: PropTypes.func,
  onLogout: PropTypes.func,
  activeSchoolId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSchoolSwitch: PropTypes.func,
};
