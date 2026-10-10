import PropTypes from "prop-types";
import Card from "./Card";

/**
 * KPI metric card — mobile-first, never clips labels or currency.
 * Accepts either `label` (Reports/Expenditures) or `title` (Analytics/finance pages).
 */
export default function StatCard({
  label,
  value,
  color,
  title,
  subtitle,
  loading = false,
}) {
  const heading = label || title || "";
  const valueStr = loading ? "…" : String(value ?? "");
  return (
    <Card
      className="ec-stat-card"
      style={{
        position: "relative",
        overflow: "visible",
        contain: "none",
        minHeight: 72,
        minWidth: 0,
        padding: "12px 14px",
        borderLeft: `4px solid ${color || "var(--color-primary)"}`,
      }}
      title={subtitle || (label ? title : undefined)}
    >
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
      {subtitle ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "var(--color-text-muted)",
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  loading: PropTypes.bool,
};
