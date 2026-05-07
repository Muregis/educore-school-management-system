import PropTypes from "prop-types";

const ROLE_COLORS = {
  admin: "#3B82F6",
  teacher: "#14B8A6",
  finance: "#F59E0B",
  hr: "#A855F7",
  librarian: "#22C55E",
  parent: "#F43F5E",
  student: "#38BDF8",
  director: "#3B82F6",
  superadmin: "#3B82F6"
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
  superadmin: "A"
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
  rolePermissions,
  onLogout
}) {
  const roleColor = ROLE_COLORS[auth?.role] || "#3B82F6";
  const roleAvatar = ROLE_AVATARS[auth?.role] || "?";

  return (
    <div
      className="ec-topbar"
      style={{
        height: "var(--topbar-height)",
        background: "var(--color-bg-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: isMobile ? "0 var(--space-4)" : "0 var(--space-5)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)"
      }}
    >
      {/* Left Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              transition: "all var(--transition-fast)"
            }}
            className="touch-target"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-bg-hover)";
              e.currentTarget.style.borderColor = "var(--color-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-bg-card)";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          >
            ☰
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {school.logo_url && !isMobile && (
            <img
              src={school.logo_url}
              alt="Logo"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                objectFit: "cover",
                border: "2px solid var(--color-bg-card)"
              }}
            />
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "20px" }}>{currentNav?.icon}</span>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: isMobile ? "18px" : "22px",
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.01em"
                }}
              >
                {currentNav?.label || page}
              </span>
            </div>
            {!isMobile && (
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "12px",
                  marginTop: "2px",
                  fontWeight: 500,
                  letterSpacing: "0.02em"
                }}
              >
                {isPortal
                  ? `${isParent ? "Parent" : "Student"} · ${activeChild ? `${activeChild.firstName ?? activeChild.first_name} ${activeChild.lastName ?? activeChild.last_name}` : auth?.name}`
                  : `${school.name} · ${school.term} ${school.year}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {/* Role Badge */}
        {!isMobile && (
          <div
            style={{
              background: `${roleColor}15`,
              border: `1px solid ${roleColor}30`,
              borderRadius: "var(--radius-full)",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 700,
              color: roleColor,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            {auth?.role}
          </div>
        )}

        {/* Notification Bell */}
        {["admin", "teacher", "finance"].includes(auth?.role) && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowBell(!showBell)}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-full)",
                background: "var(--color-bg-card)",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                position: "relative",
                transition: "all var(--transition-fast)"
              }}
              className="touch-target"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-bg-hover)";
                e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--color-bg-card)";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              🔔
              {notifications.filter((n) => !n.read).length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "0px",
                    right: "0px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: "var(--color-danger)",
                    border: "2px solid var(--color-bg-surface)"
                  }}
                />
              )}
            </button>
          </div>
        )}

        {/* Mobile Logout */}
        {isMobile && (
          <button
            onClick={onLogout}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "var(--radius-full)",
              background: `${roleColor}15`,
              border: `1px solid ${roleColor}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "14px",
              color: roleColor,
              cursor: "pointer"
            }}
            title="Logout"
            className="touch-target"
          >
            {roleAvatar}
          </button>
        )}
      </div>
    </div>
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
  rolePermissions: PropTypes.object,
  onLogout: PropTypes.func
};
