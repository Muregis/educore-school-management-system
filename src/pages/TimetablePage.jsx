import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { C, inputStyle } from "../lib/theme";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";
import { apiFetch } from "../lib/api";
import { Msg } from "../components/Helpers";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

export default function TimetablePage({ auth, teachers, canEdit, toast }) {
  const [entries, setEntries]     = useState([]);
  const [filterClass, setFilterClass] = useState(ALL_CLASSES[6]); // Grade 7 default
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm] = useState({ className: filterClass, dayOfWeek: "Monday", period: "", startTime: "08:00", endTime: "09:00", subject: SUBJECTS[0], teacherId: "" });

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch(`/timetable?className=${encodeURIComponent(filterClass)}`, { token: auth.token });
      setEntries(data);
    } catch { /* fallback silent */ }
  }, [auth, filterClass]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      if (editing) {
        await apiFetch(`/timetable/${editing.timetable_id}`, { method: "PUT", body: form, token: auth.token });
        toast("Updated", "success");
      } else {
        await apiFetch("/timetable", { method: "POST", body: form, token: auth.token });
        toast("Entry added", "success");
      }
      setShowModal(false); setEditing(null);
      load();
    } catch (e) { toast(e.message || "Save failed", "error"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await apiFetch(`/timetable/${id}`, { method: "DELETE", token: auth.token });
      toast("Deleted", "success"); load();
    } catch (e) { toast(e.message || "Delete failed", "error"); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ className: filterClass, dayOfWeek: "Monday", period: "", startTime: "08:00", endTime: "09:00", subject: SUBJECTS[0], teacherId: "" });
    setShowModal(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({ className: e.class_name, dayOfWeek: e.day_of_week, period: e.period || "", startTime: e.start_time?.slice(0,5) || "08:00", endTime: e.end_time?.slice(0,5) || "09:00", subject: e.subject, teacherId: e.teacher_id || "" });
    setShowModal(true);
  };

  // Group entries by day
  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = entries.filter(e => e.day_of_week === day).sort((a,b) => a.start_time > b.start_time ? 1 : -1);
    return acc;
  }, {});

  const cellStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select style={{ ...inputStyle, width: 160 }} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        {canEdit && <Btn onClick={openAdd}>+ Add Entry</Btn>}
      </div>

      {entries.length === 0 ? <Msg text={`No timetable for ${filterClass} yet.`} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {DAYS.map(day => (
            <div key={day}>
              <div style={{ fontWeight: 700, color: C.accent, marginBottom: 8, fontSize: 13 }}>{day}</div>
              {byDay[day].length === 0
                ? <div style={{ color: C.textMuted, fontSize: 12 }}>—</div>
                : byDay[day].map(e => (
                  <div key={e.timetable_id} style={cellStyle}>
                    <div style={{ fontWeight: 700, color: C.text }}>{e.subject}</div>
                    <div style={{ color: C.textMuted, fontSize: 11 }}>{e.start_time?.slice(0,5)}–{e.end_time?.slice(0,5)}</div>
                    {e.teacher_name && <div style={{ color: C.textSub, fontSize: 11 }}>{e.teacher_name}</div>}
                    {canEdit && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <Btn variant="ghost" onClick={() => openEdit(e)}>Edit</Btn>
                        <Btn variant="danger" onClick={() => del(e.timetable_id)}>Del</Btn>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Timetable Entry" : "Add Timetable Entry"} onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Class"><select style={inputStyle} value={form.className} onChange={e => setForm({ ...form, className: e.target.value })}>{ALL_CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Day"><select style={inputStyle} value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>{DAYS.map(d => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Subject"><select style={inputStyle} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Teacher"><select style={inputStyle} value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">— None —</option>
              {teachers.map(t => <option key={t.id ?? t.teacher_id} value={t.id ?? t.teacher_id}>{t.firstName ?? t.first_name} {t.lastName ?? t.last_name}</option>)}
            </select></Field>
            <Field label="Start Time"><input type="time" style={inputStyle} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></Field>
            <Field label="End Time"><input type="time" style={inputStyle} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></Field>
            <Field label="Period (optional)"><input type="number" style={inputStyle} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="e.g. 1" /></Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

TimetablePage.propTypes = {
  auth: PropTypes.object,
  teachers: PropTypes.array.isRequired,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
};