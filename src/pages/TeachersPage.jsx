import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";
import { apiFetch } from "../lib/api";
import { Msg, pager, Pager } from "../components/Helpers";

function normalise(t) {
  return {
    id:        t.teacher_id  ?? t.id,
    staffNumber: t.staff_number ?? t.staffNumber ?? "",
    tscStaffId: t.tsc_staff_id ?? t.tscStaffId ?? "",
    firstName: t.first_name  ?? t.firstName,
    lastName:  t.last_name   ?? t.lastName,
    email:     t.email       ?? "",
    phone:     t.phone       ?? "",
    status:    t.status      ?? "active",
    classes:   t.classes     ?? [],
    subjects:  t.subjects    ?? [],
    timetable: t.timetable   ?? "",
  };
}

export default function TeachersPage({ auth, teachers, setTeachers, canEdit, toast }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", staffNumber: "", tscStaffId: "", status: "active", classes: [], timetable: "", subjects: [] });

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/teachers", { token: auth.token, signal: ac.signal })
      .then(data => setTeachers(data.map(normalise)))
      .catch(e => { if (e?.code !== "EABORT") toast("Failed to fetch teachers", "error"); });
    return () => ac.abort();
  }, [auth, setTeachers]);

  const normalised = teachers.map(t => t.first_name ? normalise(t) : t);

  const filtered = normalised.filter(t =>
    `${t.firstName} ${t.lastName} ${t.email} ${(t.subjects||[]).join(" ")} ${(t.classes||[]).join(" ")}`
      .toLowerCase().includes(q.toLowerCase()) &&
    (status === "all" || t.status === status)
  );

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const openAdd = () => {
    setEditId(null);
    setF({ firstName: "", lastName: "", email: "", phone: "", staffNumber: "", tscStaffId: "", status: "active", classes: [], timetable: "", subjects: [] });
    setShow(true);
  };

  const save = async () => {
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim()) return toast("Name and email required", "error");
    try {
      if (editId) {
        await apiFetch(`/teachers/${editId}`, {
          method: "PUT",
          body: {
            firstName: f.firstName,
            lastName: f.lastName,
            email: f.email,
            phone: f.phone || null,
            staffNumber: f.staffNumber || null,
            tscStaffId: f.tscStaffId || null,
            status: f.status,
          },
          token: auth?.token,
        });
        setTeachers(prev => prev.map(t => (t.id === editId || t.teacher_id === editId) ? { ...normalise(t), ...f, id: editId } : t));
      } else {
        const res = await apiFetch(`/teachers`, {
          method: "POST",
          body: {
            firstName: f.firstName,
            lastName: f.lastName,
            email: f.email,
            phone: f.phone || null,
            staffNumber: f.staffNumber || null,
            tscStaffId: f.tscStaffId || null,
            status: f.status,
          },
          token: auth?.token,
        });
        const newId = res.teacher_id || res.id || res.teacherId;
        setTeachers(prev => [...prev, normalise({ ...res, ...f, id: newId })]);
      }
      // Refetch to ensure consistency with backend
      const refreshed = await apiFetch("/teachers", { token: auth.token });
      setTeachers(refreshed.map(normalise));
      setShow(false);
      toast("Teacher saved", "success");
    } catch (err) { toast(err.message || "Failed to save", "error"); }
  };

  const del = async id => {
    if (!window.confirm("Delete this teacher?")) return;
    try {
      await apiFetch(`/teachers/${id}`, { method: "DELETE", token: auth?.token });
      setTeachers(prev => prev.filter(t => (t.id ?? t.teacher_id) !== id));
      toast("Teacher deleted", "success");
    } catch (err) { toast(err.message || "Delete failed", "error"); }
  };

  const syncToHR = async () => {
    if (!window.confirm("Sync all teachers to HR staff table?\n\nThis will create HR records for any teachers that don't have them yet.")) return;
    try {
      const res = await apiFetch("/teachers/sync-hr", { method: "POST", token: auth?.token });
      toast(`Synced ${res.synced} of ${res.total} teachers to HR`, res.errors ? "warning" : "success");
      if (res.errors) console.warn("Sync errors:", res.errors);
    } catch (err) { toast(err.message || "Sync failed", "error"); }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginBottom: 10 }}>
        <input style={inputStyle} value={q} onChange={e => setQ(e.target.value)} placeholder="Search teacher, class, subject" />
        <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <Btn variant="ghost" onClick={() => {
          const headers = ["Name","Email","Phone","Staff Number","TSC/Staff ID","Status","Classes","Subjects"];
          const rows = filtered.map(t => [`${t.firstName} ${t.lastName}`,t.email,t.phone||"",t.staffNumber||"",t.tscStaffId||"",t.status,(t.classes||[]).join("|"),(t.subjects||[]).join("|")]);
          const content = [headers, ...rows].map(r => r.join(",")).join("\n");
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" })); a.download = "teachers.csv"; a.click();
          toast("Teachers CSV exported", "success");
        }}>Export CSV</Btn>
        {canEdit && <Btn onClick={openAdd}>Add Teacher</Btn>}
        {["admin","director","superadmin"].includes(auth?.role) && <Btn variant="ghost" onClick={syncToHR}>Sync to HR</Btn>}
      </div>
      {filtered.length === 0 ? <Msg text="No teachers found." /> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Name","Email","Phone","Staff No.","TSC/Staff ID","Classes","Subjects","Timetable","Status","Actions"]}
              rows={rows.map(t => [
                <span key={t.id} style={{ color: C.text, fontWeight: 600 }}>{t.firstName} {t.lastName}</span>,
                t.email, t.phone || "-",
                t.staffNumber || "-",
                t.tscStaffId || "-",
                (t.classes||[]).join(", ") || "-",
                (t.subjects||[]).join(", ") || "-",
                t.timetable || "-",
                <Badge key="st" text={t.status} tone={t.status === "active" ? "success" : "danger"} />,
                <div key="a" style={{ display: "flex", gap: 6 }}>
                  {canEdit && <Btn variant="ghost" onClick={() => { setEditId(t.id); setF(t); setShow(true); }}>Edit</Btn>}
                  {canEdit && <Btn variant="danger" onClick={() => del(t.id)}>Delete</Btn>}
                </div>
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}
      {show && (
        <Modal title={editId ? "Edit Teacher" : "Add Teacher"} onClose={() => setShow(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="First Name"><input style={inputStyle} value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></Field>
            <Field label="Last Name"><input style={inputStyle} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></Field>
            <Field label="Email"><input style={inputStyle} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><input style={inputStyle} value={f.phone||""} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Staff Number"><input style={inputStyle} value={f.staffNumber||""} onChange={e => setF({ ...f, staffNumber: e.target.value })} /></Field>
            <Field label="TSC / Staff ID"><input style={inputStyle} value={f.tscStaffId||""} onChange={e => setF({ ...f, tscStaffId: e.target.value })} /></Field>
            <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option></select></Field>
            <Field label="Timetable"><input style={inputStyle} value={f.timetable||""} onChange={e => setF({ ...f, timetable: e.target.value })} /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Subjects (select all that apply)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUBJECTS.map(s => {
                  const sel = (f.subjects||[]).includes(s);
                  return (
                    <div key={s} onClick={() => setF(prev => ({ ...prev, subjects: sel ? prev.subjects.filter(x => x !== s) : [...(prev.subjects||[]), s] }))}
                      style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                        background: sel ? C.accent : C.card, color: sel ? "#fff" : C.textSub,
                        border: `1px solid ${sel ? C.accent : C.border}` }}>
                      {s}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Classes (select all that apply)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_CLASSES.map(c => {
                  const sel = (f.classes||[]).includes(c);
                  return (
                    <div key={c} onClick={() => setF(prev => ({ ...prev, classes: sel ? prev.classes.filter(x => x !== c) : [...(prev.classes||[]), c] }))}
                      style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                        background: sel ? "#22c55e" : C.card, color: sel ? "#fff" : C.textSub,
                        border: `1px solid ${sel ? "#22c55e" : C.border}` }}>
                      {c}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

TeachersPage.propTypes = {
  auth: PropTypes.object,
  teachers: PropTypes.array.isRequired,
  setTeachers: PropTypes.func.isRequired,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
};
