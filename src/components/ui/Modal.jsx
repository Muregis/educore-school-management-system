import React, { useEffect, useId, useRef } from "react";

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = "560px", subtitle, showCloseButton = true }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll(focusableSelector) || [];
        if (!focusable.length) {
          event.preventDefault();
          dialogRef.current?.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
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
        ref={dialogRef}
        className="ui-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={title}
        tabIndex={-1}
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-elevated)",
          overflow: "hidden",
          contain: "layout paint"
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: "var(--space-5)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)", background: "linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 100%)" }}>
          <div>
            <h3 id={titleId} style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 19, color: "var(--color-text-primary)" }}>
              {title}
            </h3>
            {subtitle && <div style={{ marginTop: "var(--space-1)", fontSize: "13px", color: "var(--color-text-muted)" }}>{subtitle}</div>}
          </div>
          {showCloseButton && (
            <button
              type="button"
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
                fontWeight: 900,
                flexShrink: 0
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ padding: "var(--space-5)", overflowY: "auto", flex: 1, color: "var(--color-text-primary)" }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: "var(--space-4) var(--space-5)", borderTop: "1px solid var(--color-border)", background: "var(--color-bg-base)", borderBottomLeftRadius: "inherit", borderBottomRightRadius: "inherit", display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" }}>
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
