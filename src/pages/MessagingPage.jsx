import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { C, inputStyle } from "../lib/theme";

export default function MessagingPage({ auth }) {
  const [activeChat, setActiveChat] = useState(null);
  const [newMessage, setNewMessage] = useState("");

  const conversations = [
    { id: 1, name: "Jane Doe", role: "parent", last: "When is the exam?", time: "2 min ago" },
    { id: 2, name: "Mr. Smith", role: "teacher", last: "Grades ready", time: "1 hour ago" },
    { id: 3, name: "Admin", role: "admin", last: "Fee reminder", time: "3 hours ago" },
  ];

  return (
    <div style={{ display: "flex", height: "calc(100vh - 140px)", gap: 16 }}>
      <div style={{ width: 300, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <input type="text" placeholder="Search..." style={{ ...inputStyle, margin: 16, width: "calc(100% - 32px)" }} />
        {conversations.map(c => (
          <div key={c.id} onClick={() => setActiveChat(c)} style={{ padding: 16, borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
            <div style={{ fontWeight: 600, color: C.text }}>{c.name}</div>
            <div style={{ fontSize: 12, color: C.textSub }}>{c.last}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        {activeChat ? (
          <div>
            <h3 style={{ color: C.text }}>{activeChat.name}</h3>
            <div style={{ marginTop: 20, padding: 20, background: C.bg, borderRadius: 8, minHeight: 200 }}>
              <p style={{ color: C.textSub }}>Chat messages would appear here...</p>
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ ...inputStyle, flex: 1 }} />
              <button style={{ padding: "8px 16px", background: C.accent, color: "#fff", borderRadius: 6 }}>Send</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textSub }}>
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}

MessagingPage.propTypes = { auth: PropTypes.object };
