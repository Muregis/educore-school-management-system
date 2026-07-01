import React from "react";

export default React.memo(function Input({
  label,
  error,
  icon,
  hint,
  className = "",
  style = {},
  inputStyle = {},
  id,
  ...props
}) {
  const inputId = id || props.name || undefined;

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
            letterSpacing: "0.04em"
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "var(--space-3)",
              color: "var(--color-text-muted)",
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
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? `${inputId || "input"}-support` : undefined}
          style={{
            width: "100%",
            background: "var(--color-bg-card)",
            border: `1px solid ${error ? "var(--color-danger)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-md)",
            padding: icon ? "0 var(--space-3) 0 38px" : "0 var(--space-3)",
            color: "var(--color-text-primary)",
            fontSize: "14px",
            outline: "none",
            transition: "border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast)",
            boxShadow: error ? "0 0 0 3px var(--color-danger-muted)" : "var(--shadow-xs)",
            ...inputStyle
          }}
          onFocus={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "var(--color-border-focus)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-primary-ring)";
            }
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            if (!error) {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.boxShadow = "var(--shadow-xs)";
            }
            props.onBlur?.(e);
          }}
          {...props}
        />
      </div>
      {(error || hint) && (
        <span id={`${inputId || "input"}-support`} style={{ fontSize: "12px", color: error ? "var(--color-danger)" : "var(--color-text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
});
