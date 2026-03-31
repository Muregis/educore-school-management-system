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
  const [logs, setLogs] = useState([]);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [studentOptions, setStudentOptions] = useState([]);
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  // OLD: const [singleForm, setSingleForm] = useState({ recipient: "", message: "" });
  const [singleForm, setSingleForm] = useState({ recipient: "", selectedStudentId: "", message: "" });
  const [bulkForm, setBulkForm] = useState({ className: "all", message: "" });
  const [sending, setSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const isParent = auth?.role === "parent";
  const isStudent = auth?.role === "student";
  const isPortal = isParent || isStudent;
  const isStaff = ["admin", "teacher", "hr", "finance", "librarian"].includes(auth?.role);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    // SMS logs removed - WhatsApp doesn't store logs server-side
    setLogs([]);
    if (isStaff) {
      try {
        const status = await apiFetch("/communication/sms-status", { token: auth.token });
        setWhatsAppStatus(status);
      } catch {
        setWhatsAppStatus(null);
      }
      try {
        const students = await apiFetch("/students", { token: auth.token });
        setStudentOptions(Array.isArray(students) ? students : []);
      } catch {
        setStudentOptions([]);
      }
    }
  }, [auth, isStaff]);

  useEffect(() => { load(); }, [load]);

  const myPhone = auth?.phone || "";
  const selectedStudent = studentOptions.find(student => String(student.student_id) === String(singleForm.selectedStudentId));
  const visibleLogs = isParent
    ? (myPhone ? logs.filter(l => l.recipient === myPhone) : logs)
    : logs;

  const sendSingle = async () => {
    if (!singleForm.recipient || !singleForm.message) return toast("Recipient and message required", "error");
    setSending(true);
    try {
      const res = await apiFetch("/communication/whatsapp", { method: "POST", body: singleForm, token: auth.token });
      if (res.waLink) {
        window.open(res.waLink, "_blank", "noopener,noreferrer");
      }
      toast(res.message || "WhatsApp chat prepared", "success");
      setShowSingle(false);
      setSingleForm({ recipient: "", selectedStudentId: "", message: "" });
    } catch (e) {
      toast(e.message || "Failed", "error");
    }
    setSending(false);
  };

  const sendBulk = async () => {
    if (!bulkForm.message) return toast("Message required", "error");
    setSending(true);
    try {
      const data = await apiFetch("/communication/whatsapp/bulk", { method: "POST", body: bulkForm, token: auth.token });
      setBulkResult(data);
      toast(data.message || `Prepared ${data.queued || 0} WhatsApp chats`, "success");
    } catch (e) {
      toast(e.message || "Failed", "error");
    }
    setSending(false);
  };

  if (isPortal) {
    return (
      <div>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 12, fontSize: 16 }}>
          {isParent ? "Messages Sent to You" : "School Announcements"}
        </div>
        {visibleLogs.length === 0 ? (
          <div style={{ color: C.textMuted, padding: 48, textAlign: "center", background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>Messages</div>
            No messages yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visibleLogs.map(l => (
              <div key={l.sms_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 14, color: C.text, marginBottom: 8, lineHeight: 1.5 }}>{l.message}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Badge tone={STATUS_TONE[l.status] || "info"}>{l.status}</Badge>
                  <span style={{ fontSize: 11, color: C.textMuted }}>
                    {l.sent_at ? new Date(l.sent_at).toLocaleString() : "Prepared"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {whatsAppStatus && !whatsAppStatus.whatsappConfigured && (
        <div style={{ background: "#451a03", border: "1px solid #f97316", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>!</span>
          <div>
            <div style={{ fontWeight: 700, color: "#fb923c" }}>School WhatsApp number not configured</div>
            <div style={{ fontSize: 12, color: "#fdba74", marginTop: 2 }}>
              Add the school WhatsApp Business number in settings before preparing chats for parents.
            </div>
          </div>
        </div>
      )}

      {whatsAppStatus?.whatsappConfigured && (
        <div style={{ background: "#052e16", border: "1px solid #16a34a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#86efac" }}>
          WhatsApp mode: semi-automated `wa.me` links using the school's WhatsApp Business line.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {canEdit && (
          <>
            <Btn onClick={() => setShowSingle(true)}>Open Parent WhatsApp</Btn>
            <Btn variant="ghost" onClick={() => { setShowBulk(true); setBulkResult(null); }}>Prepare Class WhatsApp</Btn>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: logs.length, color: C.text },
          { label: "Sent", value: logs.filter(l => l.status === "sent").length, color: C.green },
          { label: "Failed", value: logs.filter(l => l.status === "failed").length, color: C.rose },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 48, textAlign: "center", background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>Chats</div>
          No communication prepared yet.
        </div>
      ) : (
        <Table
          headers={["Recipient", "Message", "Status", "Prepared At"]}
          rows={logs.map(l => [
            <span key="r" style={{ fontSize: 13, color: C.text }}>{l.recipient}</span>,
            <div key="m" style={{ maxWidth: 300, fontSize: 12, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message}</div>,
            <Badge key="s" tone={STATUS_TONE[l.status] || "info"}>{l.status}</Badge>,
            <span key="t" style={{ fontSize: 11, color: C.textMuted }}>{l.sent_at ? new Date(l.sent_at).toLocaleString() : "Prepared"}</span>,
          ])}
        />
      )}

      {showSingle && (
        <Modal title="Prepare WhatsApp Chat" onClose={() => setShowSingle(false)}>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Parent or Student</div>
            <select
              value={singleForm.selectedStudentId}
              onChange={e => {
                const nextStudentId = e.target.value;
                const nextStudent = studentOptions.find(student => String(student.student_id) === String(nextStudentId));
                setSingleForm(f => ({
                  ...f,
                  selectedStudentId: nextStudentId,
                  recipient: nextStudent?.parent_phone || "",
                }));
              }}
              style={{ ...inputStyle }}
            >
              <option value="">Select student or parent</option>
              {studentOptions
                .filter(student => student.parent_phone)
                .map(student => (
                  <option key={student.student_id} value={student.student_id}>
                    {`${student.first_name} ${student.last_name}${student.class_name ? ` - ${student.class_name}` : ""}${student.parent_name ? ` - Parent: ${student.parent_name}` : ""}`}
                  </option>
                ))}
            </select>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
              {selectedStudent?.parent_phone
                ? `Selected parent phone: ${selectedStudent.parent_phone}`
                : "Choose a student or parent to use the saved parent phone number."}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Message</div>
            <textarea
              value={singleForm.message}
              onChange={e => setSingleForm(f => ({ ...f, message: e.target.value }))}
              style={{ ...inputStyle, height: 100, resize: "vertical" }}
              placeholder="Type your message..."
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowSingle(false)}>Cancel</Btn>
            <Btn onClick={sendSingle} disabled={sending}>{sending ? "Preparing..." : "Open WhatsApp"}</Btn>
          </div>
        </Modal>
      )}

      {showBulk && (
        <Modal title="Prepare Class WhatsApp Chats" onClose={() => setShowBulk(false)}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Target Class</div>
            <select value={bulkForm.className} onChange={e => setBulkForm(f => ({ ...f, className: e.target.value }))} style={{ ...inputStyle }}>
              <option value="all">All Classes</option>
              {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Message</div>
            <textarea
              value={bulkForm.message}
              onChange={e => setBulkForm(f => ({ ...f, message: e.target.value }))}
              style={{ ...inputStyle, height: 100, resize: "vertical" }}
              placeholder="Message to parents in the selected class..."
            />
          </div>
          {bulkResult?.links?.length > 0 && (
            <div style={{ marginTop: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 8 }}>Prepared Chats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                {bulkResult.links.map((link, index) => (
                  <a
                    key={`${link.phone}-${index}`}
                    href={link.waLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: C.accent, textDecoration: "none", fontSize: 12 }}
                  >
                    Open chat for {link.phone}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowBulk(false)}>Close</Btn>
            <Btn onClick={sendBulk} disabled={sending}>{sending ? "Preparing..." : "Prepare Chats"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

CommunicationPage.propTypes = { auth: PropTypes.object, canEdit: PropTypes.bool, toast: PropTypes.func.isRequired };
