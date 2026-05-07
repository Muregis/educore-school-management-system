import React, { useEffect, useState } from "react";

export default function Toast({ message, type = "success", onClose, duration = 3500 }) {
  const [closing, setClosing] = useState(false);
  const tones = {
    success: { color: "var(--color-success)", bg: "var(--color-success-muted)" },
    error: { color: "var(--color-danger)", bg: "var(--color-danger-muted)" },
    danger: { color: "var(--color-danger)", bg: "var(--color-danger-muted)" },
    warning: { color: "var(--color-warning)", bg: "var(--color-warning-muted)" },
    info: { color: "var(--color-info)", bg: "var(--color-info-muted)" }
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
        opacity: closing ? 0.7 : 1
      }}
    >
      <span style={{ color: "var(--color-text-primary)", fontSize: 14, fontWeight: 700 }}>{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss toast" style={{ background: "transparent", border: 0, color: "var(--color-text-muted)", cursor: "pointer", fontWeight: 900 }}>
          x
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
