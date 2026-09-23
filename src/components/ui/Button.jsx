import React from "react";

const variants = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-text-inverse)",
    border: "1px solid var(--color-primary)",
    boxShadow: "0 10px 24px color-mix(in srgb, var(--color-primary) 18%, transparent)"
  },
  secondary: {
    background: "var(--color-bg-card)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border)",
    boxShadow: "var(--shadow-xs)"
  },
  outline: {
    background: "transparent",
    color: "var(--color-primary)",
    border: "1px solid var(--color-primary)"
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
  type = "button",
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`touch-target ui-btn ui-btn-${variant} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        width: fullWidth ? "100%" : undefined,
        position: "relative",
        fontWeight: 700,
        letterSpacing: "0.01em",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)",
        transform: "translateZ(0)",
        willChange: "transform",
        contain: "layout paint",
        ...sizes[size],
        ...variants[variant],
        ...style
      }}
      {...props}
    >
      {loading ? <span aria-hidden="true">…</span> : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
