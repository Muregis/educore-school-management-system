import React from "react";

export default function Tabs({ tabs = [], activeTab, onChange }) {
  return (
    <div
      role="tablist"
      className="ec-tabs-scroll"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "thin",
        padding: 6,
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-xs)",
        maxWidth: "100%",
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab.id)}
            style={{
              flex: "0 0 auto",
              flexShrink: 0,
              minHeight: 40,
              border: "1px solid transparent",
              borderRadius: "var(--radius-md)",
              background: active ? "var(--color-primary)" : "transparent",
              color: active ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
              padding: "8px 14px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
              transition: "all var(--transition-fast)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
