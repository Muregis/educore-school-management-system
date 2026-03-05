import PropTypes from "prop-types";
import Btn from "./Btn";
import { C } from "../lib/theme";

export default function NotificationPanel({ list, markAll }) {
  return (
    <div style={{ position: "absolute", top: 44, right: 0, width: 340, maxHeight: 360, overflowY: "auto", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, zIndex: 200 }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: C.text, fontWeight: 700 }}>Notifications</span>
        <Btn variant="ghost" onClick={markAll}>Mark all read</Btn>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: 12, color: C.textMuted, fontSize: 12 }}>No notifications</div>
      ) : list.map(n => (
        <div key={n.id} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: n.read ? "transparent" : C.accentGlow }}>
          <div style={{ color: C.textSub, fontSize: 13 }}>{n.message}</div>
          <div style={{ color: C.textMuted, fontSize: 11 }}>{n.time}</div>
        </div>
      ))}
    </div>
  );
}

NotificationPanel.propTypes = {
  list: PropTypes.array.isRequired,
  markAll: PropTypes.func.isRequired,
};
