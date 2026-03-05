import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>{label}</label>
      {children}
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
