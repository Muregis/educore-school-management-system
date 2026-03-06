import { cloneElement, isValidElement, useId } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Field({ label, children }) {
  const autoId = `field_${useId().replace(/:/g, "_")}`;
  const autoName = autoId;

  if (isValidElement(children)) {
    const control = cloneElement(children, { id: autoId, name: autoName });

    return (
      <div style={{ marginBottom: 10 }}>
        <label htmlFor={autoId} style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>
          {label}
        </label>
        {control}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
