import React from "react";
import Stat from "./Stat";

export default React.memo(function StatCard({ title, label, value, subtitle, icon, trend, color, accentColor, ...props }) {
  return (
    <Stat
      label={title || label}
      value={value}
      icon={icon}
      trend={subtitle || (typeof trend === "string" ? trend : undefined)}
      accentColor={accentColor || color}
      {...props}
    />
  );
});
