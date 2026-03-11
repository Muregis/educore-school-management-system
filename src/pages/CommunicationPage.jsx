import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { ALL_CLASSES } from "../lib/constants";
import { apiFetch } from "../lib/api";

const STATUS_TONE = { sent: "success", failed: "danger", queued: "warning" };

export default function CommunicationPage({ auth, canEdit, toast }) {
  // Role guard - only admin and teacher can access this page
  if (!auth || !["admin", "teacher"].includes(auth.role)) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.textMuted }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
        <div>Access Denied</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>You don't have permission to view this page.</div>
      </div>
    );
  }
  const [logs, setLogs]             = useState([]);
  const [atStatus, setAtStatus]     = useState(null);
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk]     = useState(false);
  const [singleForm, setSingleForm] = useState({ recipient: "", message: "" });
  const [bulkForm, setBulkForm]     = useState({ className: "all", message: "" });
  const [sending, setSending]       = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const isParent = auth?.role === "parent";

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch("/communication/sms-logs", { token: auth.token });
      setLogs(Array.isArray(data) ? data : []);
    } catch { setLogs([]); }
    if (!isParent) {
      try {
        const s = await apiFetch("/communication/sms-status", { token: auth.token });
        setAtStatus(s);
      } catch { /* ignore */ }
    }
  }, [auth, isParent]);

  useEffect(() => { load(); }, [load]);

  // Parents see only messages sent to their phone number
  const myPhone = auth?.phone || "";
  const visibleLogs = isParent
    ? logs.filter(l => l.recipient === myPhone)
    : logs;

  const sendSingle = async () => {
    if (!singleForm.recipient || !singleForm.message) return toast("Recipient and message required", "error");
    setSending(true);
    try {
      const res = await apiFetch("/communication/sms", { method: "POST", body: singleForm, token: auth.token });
      if (res.sent > 0) toast("SMS sent successfully", "success");
      else if (res.queued > 0) toast("SMS queued — Africa's Talking not configured in .env", "warning");
      else toast("SMS failed", "error");
      setShowSingle(false); setSingleForm({ recipient: "", message: "" }); load();
    } catch (e) { toast(e.message || "Failed", "error"); }
    setSending(false);
  };

  const sendBulk = async () => {
    if (!bulkForm.message) return toast("Message required", "error");
    setSending(true);
    try {
      const data = await apiFetch("/communication/sms/bulk", {
        method: "POST", body: bulkForm, token: auth.token
      });
      setBulkResult(data);
      if (data.sent > 0) toast(`Sent to ${data.sent} recipients`, "success");
      else toast(`Queued ${data.queued || 0} — AT not configured`, "warning");
      load();
    } catch (e) { toast(e.message || "Failed", "error"); }
    setSending(false);
  };

  return (
    <div style={{ padding: 4 }}>

      {/* AT Config Warning — only for admin/teacher */}
      {!isParent && atStatus && !atStatus.atConfigured && (
        <div style={{ background: "#451a03", border: "1px solid #f97316", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: "#fb923c" }}>Africa&apos;s Talking not configured</div>
            <div style={{ fontSize: 12, color: "#fdba74", marginTop: 2 }}>
              Messages are queuing but not sending. Add these to your <strong>backend/.env</strong>:
            </div>
            <code style={{ display: "block", marginTop: 6, fontSize: 12, color: "#86efac", background: "#14532d", padding: "6px 10px", borderRadius: 6 }}>
              AT_API_KEY=your_key_here{"\n"}
              AT_USERNAME=your_username{"\n"}
              AT_SENDER_ID=EduCore
            </code>
            <div style={{ fontSize: 11, color: "#fdba74", marginTop: 4 }}>
              Get these from <strong>account.africastalking.com</strong> → API Key
            </div>
          </div>
        </div>
      )}

      {/* Parent view — just their messages */}
      {isParent ? (
        <div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 12, fontSize: 15 }}>Messages Sent to You</div>
          {visibleLogs.length === 0 ? (
            <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>No messages received yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleLogs.map(l => (
                <div key={l.sms_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>{l.message}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Badge tone={STATUS_TONE[l.status] || "info"}>{l.status}</Badge>
                    <span style={{ fontSize: 11, color: C.textMuted }}>
                      {l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Staff view — full logs + send buttons */
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {canEdit && (
              <>
                <Btn onClick={() => setShowSingle(true)}>📱 Send SMS</Btn>
                <Btn variant="ghost" onClick={() => { setShowBulk(true); setBulkResult(null); }}>📣 Bulk SMS to Class</Btn>
              </>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "Total", value: logs.length, color: C.text },
              { label: "Sent", value: logs.filter(l => l.status === "sent").length, color: "#22c55e" },
              { label: "Queued", value: logs.filter(l => l.status === "queued").length, color: "#f59e0b" },
              { label: "Failed", value: logs.filter(l => l.status === "failed").length, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {logs.length === 0 ? (
            <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>No messages sent yet.</div>
          ) : (
            <Table
              headers={["Recipient", "Message", "Channel", "Status", "Sent At"]}
              rows={logs.map(l => [
                <span key="r" style={{ fontSize: 13 }}>{l.recipient}</span>,
                <div key="m" style={{ maxWidth: 280, fontSize: 12, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message}</div>,
                l.channel || "sms",
                <Badge key="s" tone={STATUS_TONE[l.status] || "info"}>{l.status}</Badge>,
                <span key="t" style={{ fontSize: 11, color: C.textMuted }}>{l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}</span>
              ])}
            />
          )}
        </div>
      )}

      {/* Single SMS Modal */}
      {showSingle && (
        <Modal title="Send SMS" onClose={() => setShowSingle(false)}>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Recipient Phone (e.g. +254712345678)</div>
            <input
              type="tel"
              value={singleForm.recipient}
              onChange={e => setSingleForm(f => ({...f, recipient: e.target.value}))}
              placeholder="+254712345678"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Message</div>
            <textarea value={singleForm.message} onChange={e => setSingleForm(f => ({...f, message: e.target.value}))}
              style={{ ...inputStyle, width: "100%", height: 80, resize: "vertical" }}
              placeholder="Type your message..." />
            <div style={{ fontSize: 11, color: C.textMuted, textAlign: "right" }}>{singleForm.message.length}/160 chars</div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowSingle(false)}>Cancel</Btn>
            <Btn onClick={sendSingle} disabled={sending}>{sending ? "Sending..." : "Send SMS"}</Btn>
          </div>
        </Modal>
      )}

      {/* Bulk SMS Modal */}
      {showBulk && (
        <Modal title="Bulk SMS to Class" onClose={() => setShowBulk(false)}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Target Class</div>
            <select value={bulkForm.className} onChange={e => setBulkForm(f => ({...f, className: e.target.value}))} style={{ ...inputStyle, width: "100%" }}>
              <option value="all">All Classes</option>
              {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Message</div>
            <textarea value={bulkForm.message} onChange={e => setBulkForm(f => ({...f, message: e.target.value}))}
              style={{ ...inputStyle, width: "100%", height: 80, resize: "vertical" }}
              placeholder="Message to all parents..." />
          </div>
          {bulkResult && (
            <div style={{ marginTop: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
              Sent: <strong style={{ color: "#22c55e" }}>{bulkResult.sent}</strong> &nbsp;
              Queued: <strong style={{ color: "#f59e0b" }}>{bulkResult.queued || 0}</strong> &nbsp;
              Failed: <strong style={{ color: "#ef4444" }}>{bulkResult.failed || 0}</strong> &nbsp;
              Total: <strong>{bulkResult.total}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Btn>
            <Btn onClick={sendBulk} disabled={sending}>{sending ? "Sending..." : "Send to All"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

CommunicationPage.propTypes = { auth: PropTypes.object, canEdit: PropTypes.bool, toast: PropTypes.func.isRequired };