import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Badge({ text, tone = "neutral" }) {
  const tones = {
    success: ["#0D2E1A", C.green],
    warning: ["#3D2200", C.amber],
    danger: ["#3D0015", C.rose],
    info: [C.accentGlow, C.accent],
    neutral: [C.surface, C.textSub],
  };
  const t = tones[tone] || tones.neutral;
  return <span style={{ background: t[0], color: t[1], borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{text}</span>;
}

Badge.propTypes = {
  text: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(["success", "warning", "danger", "info", "neutral"]),
};
