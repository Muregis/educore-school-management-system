import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Btn({ children, onClick, variant = "primary", type = "button", disabled = false, loading = false }) {
  const styles = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: C.textSub, border: `1px solid ${C.border}` },
    danger: { background: "#3D0015", color: C.rose, border: `1px solid ${C.rose}44` },
  };

  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled || loading} 
      style={{ 
        ...styles[variant], 
        borderRadius: 10, 
        padding: "9px 14px", 
        fontSize: 13, 
        fontWeight: 600, 
        cursor: (disabled || loading) ? "not-allowed" : "pointer", 
        opacity: (disabled || loading) ? 0.6 : 1 
      }}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}

Btn.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(["primary", "ghost", "danger"]),
  type: PropTypes.oneOf(["button", "submit"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
};
