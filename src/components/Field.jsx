import { cloneElement, isValidElement, useId } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Field({ label, children, style }) {
  const autoId = `field_${useId().replace(/:/g, "_")}`;
  const autoName = autoId;

  const containerStyle = {
    marginBottom: 16,
    ...style,
  };

  const labelStyle = {
    display: "block",
    fontSize: 12,
    color: C.textSub,
    marginBottom: 8,
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.5px",
  };

  if (isValidElement(children)) {
    const control = cloneElement(children, {
      id: autoId,
      name: autoName,
      style: {
        ...children.props.style,
        minHeight: 44,
        fontSize: 16,
      },
    });

    return (
      <div style={containerStyle}>
        <label htmlFor={autoId} style={labelStyle}>
          {label}
        </label>
        {control}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
};
