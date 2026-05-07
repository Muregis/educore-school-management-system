import React from "react";

export default function Tabs({ tabs = [], activeTab, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: "var(--space-2)",
        overflowX: "auto",
        padding: "var(--space-1)",
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)"
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab.id)}
            style={{
              minHeight: 40,
              border: "1px solid transparent",
              borderRadius: "var(--radius-md)",
              background: active ? "var(--color-primary)" : "transparent",
              color: active ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
              padding: "0 var(--space-4)",
              cursor: "pointer",
              fontWeight: 800,
              whiteSpace: "nowrap",
              transition: "all var(--transition-fast)"
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
