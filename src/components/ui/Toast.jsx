import React, { useEffect, useState } from "react";

export default function Toast({ message, type = "success", onClose, duration = 3500 }) {
  const [closing, setClosing] = useState(false);
  const tones = {
    success: { color: "var(--color-success)", bg: "var(--color-success-muted)", icon: "✓" },
    error: { color: "var(--color-danger)", bg: "var(--color-danger-muted)", icon: "!" },
    danger: { color: "var(--color-danger)", bg: "var(--color-danger-muted)", icon: "!" },
    warning: { color: "var(--color-warning)", bg: "var(--color-warning-muted)", icon: "⚠" },
    info: { color: "var(--color-info)", bg: "var(--color-info-muted)", icon: "i" }
  };
  const tone = tones[type] || tones.info;

  useEffect(() => {
    if (!onClose) return undefined;
    const timer = setTimeout(() => {
      setClosing(true);
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="ui-toast animate-in"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderLeft: `4px solid ${tone.color}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        boxShadow: "var(--shadow-elevated)",
        minWidth: 280,
        maxWidth: 420,
        opacity: closing ? 0.7 : 1,
        contain: "layout paint"
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
        <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 24, height: 24, borderRadius: "var(--radius-full)", background: tone.bg, color: tone.color, fontWeight: 900 }}>{tone.icon}</span>
        <span style={{ color: "var(--color-text-primary)", fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{message}</span>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss toast" style={{ background: "transparent", border: 0, color: "var(--color-text-muted)", cursor: "pointer", fontWeight: 900, padding: 0 }}>
          ×
        </button>
      )}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 3,
          width: "100%",
          background: tone.color,
          transformOrigin: "left",
          animation: `toastProgress ${duration}ms linear forwards`
        }}
      />
      <style>{`@keyframes toastProgress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </div>
  );
}

export function ToastContainer({ children, style = {} }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "var(--space-5)",
        right: "var(--space-5)",
        zIndex: 3000,
        display: "grid",
        gap: "var(--space-2)",
        ...style
      }}
    >
      {children}
    </div>
  );
}
