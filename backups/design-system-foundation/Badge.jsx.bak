import React from "react";

export default React.memo(function Badge({ children, text, variant = "neutral", className = "", style = {} }) {
  const tones = {
    primary: { bg: "var(--color-primary-muted)", color: "var(--color-primary)" },
    success: { bg: "var(--color-success-muted)", color: "var(--color-success)" },
    warning: { bg: "var(--color-warning-muted)", color: "var(--color-warning)" },
    danger: { bg: "var(--color-danger-muted)", color: "var(--color-danger)" },
    info: { bg: "var(--color-info-muted)", color: "var(--color-info)" },
    neutral: { bg: "var(--color-bg-hover)", color: "var(--color-text-secondary)" }
  };
  const tone = tones[variant] || tones.neutral;

  return (
    <span
      className={`ui-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 24,
        padding: "2px 9px",
        borderRadius: "var(--radius-full)",
        fontSize: "11px",
        lineHeight: 1,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        background: tone.bg,
        color: tone.color,
        border: `1px solid color-mix(in srgb, ${tone.color} 24%, transparent)`,
        whiteSpace: "nowrap",
        ...style
      }}
    >
      {text || children}
    </span>
  );
});
