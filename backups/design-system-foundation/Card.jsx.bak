import React from "react";

export default React.memo(function Card({ 
  children, 
  className = "", 
  style = {}, 
  as: Component = "div",
  hoverable = true,
  ...props 
}) {
  const baseStyle = {
    padding: "var(--space-5)",
    ...style
  };

  if (hoverable) {
    baseStyle.cursor = "default";
  }

  return (
    <Component
      className={`ui-card premium-card ${className}`}
      style={baseStyle}
      {...props}
    >
      {children}
    </Component>
  );
});