import React from "react";
import Spinner from "./Spinner";

export default function PageLoader({ label = "Loading" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="ui-page-loader"
      style={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        color: "var(--color-text-secondary)"
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-3)", justifyItems: "center", textAlign: "center" }}>
        <div style={{ display: "inline-flex", justifyContent: "center" }}>
          <Spinner size="32px" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Preparing your workspace…</span>
      </div>
    </div>
  );
}
