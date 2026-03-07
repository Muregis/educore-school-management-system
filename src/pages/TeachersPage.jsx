import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Pager, Msg, csv, pager } from "../components/Helpers";

function normalise(t) {
  return {
    id:        t.teacher_id  ?? t.id,
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
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", status: "active", classes: [], timetable: "", subjects: [] });

  useEffect(() => {
    if (auth?.token) {
      apiFetch("/teachers", { token: auth.token })
        .then(data => setTeachers(data.map(normalise)))
        .catch(e => console.warn("Failed to fetch teachers", e));
    }
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
    setF({ firstName: "", lastName: "", email: "", phone: "", status: "active", classes: [], timetable: "", subjects: [] });
    setShow(true);
  };

  const save = async () => {
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim()) return toast("Name and email required", "error");
    try {
      if (editId) {
        await apiFetch(`/teachers/${editId}`, {
          method: "PUT",
          body: { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone || null, status: f.status },
          token: auth?.token,
        });
        setTeachers(prev => prev.map(t => (t.id === editId || t.teacher_id === editId) ? { ...normalise(t), ...f, id: editId } : t));
      } else {
        const res = await apiFetch(`/teachers`, {
          method: "POST",
          body: { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone || null, status: f.status },
          token: auth?.token,
        });
        setTeachers(prev => [...prev, { ...f, id: res.teacherId }]);
      }
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

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginBottom: 10 }}>
        <input style={inputStyle} value={q} onChange={e => setQ(e.target.value)} placeholder="Search teacher, class, subject" />
        <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <Btn variant="ghost" onClick={() => { csv("teachers.csv", ["Name","Email","Phone","Status","Classes","Subjects"], filtered.map(t => [`${t.firstName} ${t.lastName}`,t.email,t.phone||"",t.status,(t.classes||[]).join("|"),(t.subjects||[]).join("|")])); toast("Teachers CSV exported","success"); }}>Export CSV</Btn>
        {canEdit && <Btn onClick={openAdd}>Add Teacher</Btn>}
      </div>
      {filtered.length === 0 ? <Msg text="No teachers found." /> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Name","Email","Phone","Classes","Subjects","Timetable","Status","Actions"]}
              rows={rows.map(t => [
                <span key={t.id} style={{ color: C.text, fontWeight: 600 }}>{t.firstName} {t.lastName}</span>,
                t.email, t.phone || "-",
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
            <Field label="Classes (comma separated)"><input style={inputStyle} value={(f.classes||[]).join(", ")} onChange={e => setF({ ...f, classes: e.target.value.split(",").map(x=>x.trim()).filter(Boolean) })} /></Field>
            <Field label="Subjects (comma separated)"><input style={inputStyle} value={(f.subjects||[]).join(", ")} onChange={e => setF({ ...f, subjects: e.target.value.split(",").map(x=>x.trim()).filter(Boolean) })} /></Field>
            <Field label="Timetable"><input style={inputStyle} value={f.timetable||""} onChange={e => setF({ ...f, timetable: e.target.value })} /></Field>
            <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option></select></Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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