import PropTypes from "prop-types";
import Btn from "./Btn";

export default function NotificationPanel({ list, markAll }) {
  return (
    <div
      role="dialog"
      aria-label="Notifications"
      style={{
        position: "absolute",
        top: 44,
        right: 0,
        width: 340,
        maxHeight: 380,
        overflowY: "auto",
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        zIndex: 200,
        boxShadow: "var(--shadow-elevated)",
        contain: "layout paint"
      }}
    >
      <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>Notifications</span>
        <Btn variant="ghost" size="small" onClick={markAll}>Mark all read</Btn>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: "var(--space-4)", color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5 }}>You’re all caught up.</div>
      ) : list.map((n) => (
        <div key={n.id} style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)", background: n.read ? "transparent" : "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}>
          <div style={{ color: "var(--color-text-primary)", fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{n.message}</div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: "var(--space-1)" }}>{n.time}</div>
        </div>
      ))}
    </div>
  );
}

NotificationPanel.propTypes = {
  list: PropTypes.array.isRequired,
  markAll: PropTypes.func.isRequired,
};
