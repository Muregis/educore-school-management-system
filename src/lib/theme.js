export const C = {
  // Backgrounds
  bg: "var(--color-bg-base)",
  surface: "var(--color-bg-surface)",
  card: "var(--color-bg-card)",
  cardHover: "var(--color-bg-hover)",

  // Borders
  border: "var(--color-border)",
  borderHover: "var(--color-border-strong)",

  // Accent
  accent: "var(--color-primary)",
  accentDim: "var(--color-primary-muted)",
  accentGlow: "var(--color-primary-muted)",
  accentHover: "var(--color-primary-hover)",

  // Semantic colors
  teal: "var(--color-teal)",
  tealDim: "rgba(13,148,136,0.12)",
  amber: "var(--color-amber)",
  amberDim: "var(--color-warning-muted)",
  rose: "var(--color-rose)",
  roseDim: "var(--color-danger-muted)",
  green: "var(--color-green)",
  greenDim: "var(--color-success-muted)",
  purple: "var(--color-purple)",
  purpleDim: "rgba(124,58,237,0.12)",
  sky: "var(--color-sky)",
  skyDim: "var(--color-info-muted)",

  // Text
  text: "var(--color-text-primary)",
  textSub: "var(--color-text-secondary)",
  textMuted: "var(--color-text-muted)",
};

export const inputStyle = {
  width: "100%",
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: "var(--radius-md)",
  padding: "11px 13px",
  color: C.text,
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
};

export const cardStyle = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-5)",
  boxShadow: "var(--shadow-sm)",
};

export const labelStyle = {
  fontSize: 11,
  fontWeight: 800,
  color: C.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 5,
  display: "block",
};
