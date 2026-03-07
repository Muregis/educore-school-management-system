import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Pager, Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
import { genId } from "../lib/utils";

const API_BASE = "http://localhost:4000/api";
const PAGE_SIZE = 10;
const pager = (arr, p) => ({ pages: Math.max(1, Math.ceil(arr.length / PAGE_SIZE)), rows: arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE) });

export default function DisciplinePage({ canEdit, toast, linkedStudentId = null }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [f, setF] = useState({ studentId: "", incidentType: "misconduct", incidentDetails: "", actionTaken: "", incidentDate: new Date().toISOString().slice(0, 10), status: "open" });
  const [err, setErr] = useState("");

  const token = (() => { try { return JSON.parse(localStorage.getItem("educore.auth") || "{}").token; } catch { return null; } })();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/discipline${linkedStudentId ? `?studentId=${linkedStudentId}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRecords(await res.json());
    } catch { /* offline */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr("");
    if (!f.studentId || !f.incidentDate) return setErr("Student ID and date are required.");
    try {
      const res = await fetch(`${API_BASE}/discipline${linkedStudentId ? `?studentId=${linkedStudentId}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: Number(f.studentId), incidentType: f.incidentType, incidentDetails: f.incidentDetails, actionTaken: f.actionTaken, incidentDate: f.incidentDate, status: f.status })
      });
      if (!res.ok) { const d = await res.json(); return setErr(d.message || "Failed to save"); }
      setShow(false);
      setF({ studentId: "", incidentType: "misconduct", incidentDetails: "", actionTaken: "", incidentDate: new Date().toISOString().slice(0, 10), status: "open" });
      toast("Incident logged", "success");
      load();
    } catch { setErr("Network error"); }
  };

  const filtered = filter === "all" ? records : records.filter(r => r.status === filter);
  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const statusTone = { open: "warning", resolved: "success", escalated: "danger" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Badge text={`Open: ${records.filter(r => r.status === "open").length}`} tone="warning" />
        <Badge text={`Resolved: ${records.filter(r => r.status === "resolved").length}`} tone="success" />
        <Badge text={`Escalated: ${records.filter(r => r.status === "escalated").length}`} tone="danger" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <select style={inputStyle} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
        </select>
        {canEdit && <Btn onClick={() => setShow(true)}>+ Log Incident</Btn>}
      </div>

      {loading ? <Msg text="Loading..." /> : filtered.length === 0 ? <Msg text="No discipline records found." /> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date", "Student", "Type", "Details", "Action Taken", "Status"]}
              rows={rows.map(r => [
                r.incident_date?.slice(0, 10),
                <span key={r.discipline_id} style={{ color: C.text, fontWeight: 600 }}>{r.first_name} {r.last_name}</span>,
                <span key="t" style={{ textTransform: "capitalize" }}>{r.incident_type}</span>,
                <span key="d" style={{ color: C.textSub }}>{r.incident_details || "-"}</span>,
                <span key="a" style={{ color: C.textSub }}>{r.action_taken || "-"}</span>,
                <Badge key="s" text={r.status} tone={statusTone[r.status] || "info"} />
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {show && (
        <Modal title="Log Discipline Incident" onClose={() => setShow(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Student ID"><input style={inputStyle} value={f.studentId} onChange={e => setF({ ...f, studentId: e.target.value })} placeholder="e.g. 3" /></Field>
            <Field label="Date"><input type="date" style={inputStyle} value={f.incidentDate} onChange={e => setF({ ...f, incidentDate: e.target.value })} /></Field>
            <Field label="Type">
              <select style={inputStyle} value={f.incidentType} onChange={e => setF({ ...f, incidentType: e.target.value })}>
                <option value="misconduct">Misconduct</option>
                <option value="bullying">Bullying</option>
                <option value="truancy">Truancy</option>
                <option value="violence">Violence</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>
            </Field>
            <Field label="Details"><input style={inputStyle} value={f.incidentDetails} onChange={e => setF({ ...f, incidentDetails: e.target.value })} placeholder="Brief description" /></Field>
            <Field label="Action Taken"><input style={inputStyle} value={f.actionTaken} onChange={e => setF({ ...f, actionTaken: e.target.value })} placeholder="e.g. Warned, Suspended" /></Field>
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

DisciplinePage.propTypes = { canEdit: PropTypes.bool.isRequired, toast: PropTypes.func.isRequired, linkedStudentId: PropTypes.number };