import React from "react";
import Card from "./Card";

export default React.memo(function Stat({ label, value, icon, tone = "primary", trend, accentColor, style = {} }) {
  const color = accentColor || {
    primary: "var(--color-primary)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
    info: "var(--color-info)",
    neutral: "var(--color-text-muted)"
  }[tone] || "var(--color-primary)";

  return (
    <Card
      className="animate-in"
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 132,
        ...style
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto auto 0",
          width: 4,
          height: "100%",
          background: color
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </div>
          <div style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-heading)", fontSize: 30, fontWeight: 850, marginTop: "var(--space-2)" }}>
            {value}
          </div>
          {trend && <div style={{ color, fontSize: 12, fontWeight: 800, marginTop: "var(--space-2)" }}>{trend}</div>}
        </div>
        {icon && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "var(--color-primary-muted)",
              color,
              display: "grid",
              placeItems: "center",
              fontSize: 20,
              flexShrink: 0
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
});
