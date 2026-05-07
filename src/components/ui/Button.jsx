import React from "react";

const variants = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-text-inverse)",
    border: "1px solid var(--color-primary)",
    boxShadow: "var(--shadow-glow-primary)"
  },
  secondary: {
    background: "var(--color-bg-card)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border)"
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid transparent"
  },
  danger: {
    background: "var(--color-danger)",
    color: "#FFFFFF",
    border: "1px solid var(--color-danger)"
  },
  success: {
    background: "var(--color-success)",
    color: "#FFFFFF",
    border: "1px solid var(--color-success)"
  }
};

const sizes = {
  sm: { minHeight: 34, padding: "0 var(--space-3)", fontSize: "12px", borderRadius: "var(--radius-sm)" },
  md: { minHeight: 40, padding: "0 var(--space-4)", fontSize: "14px", borderRadius: "var(--radius-md)" },
  lg: { minHeight: 48, padding: "0 var(--space-5)", fontSize: "15px", borderRadius: "var(--radius-md)" }
};

export default React.memo(function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style = {},
  ...props
}) {
  return (
    <button
      className={`ui-btn ui-btn-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        width: fullWidth ? "100%" : undefined,
        fontWeight: 800,
        letterSpacing: 0,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.58 : 1,
        transition: "transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast)",
        ...sizes[size],
        ...(variants[variant] || variants.primary),
        ...style
      }}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            width: "1em",
            height: "1em",
            border: "2px solid currentColor",
            borderRightColor: "transparent",
            borderRadius: "50%",
            animation: "spin 800ms linear infinite"
          }}
        />
      ) : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
