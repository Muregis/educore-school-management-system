import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: 760, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }}>
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
};
