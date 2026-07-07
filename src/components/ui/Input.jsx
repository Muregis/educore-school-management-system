import React from "react";

export default function Input({
  label,
  error,
  icon,
  hint,
  className = "",
  style = {},
  inputStyle = {},
  id,
  required = false,
  success = false,
  ...props
}) {
  const inputId = id || props.name || undefined;
  const hasError = Boolean(error);
  const hasSuccess = Boolean(success) && !hasError;

  return (
    <div className={`ui-input-wrapper ${className}`} style={{ display: "grid", gap: "var(--space-2)", ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)"
          }}
        >
          <span>{label}</span>
          {required && <span style={{ color: "var(--color-danger)", fontSize: "13px" }}>*</span>}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "var(--space-3)",
              color: hasError ? "var(--color-danger)" : hasSuccess ? "var(--color-success)" : "var(--color-text-muted)",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className="ui-input-field"
          aria-invalid={hasError}
          aria-describedby={hint || error ? `${inputId || "input"}-support` : undefined}
          style={{
            width: "100%",
            minHeight: 44,
            background: "var(--color-bg-card)",
            border: `1px solid ${hasError ? "var(--color-danger)" : hasSuccess ? "var(--color-success)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-md)",
            padding: icon ? "0 var(--space-3) 0 44px" : "0 var(--space-3)",
            color: "var(--color-text-primary)",
            fontSize: "14px",
            fontWeight: 500,
            outline: "none",
            transition: "border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast)",
            boxShadow: hasError ? "0 0 0 3px var(--color-danger-muted)" : hasSuccess ? "0 0 0 3px color-mix(in srgb, var(--color-success) 16%, transparent)" : "var(--shadow-xs)",
            ...inputStyle
          }}
          onFocus={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = hasSuccess ? "var(--color-success)" : "var(--color-border-focus)";
              e.currentTarget.style.boxShadow = hasSuccess ? "0 0 0 3px color-mix(in srgb, var(--color-success) 16%, transparent)" : "0 0 0 3px var(--color-primary-ring)";
            }
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            if (!hasError) {
              e.currentTarget.style.borderColor = hasSuccess ? "var(--color-success)" : "var(--color-border)";
              e.currentTarget.style.boxShadow = hasSuccess ? "0 0 0 3px color-mix(in srgb, var(--color-success) 16%, transparent)" : "var(--shadow-xs)";
            }
            props.onBlur?.(e);
          }}
          {...props}
        />
      </div>
      {(error || hint || hasSuccess) && (
        <span id={`${inputId || "input"}-support`} style={{ fontSize: "12px", color: hasError ? "var(--color-danger)" : hasSuccess ? "var(--color-success)" : "var(--color-text-muted)" }}>
          {error || hint || "Looks good"}
        </span>
      )}
    </div>
  );
}
