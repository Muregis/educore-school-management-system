import React, { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";
import { apiFetch } from "../lib/api";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Toolbar */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: "200px" }}>
            <Select 
              value={filterClass} 
              onChange={e => setFilterClass(e.target.value)}
              options={ALL_CLASSES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div style={{ flex: 1 }} />
          {canEdit && (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="secondary" onClick={() => setShowUpload(true)}>
                📂 Upload CSV
              </Button>
              <Button onClick={() => { setEditing(null); setForm({ className: filterClass, dayOfWeek: "Monday", period: "", startTime: "08:00", endTime: "09:00", subject: SUBJECTS[0], teacherId: "" }); setShowModal(true); }}>
                + Add Entry
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Timetable grid */}
      {entries.length === 0 ? (
        <EmptyState 
          icon="📅" 
          title={`No Timetable for ${filterClass}`} 
          description="Add individual entries or upload a CSV to build the schedule." 
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-3)", alignItems: "start" }}>
          {byDay.filter(d => d.items.length > 0).map(({ day, items }) => (
            <div key={day} style={{ background: "var(--color-bg-surface)", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              <div style={{ background: "var(--color-primary)", padding: "10px 14px", fontWeight: 700, fontSize: "14px", color: "#ffffff", letterSpacing: "0.02em" }}>
                {day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {items.map(e => (
                  <div key={e.timetable_id} style={{ padding: "12px 14px", borderBottom: `1px solid var(--color-border)`, position: "relative" }}>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "14px", marginBottom: "2px" }}>{e.subject}</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "2px" }}>
                      {e.start_time?.slice(0,5)} – {e.end_time?.slice(0,5)}
                      {e.period ? ` · Period ${e.period}` : ""}
                    </div>
                    {e.teacher_name && <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{e.teacher_name}</div>}
                    
                    {canEdit && (
                      <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
                        <Button size="sm" variant="secondary" onClick={() => openEdit(e)} style={{ padding: "2px 8px", fontSize: "11px", height: "auto", minHeight: "24px" }}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => remove(e.timetable_id)} style={{ padding: "2px 8px", fontSize: "11px", height: "auto", minHeight: "24px" }}>Delete</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} title={editing ? "Edit Entry" : "Add Timetable Entry"} onClose={() => { setShowModal(false); setEditing(null); }} footer={
        <>
          <Button variant="ghost" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
          <Button onClick={save}>{editing ? "Update Entry" : "Add Entry"}</Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Select 
            label="Day"
            value={form.dayOfWeek} 
            onChange={e => setForm(f => ({...f, dayOfWeek: e.target.value}))}
            options={DAYS.map(d => ({ value: d, label: d }))}
          />
          
          <Select 
            label="Subject"
            value={form.subject} 
            onChange={e => setForm(f => ({...f, subject: e.target.value}))}
            options={SUBJECTS.map(s => ({ value: s, label: s }))}
          />
          
          <Input 
            label="Start Time" 
            type="time" 
            value={form.startTime} 
            onChange={v => setForm(f => ({...f, startTime: v.target.value}))} 
          />
          
          <Input 
            label="End Time" 
            type="time" 
            value={form.endTime} 
            onChange={v => setForm(f => ({...f, endTime: v.target.value}))} 
          />
          
          <Input 
            label="Period #" 
            type="number"
            value={form.period} 
            onChange={v => setForm(f => ({...f, period: v.target.value}))} 
          />
          
          <Select 
            label="Teacher (optional)"
            value={form.teacherId} 
            onChange={e => setForm(f => ({...f, teacherId: e.target.value}))}
            options={[
              { value: "", label: "— None —" },
              ...teachers.map(t => ({ 
                value: t.teacher_id || t.id, 
                label: `${t.first_name || t.firstName} ${t.last_name || t.lastName}` 
              }))
            ]}
          />
        </div>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal isOpen={showUpload} title="Upload Timetable CSV" onClose={() => { setShowUpload(false); setCsvPreview([]); }} footer={
        <>
          <Button variant="ghost" onClick={() => { setShowUpload(false); setCsvPreview([]); }}>Cancel</Button>
          <Button onClick={uploadCSV} disabled={!csvPreview.length || uploading}>
            {uploading ? "Importing..." : `Import ${csvPreview.length} Entries`}
          </Button>
        </>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ background: "var(--color-bg-surface)", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-md)", padding: "var(--space-3)", fontSize: "13px", color: "var(--color-text-secondary)" }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--color-text-primary)" }}>CSV Format (required columns):</div>
            <code style={{ display: "block", color: "var(--color-success)", background: "var(--color-bg-base)", padding: "var(--space-2)", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-2)" }}>day_of_week,subject,start_time,end_time,period,class_name,teacher_id</code>
            <div style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>Example row:</div>
            <code style={{ display: "block", color: "var(--color-info)", background: "var(--color-bg-base)", padding: "var(--space-2)", borderRadius: "var(--radius-sm)" }}>Monday,Mathematics,08:00,09:00,1,Grade 7,</code>
            <div style={{ marginTop: "var(--space-3)", fontSize: "12px", color: "var(--color-text-muted)" }}>
              Leave teacher_id blank if not assigned. class_name overrides the selected class filter.
            </div>
          </div>
          
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
            style={{ color: "var(--color-text-primary)", fontSize: "14px", padding: "var(--space-2)" }} />

          {csvPreview.length > 0 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
                Preview — {csvPreview.length} entries found
              </div>
              <div style={{ maxHeight: "200px", overflowY: "auto", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-md)" }}>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--color-bg-surface)", zIndex: 1 }}>
                    <tr>
                      {["Day","Subject","Start","End","Period","Class"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "var(--color-text-secondary)", borderBottom: `1px solid var(--color-border)`, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(0,20).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid var(--color-border)` }}>
                        <td style={{ padding: "6px 10px", color: "var(--color-text-primary)" }}>{r.day_of_week}</td>
                        <td style={{ padding: "6px 10px", color: "var(--color-text-primary)" }}>{r.subject}</td>
                        <td style={{ padding: "6px 10px", color: "var(--color-text-secondary)" }}>{r.start_time}</td>
                        <td style={{ padding: "6px 10px", color: "var(--color-text-secondary)" }}>{r.end_time}</td>
                        <td style={{ padding: "6px 10px", color: "var(--color-text-muted)" }}>{r.period}</td>
                        <td style={{ padding: "6px 10px", color: "var(--color-text-muted)" }}>{r.class_name || filterClass}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 20 && (
                      <tr><td colSpan={6} style={{ padding: "10px", color: "var(--color-text-muted)", textAlign: "center", fontStyle: "italic", background: "var(--color-bg-surface)" }}>
                        +{csvPreview.length - 20} more rows
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

TimetablePage.propTypes = {
  auth: PropTypes.object, teachers: PropTypes.array,
  canEdit: PropTypes.bool, toast: PropTypes.func.isRequired
};