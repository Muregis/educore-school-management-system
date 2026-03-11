export const C = {
  // Backgrounds
  bg:         "#060A12",
  surface:    "#0B1120",
  card:       "#0F1929",
  cardHover:  "#131F31",

  // Borders
  border:     "#1A2A42",
  borderHover:"#2A3F60",

  // Accent - Blue
  accent:     "#3B82F6",
  accentDim:  "#1D3461",
  accentGlow: "rgba(59,130,246,0.10)",
  accentHover:"#2563EB",

  // Semantic colors
  teal:       "#14B8A6",
  tealDim:    "rgba(20,184,166,0.12)",
  amber:      "#F59E0B",
  amberDim:   "rgba(245,158,11,0.12)",
  rose:       "#F43F5E",
  roseDim:    "rgba(244,63,94,0.12)",
  green:      "#22C55E",
  greenDim:   "rgba(34,197,94,0.12)",
  purple:     "#A855F7",
  purpleDim:  "rgba(168,85,247,0.12)",
  sky:        "#38BDF8",
  skyDim:     "rgba(56,189,248,0.12)",

  // Text
  text:       "#E2EAF8",
  textSub:    "#7A92B8",
  textMuted:  "#3D5070",
};

export const inputStyle = {
  width:        "100%",
  background:   C.card,
  border:       `1px solid ${C.border}`,
  borderRadius: 10,
  padding:      "10px 13px",
  color:        C.text,
  fontSize:     14,
  boxSizing:    "border-box",
  outline:      "none",
  transition:   "border-color 0.15s",
};

export const cardStyle = {
  background:   C.card,
  border:       `1px solid ${C.border}`,
  borderRadius: 14,
  padding:      "18px 20px",
};

export const labelStyle = {
  fontSize:      11,
  fontWeight:    700,
  color:         C.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom:  5,
  display:       "block",
};