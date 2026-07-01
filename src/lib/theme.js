function normalizeHex(hex = "#2563eb") {
  const value = String(hex).trim();
  if (!value) return "#2563eb";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    const expanded = value.length === 4
      ? value.split("").slice(1).map((char) => char + char).join("")
      : value;
    return `#${expanded.slice(1).toLowerCase()}`;
  }
  return value;
}

function hexToRgb(hex) {
  const value = normalizeHex(hex).replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const int = Number.parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function mixHex(baseHex, overlayHex, ratio) {
  const base = hexToRgb(baseHex);
  const overlay = hexToRgb(overlayHex);
  const blend = (channel, other) => Math.round(channel * (1 - ratio) + other * ratio);
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(blend(base.r, overlay.r))}${toHex(blend(base.g, overlay.g))}${toHex(blend(base.b, overlay.b))}`;
}

function darkenHex(hex, amount) {
  const base = hexToRgb(hex);
  const scale = 1 - amount / 100;
  const toHex = (value) => Math.max(0, Math.round(value * scale)).toString(16).padStart(2, "0");
  return `#${toHex(base.r)}${toHex(base.g)}${toHex(base.b)}`;
}

export function buildBrandColorTokens(baseColor = "#2563eb") {
  const primary = normalizeHex(baseColor) || "#2563eb";
  const primaryHover = primary.toLowerCase() === "#2563eb" ? "#1d4ed8" : darkenHex(primary, 15);
  const primaryLight = primary.toLowerCase() === "#2563eb" ? "#5b8ef4" : mixHex(primary, "#ffffff", 0.24);
  const primaryDark = primary.toLowerCase() === "#2563eb" ? "#0f2f74" : darkenHex(primary, 24);
  const accent = mixHex(primary, "#8b5cf6", 0.18);
  const focusRing = `rgba(${hexToRgb(primary).r}, ${hexToRgb(primary).g}, ${hexToRgb(primary).b}, 0.28)`;

  return {
    "--color-school-primary": primary,
    "--color-school-primary-hover": primaryHover,
    "--color-school-glow": `rgba(${hexToRgb(primary).r}, ${hexToRgb(primary).g}, ${hexToRgb(primary).b}, 0.15)`,
    "--color-primary": primary,
    "--color-primary-hover": primaryHover,
    "--color-primary-light": primaryLight,
    "--color-primary-dark": primaryDark,
    "--color-accent": accent,
    "--color-focus-ring": focusRing,
    "--color-primary-muted": `rgba(${hexToRgb(primary).r}, ${hexToRgb(primary).g}, ${hexToRgb(primary).b}, 0.15)`,
    "--color-primary-glow": `rgba(${hexToRgb(primary).r}, ${hexToRgb(primary).g}, ${hexToRgb(primary).b}, 0.15)`,
  };
}

export function applyBrandColorTokens(baseColor = "#2563eb", root = document.documentElement) {
  const tokens = buildBrandColorTokens(baseColor);
  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  return tokens;
}

export const C = {
  bg: "var(--color-bg-base)",
  surface: "var(--color-bg-surface)",
  card: "var(--color-bg-card)",
  cardHover: "var(--color-bg-hover)",
  border: "var(--color-border)",
  borderHover: "var(--color-border-strong)",
  accent: "var(--color-primary)",
  accentDim: "var(--color-primary-muted)",
  accentGlow: "var(--color-primary-muted)",
  accentHover: "var(--color-primary-hover)",
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
