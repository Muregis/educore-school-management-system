import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Modal({ title, onClose, children, isOpen = true }) {
  if (!isOpen) return null;
  
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, boxSizing: "border-box" }}>
      <div data-modal-panel="true" style={{ width: "100%", maxWidth: "min(95vw, 760px)", maxHeight: "min(90vh, 100dvh - 2rem)", overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, boxSizing: "border-box" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: C.text, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", color: C.textSub, cursor: "pointer" }}>x</button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool,
};
