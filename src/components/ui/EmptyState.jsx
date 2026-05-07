import React from "react";
import Button from "./Button";

export default React.memo(function EmptyState({
  icon = null,
  title = "No Data",
  description = "There is no data to display here.",
  actionLabel,
  onAction,
  style = {}
}) {
  return (
    <div
      className="animate-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-7) var(--space-5)",
        textAlign: "center",
        background: "linear-gradient(180deg, var(--color-bg-card) 0%, var(--color-bg-surface) 100%)",
        border: "1px dashed var(--color-border)",
        borderRadius: "var(--radius-xl)",
        minHeight: 180,
        boxShadow: "var(--shadow-sm)",
        ...style
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "var(--radius-lg)",
          display: "grid",
          placeItems: "center",
          marginBottom: "var(--space-4)",
          background: "var(--color-primary-muted)",
          color: "var(--color-primary)",
          fontWeight: 900,
          fontSize: 22
        }}
      >
        {icon || "○"}
      </div>
      <h3 style={{ margin: "0 0 var(--space-2)", color: "var(--color-text-primary)", fontFamily: "var(--font-heading)", fontSize: 18 }}>
        {title}
      </h3>
      <p style={{ margin: actionLabel ? "0 0 var(--space-4)" : 0, color: "var(--color-text-secondary)", fontSize: 14, maxWidth: 360 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
});

export function EmptyStateIllustrated(props) {
  return <EmptyState {...props} />;
}