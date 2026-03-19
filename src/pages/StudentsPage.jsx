import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { ALL_CLASSES } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { Pager, Msg } from "../components/Helpers";
import { csv, pager } from "../lib/utils";

// Normalise a student row coming from the backend into the shape the UI expects
function normalise(s) {
  return {
    id:          s.student_id  ?? s.id,
    admission:   s.admission_number ?? s.admission,
    firstName:   s.first_name  ?? s.firstName,
    lastName:    s.last_name   ?? s.lastName,
    className:   s.class_name  ?? s.className  ?? "",
    gender:      s.gender      ?? "female",
    parentName:  s.parent_name ?? s.parentName ?? "",
    parentPhone: s.phone       ?? s.parentPhone ?? "",
    dob:         s.date_of_birth ?? s.dob ?? "",
    status:      s.status      ?? "active",
  };
}

export default function StudentsPage({ auth, students, setStudents, canEdit, results, payments, feeStructures, toast }) {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", status: "active", admission: "" });

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/students", { token: auth.token, signal: ac.signal })
      .then(data => setStudents(data.map(normalise)))
      .catch(e => { if (e?.code !== "EABORT") toast("Failed to fetch students", "error"); });
    return () => ac.abort();
  }, [auth, setStudents]);

  const expected = c => {
    const x = feeStructures.find(s => s.className === c || s.class_name === c);
    return x ? Number(x.tuition) + Number(x.activity) + Number(x.misc) : 0;
  };

  const normalised = useMemo(() => students.map(s => s.first_name ? normalise(s) : s), [students]);

  const filtered = normalised.filter(s =>
    `${s.firstName} ${s.lastName} ${s.className} ${s.admission} ${s.parentPhone || ""}`
      .toLowerCase().includes(q.toLowerCase()) &&
    (cls === "all" || s.className === cls) &&
    (status === "all" || s.status === status)
  );

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const openAdd = () => {
    setEditId(null); setErr("");
    setF({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", status: "active", admission: "" });
    setShow(true);
  };

  const save = async () => {
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("First and last name are required.");
    
    // Validate WhatsApp number format (Kenyan)
    if (f.parentPhone) {
      const cleanPhone = f.parentPhone.replace(/[^\d]/g, '');
      if (!/^2547[0-9]{8}$/.test(cleanPhone)) {
        return setErr("Invalid WhatsApp number format. Use: 2547xxxxxxxx or +2547xxxxxxxx");
      }
    }
    
    try {
      if (editId) {
        await apiFetch(`/students/${editId}`, {
          method: "PUT",
          body: { firstName: f.firstName, lastName: f.lastName, gender: f.gender, classId: null, dateOfBirth: f.dob || null, phone: f.parentPhone || null, email: null, address: null, status: f.status },
          token: auth?.token,
        });
        setStudents(prev => prev.map(s => (s.id === editId || s.student_id === editId) ? { ...normalise(s), ...f, id: editId } : s));
      } else {
        const res = await apiFetch(`/students`, {
          method: "POST",
          body: { admissionNumber: f.admission || `ADM-${Date.now()}`, firstName: f.firstName, lastName: f.lastName, gender: f.gender, classId: null, dateOfBirth: f.dob || null, phone: f.parentPhone || null, email: null, address: null, status: f.status },
          token: auth?.token,
        });
        setStudents(prev => [...prev, normalise(res)]);
      }
      setShow(false);
      toast("Student saved", "success");
    } catch (err) {
      setErr(err.message || "Save failed");
    }
  };

  const del = async id => {
    if (!window.confirm("Delete this student?")) return;
    try {
      await apiFetch(`/students/${id}`, { method: "DELETE", token: auth?.token });
      setStudents(prev => prev.filter(s => (s.id ?? s.student_id) !== id));
      toast("Student deleted", "success");
    } catch (err) { toast(err.message || "Delete failed", "error"); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Badge text={`Boys: ${normalised.filter(s => s.gender === "male").length}`} tone="info" />
        <Badge text={`Girls: ${normalised.filter(s => s.gender === "female").length}`} tone="warning" />
        <Badge text={`Total: ${normalised.length}`} tone="success" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <input style={inputStyle} value={q} onChange={e => setQ(e.target.value)} placeholder="Search students" />
        <select style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <Btn variant="ghost" onClick={() => { csv("students.csv", ["Admission","First","Last","Class","Gender","Parent","Phone","Status"], filtered.map(s => [s.admission,s.firstName,s.lastName,s.className,s.gender,s.parentName||"",s.parentPhone||"",s.status])); toast("Students CSV exported","success"); }}>Export CSV</Btn>
        {canEdit && auth.role !== "finance" && <Btn onClick={openAdd}>Add Student</Btn>}
      </div>
      {filtered.length === 0 ? <Msg text="No students found." /> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Student","Admission","Class","Parent","Status","Actions"]}
              rows={rows.map(s => [
                <div key={s.id}><div style={{ color: C.text, fontWeight: 600 }}>{s.firstName} {s.lastName}</div><div style={{ fontSize: 11, color: C.textMuted }}>{s.dob || "-"}</div></div>,
                s.admission, s.className,
                `${s.parentName || "-"} ${s.parentPhone ? `(${s.parentPhone})` : ""}`,
                <Badge key="b" text={s.status} tone={s.status === "active" ? "success" : "danger"} />,
                <div key="a" style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" onClick={() => setProfile(s)}>Profile</Btn>
                  {canEdit && auth.role !== "finance" && <Btn variant="ghost" onClick={() => { setEditId(s.id); setF(s); setShow(true); }}>Edit</Btn>}
                  {canEdit && auth.role !== "finance" && <Btn variant="danger" onClick={() => del(s.id)}>Delete</Btn>}
                </div>
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}
      {show && (
        <Modal title={editId ? "Edit Student" : "Add Student"} onClose={() => setShow(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="First Name"><input style={inputStyle} value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></Field>
            <Field label="Last Name"><input style={inputStyle} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></Field>
            <Field label="Admission"><input style={inputStyle} value={f.admission || ""} onChange={e => setF({ ...f, admission: e.target.value })} /></Field>
            <Field label="Class"><select style={inputStyle} value={f.className} onChange={e => setF({ ...f, className: e.target.value })}>{ALL_CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Gender"><select style={inputStyle} value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}><option value="female">female</option><option value="male">male</option></select></Field>
            <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option></select></Field>
            <Field label="Parent"><input style={inputStyle} value={f.parentName || ""} onChange={e => setF({ ...f, parentName: e.target.value })} /></Field>
            <Field label="Parent WhatsApp"><input style={inputStyle} value={f.parentPhone || ""} onChange={e => setF({ ...f, parentPhone: e.target.value })} placeholder="2547xxxxxxxx" /></Field>
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
      {profile && (
        <Modal title="Student Profile" onClose={() => setProfile(null)}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 17 }}>{profile.firstName} {profile.lastName}</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>{profile.admission} | {profile.className}</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>Parent: {profile.parentName} ({profile.parentPhone || "-"})</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>Expected Fees: {money(expected(profile.className))}</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>Paid: {money(payments.filter(p => (p.studentId ?? p.student_id) === profile.id && p.status === "paid").reduce((s, p) => s + Number(p.amount), 0))}</div>
          <div style={{ color: C.textSub, marginBottom: 14 }}>Results: {results.filter(r => (r.studentId ?? r.student_id) === profile.id).length}</div>
          <Btn onClick={() => { const rowsHtml = results.filter(r => (r.studentId ?? r.student_id) === profile.id).map(r => `<li>${r.subject}: ${r.marks}/${r.total || r.total_marks} (${r.grade})</li>`).join(""); const w = window.open("","_blank"); if (!w) return; w.document.write(`<h2>${profile.firstName} ${profile.lastName}</h2><p>${profile.admission}</p><ul>${rowsHtml||"<li>No results</li>"}</ul>`); w.document.close(); w.print(); }}>Export Report (Print/PDF)</Btn>
        </Modal>
      )}
    </div>
  );
}

StudentsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  setStudents: PropTypes.func.isRequired,
  canEdit: PropTypes.bool.isRequired,
  results: PropTypes.array.isRequired,
  payments: PropTypes.array.isRequired,
  feeStructures: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};
