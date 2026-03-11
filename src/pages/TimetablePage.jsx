import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { C, inputStyle } from "../lib/theme";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";
import { apiFetch } from "../lib/api";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

export default function TimetablePage({ auth, teachers, canEdit, toast }) {
  const [entries, setEntries]         = useState([]);
  const [filterClass, setFilterClass] = useState(ALL_CLASSES[6]);
  const [showModal, setShowModal]     = useState(false);
  const [showUpload, setShowUpload]   = useState(false);
  const [editing, setEditing]         = useState(null);
  const [csvPreview, setCsvPreview]   = useState([]);
  const [uploading, setUploading]     = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    className: filterClass, dayOfWeek: "Monday", period: "",
    startTime: "08:00", endTime: "09:00", subject: SUBJECTS[0], teacherId: ""
  });

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch(`/timetable?className=${encodeURIComponent(filterClass)}`, { token: auth.token });
      setEntries(Array.isArray(data) ? data : []);
    } catch { setEntries([]); }
  }, [auth, filterClass]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      const body = { ...form, className: filterClass };
      if (editing) {
        await apiFetch(`/timetable/${editing.timetable_id}`, { method: "PUT", body, token: auth.token });
        toast("Entry updated", "success");
      } else {
        await apiFetch("/timetable", { method: "POST", body, token: auth.token });
        toast("Entry added", "success");
      }
      setShowModal(false); setEditing(null); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await apiFetch(`/timetable/${id}`, { method: "DELETE", token: auth.token });
      setEntries(prev => prev.filter(e => e.timetable_id !== id));
      toast("Deleted", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  // ── CSV Upload ──────────────────────────────────────────────────────────────
  const parseCSV = (text) => {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g,"_"));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ""; });
      return row;
    }).filter(r => r.day_of_week && r.subject && r.start_time);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const uploadCSV = async () => {
    if (!csvPreview.length) return;
    setUploading(true);
    let ok = 0, fail = 0;
    for (const row of csvPreview) {
      try {
        await apiFetch("/timetable", {
          method: "POST",
          token: auth.token,
          body: {
            className:  row.class_name || filterClass,
            dayOfWeek:  row.day_of_week,
            period:     row.period || "",
            startTime:  row.start_time,
            endTime:    row.end_time || "",
            subject:    row.subject,
            teacherId:  row.teacher_id || null,
          }
        });
        ok++;
      } catch { fail++; }
    }
    setUploading(false);
    toast(`Imported ${ok} entries${fail ? `, ${fail} failed` : ""}`, ok > 0 ? "success" : "error");
    setCsvPreview([]);
    setShowUpload(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  // Group by day
  const byDay = DAYS.map(day => ({
    day,
    items: entries.filter(e => e.day_of_week === day).sort((a,b) => a.start_time?.localeCompare(b.start_time))
  }));

  const openEdit = (e) => {
    setEditing(e);
    setForm({ className: e.class_name, dayOfWeek: e.day_of_week, period: e.period||"",
      startTime: e.start_time?.slice(0,5)||"08:00", endTime: e.end_time?.slice(0,5)||"09:00",
      subject: e.subject, teacherId: e.teacher_id||"" });
    setShowModal(true);
  };

  return (
    <div style={{ padding: 4 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={inputStyle}>
          {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        {canEdit && (
          <>
            <Btn onClick={() => { setEditing(null); setForm({ className: filterClass, dayOfWeek: "Monday", period: "", startTime: "08:00", endTime: "09:00", subject: SUBJECTS[0], teacherId: "" }); setShowModal(true); }}>
              + Add Entry
            </Btn>
            <Btn variant="ghost" onClick={() => setShowUpload(true)}>
              📂 Upload CSV
            </Btn>
          </>
        )}
      </div>

      {/* Timetable grid */}
      {entries.length === 0 ? (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>
          No timetable entries for {filterClass}. Add entries or upload a CSV.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {byDay.filter(d => d.items.length > 0).map(({ day, items }) => (
            <div key={day} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: C.accent, padding: "8px 12px", fontWeight: 700, fontSize: 13, color: "#fff" }}>
                {day}
              </div>
              {items.map(e => (
                <div key={e.timetable_id} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{e.subject}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    {e.start_time?.slice(0,5)} – {e.end_time?.slice(0,5)}
                    {e.period ? ` · P${e.period}` : ""}
                  </div>
                  {e.teacher_name && <div style={{ fontSize: 11, color: C.textSub }}>{e.teacher_name}</div>}
                  {canEdit && (
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <Btn variant="ghost" onClick={() => openEdit(e)} style={{ fontSize: 11, padding: "2px 8px" }}>Edit</Btn>
                      <Btn variant="danger" onClick={() => remove(e.timetable_id)} style={{ fontSize: 11, padding: "2px 8px" }}>Del</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editing ? "Edit Entry" : "Add Timetable Entry"} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Day</div>
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({...f, dayOfWeek: e.target.value}))} style={{ ...inputStyle, width: "100%" }}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Subject</div>
              <select value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} style={{ ...inputStyle, width: "100%" }}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Start Time" type="time" value={form.startTime} onChange={v => setForm(f => ({...f, startTime: v}))} />
            <Field label="End Time" type="time" value={form.endTime} onChange={v => setForm(f => ({...f, endTime: v}))} />
            <Field label="Period #" value={form.period} onChange={v => setForm(f => ({...f, period: v}))} />
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Teacher (optional)</div>
              <select value={form.teacherId} onChange={e => setForm(f => ({...f, teacherId: e.target.value}))} style={{ ...inputStyle, width: "100%" }}>
                <option value="">— None —</option>
                {teachers.map(t => <option key={t.teacher_id || t.id} value={t.teacher_id || t.id}>{t.first_name || t.firstName} {t.last_name || t.lastName}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Btn>
            <Btn onClick={save}>{editing ? "Update" : "Add"}</Btn>
          </div>
        </Modal>
      )}

      {/* CSV Upload Modal */}
      {showUpload && (
        <Modal title="Upload Timetable CSV" onClose={() => { setShowUpload(false); setCsvPreview([]); }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, fontSize: 12, color: C.textSub, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>CSV Format (required columns):</div>
              <code style={{ display: "block", color: "#22c55e" }}>day_of_week,subject,start_time,end_time,period,class_name,teacher_id</code>
              <div style={{ marginTop: 6, color: C.textMuted }}>Example row:</div>
              <code style={{ display: "block", color: "#93c5fd" }}>Monday,Mathematics,08:00,09:00,1,Grade 7,</code>
              <div style={{ marginTop: 6, color: C.textMuted }}>
                Leave teacher_id blank if not assigned. class_name overrides the selected class filter.
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
              style={{ color: C.text, fontSize: 13 }} />
          </div>

          {csvPreview.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: C.text, marginBottom: 8 }}>
                Preview — {csvPreview.length} entries found
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.surface }}>
                      {["Day","Subject","Start","End","Period","Class"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(0,20).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "5px 8px", color: C.text }}>{r.day_of_week}</td>
                        <td style={{ padding: "5px 8px", color: C.text }}>{r.subject}</td>
                        <td style={{ padding: "5px 8px", color: C.textSub }}>{r.start_time}</td>
                        <td style={{ padding: "5px 8px", color: C.textSub }}>{r.end_time}</td>
                        <td style={{ padding: "5px 8px", color: C.textMuted }}>{r.period}</td>
                        <td style={{ padding: "5px 8px", color: C.textMuted }}>{r.class_name || filterClass}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 20 && (
                      <tr><td colSpan={6} style={{ padding: 8, color: C.textMuted, textAlign: "center" }}>
                        +{csvPreview.length - 20} more rows
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => { setShowUpload(false); setCsvPreview([]); }}>Cancel</Btn>
            <Btn onClick={uploadCSV} disabled={!csvPreview.length || uploading}>
              {uploading ? "Importing..." : `Import ${csvPreview.length} Entries`}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

TimetablePage.propTypes = {
  auth: PropTypes.object, teachers: PropTypes.array,
  canEdit: PropTypes.bool, toast: PropTypes.func.isRequired
};