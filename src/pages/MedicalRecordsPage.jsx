import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { Pager, Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";

const RECORD_TYPES = [
  { id: "clinic_visit", label: "Clinic Visit" },
  { id: "vaccination", label: "Vaccination" },
  { id: "health_checkup", label: "Health Checkup" },
  { id: "medication", label: "Medication" },
  { id: "allergy", label: "Allergy" },
  { id: "medical_history", label: "Medical History" },
  { id: "consent", label: "Consent Form" },
];

const TYPE_BADGE = {
  clinic_visit: "info",
  vaccination: "success",
  health_checkup: "warning",
  medication: "danger",
  allergy: "danger",
  medical_history: "info",
  consent: "success",
};

const BLANK_RECORD = {
  student_id: "",
  record_type: "clinic_visit",
  record_date: new Date().toISOString().slice(0, 10),
  title: "",
  description: "",
  documented_by: "",
  follow_up_required: false,
  follow_up_date: "",
};

export default function MedicalRecordsPage({ auth, students, toast }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [filterClass, setFilterClass] = useState("all");

  const [showRecord, setShowRecord] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(BLANK_RECORD);
  const [formClass, setFormClass] = useState("");
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);

  const filteredStudents = filterClass === "all" 
    ? students 
    : students.filter(s => (s.className || s.class_name) === filterClass);

  const load = async (signal) => {
    setLoading(true);
    try {
      const data = await apiFetch("/medical", { token: auth.token, signal });
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e?.code !== "EABORT") toast(e.message, "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [auth]);

  const filtered = records.filter(r => {
    if (tab !== "all" && r.record_type !== tab) return false;
    return true;
  });

  const PAGE = 15;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const getStudentName = (studentId) => {
    const s = students.find(st => (st.id ?? st.student_id) === studentId);
    return s ? `${s.firstName || s.first_name} ${s.lastName || s.last_name}` : `#${studentId}`;
  };

  const openAdd = (studentId = "") => {
    setEditId(null);
    setErr("");
    setForm({ ...BLANK_RECORD, student_id: studentId });
    setShowRecord(true);
  };

  const openEdit = (r) => {
    setEditId(r.record_id);
    setForm({
      student_id: r.student_id,
      record_type: r.record_type,
      record_date: r.record_date?.slice(0, 10) || "",
      title: r.title || "",
      description: r.description || "",
      documented_by: r.documented_by || "",
      follow_up_required: r.follow_up_required || false,
      follow_up_date: r.follow_up_date?.slice(0, 10) || "",
    });
    setShowRecord(true);
  };

  const save = async () => {
    setErr("");
    if (!form.student_id) return setErr("Select a student");
    if (!form.title?.trim()) return setErr("Title is required");
    if (!form.record_type) return setErr("Record type is required");

    try {
      if (editId) {
        await apiFetch(`/medical/${editId}`, {
          method: "PUT",
          body: form,
          token: auth.token,
        });
        setRecords(prev => prev.map(r => r.record_id === editId ? { ...r, ...form } : r));
      } else {
        const result = await apiFetch("/medical", {
          method: "POST",
          body: form,
          token: auth.token,
        });
        setRecords(prev => [result, ...prev]);
      }
      setShowRecord(false);
      toast("Medical record saved", "success");
    } catch (e) {
      setErr(e.message || "Save failed");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this medical record?")) return;
    try {
      await apiFetch(`/medical/${id}`, { method: "DELETE", token: auth.token });
      setRecords(prev => prev.filter(r => r.record_id !== id));
      toast("Medical record deleted", "success");
    } catch (e) {
      toast(e.message || "Delete failed", "error");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Btn variant={tab === "all" ? "primary" : "ghost"} onClick={() => setTab("all")}>All</Btn>
        {RECORD_TYPES.map(t => (
          <Btn key={t.id} variant={tab === t.id ? "primary" : "ghost"} onClick={() => setTab(t.id)}>{t.label}</Btn>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Badge text={`Total: ${filtered.length}`} tone="info" />
        <Btn onClick={() => openAdd()}>+ Add Record</Btn>
      </div>

      {loading ? (
        <div style={{ color: C.textSub, padding: 40, textAlign: "center" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <Msg text="No medical records found." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date", "Student", "Type", "Title", "Details", "Follow-up", "Actions"]}
              rows={rows.map(r => [
                r.record_date?.slice(0, 10) || "-",
                getStudentName(r.student_id),
                <Badge key="t" text={RECORD_TYPES.find(t => t.id === r.record_type)?.label || r.record_type} tone={TYPE_BADGE[r.record_type] || "info"} />,
                <div style={{ maxWidth: 180 }}><div style={{ fontWeight: 600 }}>{r.title}</div>{r.description && <div style={{ fontSize: 11, color: C.textMuted }}>{r.description.slice(0, 60)}{r.description?.length > 60 ? "..." : ""}</div>}</div>,
                r.follow_up_required ? (
                  <Badge text={r.follow_up_date?.slice(0, 10) || "Due"} tone="warning" />
                ) : <span style={{ color: C.textMuted }}>-</span>,
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" onClick={() => openEdit(r)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => del(r.record_id)}>Delete</Btn>
                </div>,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {showRecord && (
        <Modal title={editId ? "Edit Medical Record" : "Add Medical Record"} onClose={() => setShowRecord(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Class">
              <select style={inputStyle} value={formClass} onChange={e => { setFormClass(e.target.value); setForm({ ...form, student_id: "" }); }}>
                <option value="">All Classes</option>
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Student">
              <select style={inputStyle} value={form.student_id} onChange={e => setForm({ ...form, student_id: Number(e.target.value) })}>
                <option value="">-- Select Student --</option>
                {(formClass ? filteredStudents : students).map(s => (
                  <option key={s.id ?? s.student_id} value={s.id ?? s.student_id}>
                    {s.firstName || s.first_name} {s.lastName || s.last_name} ({s.admission_number || s.admission})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Record Type">
              <select style={inputStyle} value={form.record_type} onChange={e => setForm({ ...form, record_type: e.target.value })}>
                {RECORD_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" style={inputStyle} value={form.record_date} onChange={e => setForm({ ...form, record_date: e.target.value })} />
            </Field>
            <Field label="Title" style={{ gridColumn: "1 / -1" }}>
              <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Flu symptoms, Polio vaccine dose 1" />
            </Field>
            <Field label="Description" style={{ gridColumn: "1 / -1" }}>
              <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details of the visit, symptoms, treatment given, etc." />
            </Field>
            <Field label="Documented By">
              <input style={inputStyle} value={form.documented_by} onChange={e => setForm({ ...form, documented_by: e.target.value })} placeholder="Nurse or staff name" />
            </Field>
            <Field label="Follow-up Required">
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={form.follow_up_required} onChange={e => setForm({ ...form, follow_up_required: e.target.checked })} />
                <span style={{ color: C.textSub }}>Requires follow-up</span>
              </label>
            </Field>
            {form.follow_up_required && (
              <Field label="Follow-up Date">
                <input type="date" style={inputStyle} value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} />
              </Field>
            )}
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setShowRecord(false)}>Cancel</Btn>
            <Btn onClick={save}>Save Record</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

MedicalRecordsPage.propTypes = {
  auth: PropTypes.object.isRequired,
  students: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};