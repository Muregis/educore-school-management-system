import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { ALL_CLASSES } from "../lib/constants";
import { apiFetch } from "../lib/api";
import { Msg } from "../components/Helpers";

export default function CommunicationPage({ auth, canEdit, toast }) {
  const [logs, setLogs]           = useState([]);
  const [tab, setTab]             = useState("logs");
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk]   = useState(false);
  const [singleForm, setSingleForm] = useState({ recipient: "", message: "" });
  const [bulkForm, setBulkForm]   = useState({ className: "all", message: "" });
  const [sending, setSending]     = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch("/communication/sms-logs", { token: auth.token });
      setLogs(data);
    } catch { /* silent */ }
  }, [auth]);

  useEffect(() => { load(); }, [load]);

  const sendSingle = async () => {
    if (!singleForm.recipient || !singleForm.message) return toast("Recipient and message required", "error");
    setSending(true);
    try {
      await apiFetch("/communication/sms", { method: "POST", body: singleForm, token: auth.token });
      toast("SMS sent", "success");
      setShowSingle(false); setSingleForm({ recipient: "", message: "" });
      load();
    } catch (e) { toast(e.message || "Failed", "error"); }
    setSending(false);
  };

  const sendBulk = async () => {
    if (!bulkForm.message) return toast("Message required", "error");
    setSending(true);
    try {
      const data = await apiFetch("/communication/sms/bulk", {
        method: "POST",
        body: { className: bulkForm.className, message: bulkForm.message },
        token: auth.token
      });
      setBulkResult(data);
      toast(`Sent to ${data.sent} recipients`, "success");
      load();
    } catch (e) { toast(e.message || "Failed", "error"); }
    setSending(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Btn variant={tab === "logs" ? "primary" : "ghost"} onClick={() => setTab("logs")}>SMS Logs</Btn>
        {canEdit && <>
          <Btn onClick={() => { setShowSingle(true); setBulkResult(null); }}>+ Send SMS</Btn>
          <Btn onClick={() => { setShowBulk(true); setBulkResult(null); }}>📢 Bulk SMS to Class</Btn>
        </>}
      </div>

      {logs.length === 0 ? <Msg text="No SMS logs yet." /> : (
        <div style={{ overflowX: "auto" }}>
          <Table
            headers={["Date/Time", "Recipient", "Message", "Channel", "Status"]}
            rows={logs.map(l => [
              new Date(l.sent_at).toLocaleString(),
              l.recipient,
              <span key={l.sms_id} style={{ fontSize: 12, color: C.textSub, maxWidth: 300, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message}</span>,
              l.channel,
              <Badge key="st" text={l.status} tone={l.status === "sent" ? "success" : "warning"} />
            ])}
          />
        </div>
      )}

      {/* Single SMS */}
      {showSingle && (
        <Modal title="Send SMS" onClose={() => setShowSingle(false)}>
          <Field label="Recipient Phone">
            <input style={inputStyle} value={singleForm.recipient} onChange={e => setSingleForm({ ...singleForm, recipient: e.target.value })} placeholder="e.g. 0712345678" />
          </Field>
          <Field label="Message">
            <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={singleForm.message} onChange={e => setSingleForm({ ...singleForm, message: e.target.value })} placeholder="Type your message..." />
          </Field>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>{singleForm.message.length}/160 characters</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowSingle(false)}>Cancel</Btn>
            <Btn onClick={sendSingle} disabled={sending}>{sending ? "Sending..." : "Send SMS"}</Btn>
          </div>
        </Modal>
      )}

      {/* Bulk SMS */}
      {showBulk && (
        <Modal title="Bulk SMS to Class" onClose={() => { setShowBulk(false); setBulkResult(null); }}>
          {!bulkResult ? (
            <>
              <Field label="Send to Class">
                <select style={inputStyle} value={bulkForm.className} onChange={e => setBulkForm({ ...bulkForm, className: e.target.value })}>
                  <option value="all">All Classes (entire school)</option>
                  {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Message">
                <textarea style={{ ...inputStyle, height: 100, resize: "vertical" }} value={bulkForm.message} onChange={e => setBulkForm({ ...bulkForm, message: e.target.value })} placeholder="Type your message to all parents in this class..." />
              </Field>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
                This will send to all parent phone numbers for students in {bulkForm.className === "all" ? "all classes" : bulkForm.className}.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Btn>
                <Btn onClick={sendBulk} disabled={sending || !bulkForm.message}>{sending ? "Sending..." : "Send to Class"}</Btn>
              </div>
            </>
          ) : (
            <div>
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 32 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 4 }}>Bulk SMS Sent</div>
                <div style={{ color: C.textMuted }}>{bulkResult.sent} messages sent</div>
              </div>
              <div style={{ background: C.bg, borderRadius: 8, padding: 10, maxHeight: 150, overflowY: "auto" }}>
                {bulkResult.recipients?.map((r, i) => <div key={i} style={{ fontSize: 12, color: C.textSub, padding: "2px 0" }}>✓ {r}</div>)}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <Btn onClick={() => { setShowBulk(false); setBulkResult(null); setBulkForm({ className: "all", message: "" }); }}>Done</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

CommunicationPage.propTypes = {
  auth: PropTypes.object,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
};