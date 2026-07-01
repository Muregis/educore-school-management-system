import PropTypes from "prop-types";

export default function Btn({ children, onClick, variant = "primary", type = "button", disabled = false, loading = false, size = "default" }) {
  const styles = {
    primary: { background: "var(--color-primary)", color: "var(--color-text-inverse)", border: "1px solid var(--color-primary)", boxShadow: "0 10px 24px color-mix(in srgb, var(--color-primary) 18%, transparent)" },
    secondary: { background: "var(--color-bg-card)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-xs)" },
    outline: { background: "transparent", color: "var(--color-primary)", border: "1px solid var(--color-primary)" },
    ghost: { background: "transparent", color: "var(--color-text-secondary)", border: "1px solid transparent" },
    danger: { background: "var(--color-danger)", color: "#FFFFFF", border: "1px solid var(--color-danger)" },
  };

  const sizeStyles = {
    small: { padding: "6px 10px", fontSize: 12, minHeight: 32 },
    default: { padding: "10px 16px", fontSize: 14, minHeight: 44 },
    large: { padding: "14px 24px", fontSize: 16, minHeight: 52 },
  };

  const sizeStyle = sizeStyles[size] || sizeStyles.default;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      style={{
        ...styles[variant],
        borderRadius: "var(--radius-md)",
        fontWeight: 700,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transition: "transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast)",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "rgba(59, 130, 246, 0.2)",
        transform: "translateZ(0)",
        contain: "layout paint",
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
  variant: PropTypes.oneOf(["primary", "secondary", "outline", "ghost", "danger"]),
  type: PropTypes.oneOf(["button", "submit"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  size: PropTypes.oneOf(["small", "default", "large"]),
};
