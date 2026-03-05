import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function Table({ headers, rows }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", background: C.card }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: C.surface }}>
            {headers.map(h => <th key={h} style={{ textAlign: "left", padding: "11px 12px", fontSize: 11, color: C.textMuted, textTransform: "uppercase" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
              {r.map((c, j) => <td key={j} style={{ padding: "11px 12px", color: C.textSub, fontSize: 13 }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Table.propTypes = {
  headers: PropTypes.arrayOf(PropTypes.string).isRequired,
  rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.node)).isRequired,
};
