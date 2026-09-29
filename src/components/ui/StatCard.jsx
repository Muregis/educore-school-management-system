import PropTypes from "prop-types";
import Card from "./Card";

/**
 * KPI metric card — mobile-first, never clips labels or currency.
 */
export default function StatCard({ label, value, color, title, loading = false }) {
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
      title={title}
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
        {label}
      </div>
      <div
        className="ec-stat-value"
        style={{
          marginTop: 6,
          fontSize: valueStr.length > 9 ? 15 : 20,
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
