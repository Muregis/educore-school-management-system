import React from "react";

export default React.memo(function Card({
  children,
  className = "",
  style = {},
  as: Component = "div",
  hoverable = true,
  ...props
}) {
  const isStat = String(className || "").includes("ec-stat-card");
  const baseStyle = {
    padding: "var(--space-5)",
    position: "relative",
    overflow: isStat ? "visible" : "hidden",
    background:
      "linear-gradient(180deg, var(--color-bg-card) 0%, color-mix(in srgb, var(--color-bg-card) 90%, var(--color-bg-base)) 100%)",
    ...(isStat ? { contain: "none" } : {}),
    ...style,
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
