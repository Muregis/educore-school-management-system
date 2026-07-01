import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Badge({ text, children, tone = "neutral" }) {
  const tones = {
    success: ["var(--color-success-muted)", "var(--color-success)"],
    warning: ["var(--color-warning-muted)", "var(--color-warning)"],
    danger: ["var(--color-danger-muted)", "var(--color-danger)"],
    info: ["var(--color-info-muted)", "var(--color-info)"],
    neutral: ["var(--color-bg-hover)", "var(--color-text-secondary)"],
  };
  const t = tones[tone] || tones.neutral;
  const content = text ?? children ?? "";
  return <span style={{ background: t[0], color: t[1], borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{content}</span>;
}

Badge.propTypes = {
  text: PropTypes.node,
  children: PropTypes.node,
  tone: PropTypes.oneOf(["success", "warning", "danger", "info", "neutral"]),
};
