import PropTypes from "prop-types";
import Card from "./Card";

const TONE_COLORS = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  info: "var(--color-info)",
  default: "var(--color-primary)",
};

/**
 * KPI metric card — mobile-first, never clips labels or currency.
 * Accepts label/title, value, color or tone, optional subtitle/hint, optional onClick.
 */
export default function StatCard({
  label,
  value,
  color,
  tone,
  title,
  subtitle,
  hint,
  loading = false,
  onClick,
}) {
  const heading = label || title || "";
  const sub = subtitle || hint || "";
  const valueStr = loading ? "…" : String(value ?? "");
  const borderColor = color || TONE_COLORS[tone] || TONE_COLORS.default;

  return (
    <Card
      className="ec-stat-card"
      onClick={onClick}
      style={{
        position: "relative",
        overflow: "visible",
        contain: "none",
        minHeight: 72,
        minWidth: 0,
        maxWidth: "100%",
        padding: "12px 14px",
        borderLeft: `4px solid ${borderColor}`,
        cursor: onClick ? "pointer" : undefined,
      }}
      title={title && label ? title : undefined}
    >
      {onClick ? (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            color: "var(--color-text-muted)",
            opacity: 0.45,
            fontSize: 14,
          }}
          aria-hidden
        >
          →
        </div>
      ) : null}
      <div
        className="ec-stat-label"
        style={{
          color: "var(--color-text-muted)",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          lineHeight: 1.3,
          whiteSpace: "normal",
          overflow: "visible",
          wordBreak: "break-word",
          paddingRight: onClick ? 16 : 0,
        }}
      >
        {heading}
      </div>
      <div
        className="ec-stat-value"
        style={{
          marginTop: 6,
          fontSize: valueStr.length > 12 ? 13 : valueStr.length > 8 ? 15 : 18,
          fontWeight: 800,
          color: "var(--color-text-primary)",
          lineHeight: 1.25,
          whiteSpace: "normal",
          overflow: "visible",
          wordBreak: "break-word",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valueStr}
      </div>
      {sub ? (
        <div
          className="ec-stat-sub"
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--color-text-muted)",
            lineHeight: 1.3,
            whiteSpace: "normal",
            overflow: "visible",
            wordBreak: "break-word",
          }}
        >
          {sub}
        </div>
      ) : null}
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
  tone: PropTypes.oneOf(["success", "warning", "danger", "info", "default"]),
  title: PropTypes.string,
  subtitle: PropTypes.string,
  hint: PropTypes.string,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
};
