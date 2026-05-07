import React, { useEffect } from "react";

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = "560px" }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-modal-overlay animate-in"
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.42)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)"
      }}
      onClick={onClose}
    >
      <div
        className="ui-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-elevated)"
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: "var(--space-5)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)" }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 19, color: "var(--color-text-primary)" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "var(--color-bg-hover)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-full)",
              fontWeight: 900
            }}
          >
            x
          </button>
        </div>
        <div style={{ padding: "var(--space-5)", overflowY: "auto", flex: 1, color: "var(--color-text-primary)" }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: "var(--space-4) var(--space-5)", borderTop: "1px solid var(--color-border)", background: "#F8FAFC", borderBottomLeftRadius: "inherit", borderBottomRightRadius: "inherit", display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ToastContainer({ children }) {
  return children;
}
