import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Btn({ children, onClick, variant = "primary", type = "button", disabled = false, loading = false, size = "default" }) {
  const styles = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.textSub, border: `1px solid ${C.border}` },
    danger: { background: "#3D0015", color: C.rose, border: `1px solid ${C.rose}44` },
  };

  const sizeStyles = {
    small: { padding: "6px 10px", fontSize: 12, minHeight: 32 },
    default: { padding: "10px 16px", fontSize: 14, minHeight: 44 },
    large: { padding: "14px 24px", fontSize: 16, minHeight: 52 },
  };

  const sizeStyle = sizeStyles[size] || sizeStyles.default;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...styles[variant],
        borderRadius: 12,
        fontWeight: 600,
        cursor: (disabled || loading) ? "not-allowed" : "pointer",
        opacity: (disabled || loading) ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "all 0.15s ease",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "rgba(59, 130, 246, 0.2)",
        ...sizeStyle,
      }}
    >
      {loading ? (
        <>
          <span className="mobile-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          Loading...
        </>
      ) : children}
    </button>
  );
}

Btn.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(["primary", "ghost", "danger"]),
  type: PropTypes.oneOf(["button", "submit"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  size: PropTypes.oneOf(["small", "default", "large"]),
};
