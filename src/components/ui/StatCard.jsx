import PropTypes from "prop-types";
import Card from "./Card";

/**
 * KPI / metric card used on dashboards.
 * Mobile-safe: no overflow clip, wraps long labels and currency.
 */
export default function StatCard({ label, value, color, title, loading = false }) {
  const valueStr = loading ? "…" : String(value ?? "");
  const longValue = valueStr.length > 10;
  return (
    <Card
      className="ec-stat-card"
      style={{
        position: "relative",
        overflow: "visible",
        minHeight: 88,
        minWidth: 0,
        borderLeft: `4px solid ${color || "var(--color-primary)"}`,
      }}
      title={title}
    >
      <div
        style={{
          color: "var(--color-text-muted)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          lineHeight: 1.25,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: longValue ? 16 : 22,
          fontWeight: 800,
          color: "var(--color-text-primary)",
          lineHeight: 1.2,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valueStr}
      </div>
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
  title: PropTypes.string,
  loading: PropTypes.bool,
};
