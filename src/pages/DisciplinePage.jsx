import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Pager, Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";

const PAGE_SIZE = 10;
const pager = (arr, p) => ({
  pages: Math.max(1, Math.ceil(arr.length / PAGE_SIZE)),
  rows:  arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE),
});

export default function DisciplinePage({ auth, canEdit, toast, linkedStudentId = null, students }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow]       = useState(false);
  const [page, setPage]       = useState(1);
  const [filter, setFilter]   = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [f, setF] = useState({
    studentClass:   "",
    studentId:      "",
    incidentType:   "misconduct",
    incidentDetails:"",
    actionTaken:    "",
    incidentDate:   new Date().toISOString().slice(0, 10),
    status:         "open",
  });
  const [err, setErr] = useState("");

  const filteredStudents = f.studentClass === "all" || !f.studentClass
    ? students
    : students.filter(s => (s.className || s.class_name) === f.studentClass);

  const token = auth?.token;

  const load = async () => {
    setLoading(true);
    try {
      const path = `/discipline${linkedStudentId ? `?studentId=${linkedStudentId}` : ""}`;
      const data = await apiFetch(path, { token });
      setRecords(data);
    } catch { /* offline */ }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr("");
    if (!f.studentId || !f.incidentDate) return setErr("Student ID and date are required.");
    try {
      await apiFetch("/discipline", {
        method: "POST",
        body: {
          studentId:       Number(f.studentId),
          incidentType:    f.incidentType,
          incidentDetails: f.incidentDetails,
          actionTaken:     f.actionTaken,
          incidentDate:    f.incidentDate,
          status:          f.status,
        },
        token,
      });
      setShow(false);
      setF({
        studentId: "", incidentType: "misconduct", incidentDetails: "",
        actionTaken: "", incidentDate: new Date().toISOString().slice(0, 10), status: "open",
      });
      toast("Incident logged", "success");
      load();
    } catch (e) { setErr(e.message || "Network error"); }
  };

  const filtered = filter === "all" ? records : records.filter(r => r.status === filter);
  const { pages, rows } = pager(filtered, page);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Btn variant={filter === "all"    ? "primary" : "ghost"} onClick={() => setFilter("all")}>All</Btn>
        <Btn variant={filter === "open"   ? "primary" : "ghost"} onClick={() => setFilter("open")}>Open</Btn>
        <Btn variant={filter === "closed" ? "primary" : "ghost"} onClick={() => setFilter("closed")}>Closed</Btn>
        {canEdit && <Btn onClick={() => setShow(true)}>+ Log Incident</Btn>}
      </div>

      {loading ? (
        <Msg text="Loading..." />
      ) : filtered.length === 0 ? (
        <Msg text="No discipline records found." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Student", "Type", "Date", "Action Taken", "Status"]}
              rows={rows.map(r => [
                <span key={r.discipline_id} style={{ color: C.text, fontWeight: 600 }}>
                  {r.first_name ? `${r.first_name} ${r.last_name}` : `Student #${r.student_id}`}
                </span>,
                r.incident_type,
                r.incident_date?.slice(0, 10),
                r.action_taken || "-",
                <Badge key="s" text={r.status}
                  tone={r.status === "open" ? "warning" : r.status === "closed" ? "success" : "info"} />,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {show && (
        <Modal title="Log Discipline Incident" onClose={() => setShow(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Class">
              <select style={inputStyle} value={f.studentClass} onChange={e => { setF({ ...f, studentClass: e.target.value, studentId: "" }); }}>
                <option value="">All Classes</option>
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Student">
              <select style={inputStyle} value={f.studentId} onChange={e => setF({ ...f, studentId: e.target.value })}>
                <option value="">-- Select Student --</option>
                {filteredStudents.map(s => (
                  <option key={s.id ?? s.student_id} value={s.id ?? s.student_id}>
                    {s.firstName || s.first_name} {s.lastName || s.last_name} ({s.admission_number || s.admission})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Incident Type">
              <select style={inputStyle} value={f.incidentType}
                onChange={e => setF({ ...f, incidentType: e.target.value })}>
                <option value="misconduct">Misconduct</option>
                <option value="Late coming">Late coming</option>
                <option value="Bullying">Bullying</option>
                <option value="Cheating">Cheating</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Incident Date">
              <input type="date" style={inputStyle} value={f.incidentDate}
                onChange={e => setF({ ...f, incidentDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={f.status}
                onChange={e => setF({ ...f, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="escalated">Escalated</option>
              </select>
            </Field>
            <Field label="Details" style={{ gridColumn: "span 2" }}>
              <textarea style={{ ...inputStyle, height: 70, resize: "vertical" }} value={f.incidentDetails}
                onChange={e => setF({ ...f, incidentDetails: e.target.value })} />
            </Field>
            <Field label="Action Taken" style={{ gridColumn: "span 2" }}>
              <textarea style={{ ...inputStyle, height: 60, resize: "vertical" }} value={f.actionTaken}
                onChange={e => setF({ ...f, actionTaken: e.target.value })} />
            </Field>
          </div>
          {err && <div style={{ color: "#ef4444", fontSize: 12, margin: "8px 0" }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

DisciplinePage.propTypes = {
  auth:            PropTypes.object,
  canEdit:         PropTypes.bool,
  toast:           PropTypes.func.isRequired,
  linkedStudentId: PropTypes.number,
};
