#!/usr/bin/env node
import fs from "fs";

const path = "src/pages/PortalDashboardPage.jsx";
let t = fs.readFileSync(path, "utf8");

const junk = `
) {
  return (
    <Card 
      onClick={onClick}
      style={{ 
        padding: "var(--space-4)",
        cursor: onClick ? "pointer" : "default",
        borderLeft: \`4px solid \${color}\`,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {onClick && <div style={{ position: "absolute", top: "var(--space-2)", right: "var(--space-3)", color: "var(--color-text-muted)", opacity: 0.5 }}>→</div>}
      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>{label}</div>
      <div style={{ fontSize: "32px", fontWeight: 800, color, marginBottom: "var(--space-1)", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: "13px", color: "var(--color-text-muted)", fontWeight: 500 }}>{subtext}</div>
    </Card>
  );
}
`;

if (t.includes(junk)) {
  t = t.replace(junk, "\n");
  console.log("removed junk fragment");
} else if (t.includes(") {\n  return (\n    <Card \n      onClick={onClick}")) {
  // fallback looser match
  t = t.replace(
    /\n\) \{\n  return \(\n    <Card[\s\S]*?<div style=\{\{ fontSize: "13px", color: "var\(--color-text-muted\)", fontWeight: 500 \}\}>\{subtext\}<\/div>\n    <\/Card>\n  \);\n\}\n/,
    "\n"
  );
  console.log("removed junk via regex");
} else {
  console.log("no junk found (already clean?)");
}

// shared StatCard uses subtitle, not subtext
t = t.replace(/subtext=/g, "subtitle=");

fs.writeFileSync(path, t);

const open = (t.match(/\(/g) || []).length;
const close = (t.match(/\)/g) || []).length;
console.log("parens", open - close);
if (open !== close) {
  console.error("PAREN IMBALANCE");
  process.exit(1);
}
console.log("PortalDashboard OK");
