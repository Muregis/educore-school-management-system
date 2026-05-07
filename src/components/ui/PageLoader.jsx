import React from "react";
import Spinner from "./Spinner";

export default function PageLoader({ label = "Loading" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        color: "var(--color-text-secondary)"
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-3)", justifyItems: "center" }}>
        <Spinner size="32px" />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      </div>
    </div>
  );
}
