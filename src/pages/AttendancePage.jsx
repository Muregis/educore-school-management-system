import React, { useState, useEffect, useMemo } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { ALL_CLASSES } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Pager, Msg, csv, pager } from "../components/Helpers";

// NEW: More robust normalise with multiple fallbacks
function normalise(a) {
  let studentName = "";
  
  if (a.first_name && a.last_name) {
    studentName = `${a.first_name} ${a.last_name}`.trim();
  } else if (a.student_name) {
    studentName = a.student_name;
  } else if (a.studentName) {
    studentName = a.studentName;
  } else {
    studentName = "Unknown Student";
  }

  return {
    id:          a.attendance_id ?? a.id,
    studentId:   a.student_id    ?? a.studentId,
    studentName: studentName,
    className:   a.class_name ?? a.className ?? "",
    date:        a.attendance_date?.slice(0,10) ?? a.date ?? "",
    status:      a.status ?? "present",
  };
}

export default function AttendancePage({ 
  auth, 
  students, 
  attendance, 
  setAttendance, 
  canEdit, 
  toast, 
  feeBlocked = false, 
  onGoFees 
}) {
  const [cls, setCls] = useState("Grade 7");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterClass, setFilterClass] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(1);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState([]);

  // Fetch attendance records on mount
  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/attendance", { token: auth.token, signal: ac.signal })
      .then(data => setAttendance(data.map(normalise)))
      .catch(e => { 
        if (e?.code !== "EABORT") console.warn("Failed to load attendance", e); 
      });
    return () => ac.abort();
  }, [auth, setAttendance]);

  // Filter students for selected class
  const classStudents = useMemo(
    () => students.filter(s => 
      (s.className ?? s.class_name) === cls && 
      (s.status === "active" || s.status === "Active")
    ),
    [students, cls]
  );

  // Initialize bulk array when modal opens
  useEffect(() => {
    if (showBulk) {
      setBulk(classStudents.map(s => ({ 
        studentId: s.id ?? s.student_id, 
        status: "present" 
      })));
    }
  }, [showBulk, classStudents]);

  // Normalize attendance data
  const normalised = useMemo(
    () => attendance.map(a => a.attendance_id ? normalise(a) : a), 
    [attendance]
  );

  // Apply filters
  const filtered = normalised.filter(a =>
    (filterClass === "all" || a.className === filterClass) &&
    (!filterDate || a.date === filterDate)
  );

  // Pagination
  const { pages, rows } = pager(filtered, page);
  useEffect(() => { 
    if (page > pages && pages > 0) setPage(1); 
  }, [page, pages]);

  // Save bulk attendance
  const saveBulk = async () => {
    if (!date) return toast("Select date", "error");
    if (bulk.length === 0) return toast("No students in this class", "error");
    
    try {
      await apiFetch("/attendance/bulk", {
        method: "POST",
        body: { classId: cls, date, records: bulk },
        token: auth?.token,
      });
      
      const data = await apiFetch("/attendance", { token: auth?.token });
      setAttendance(data.map(normalise));
      setShowBulk(false);
      toast(`Attendance saved for ${cls}`, "success");
    } catch (err) {
      toast(err.message || "Save failed", "error");
    }
  };

  // Update single attendance record
  const saveEdit = async () => {
    if (!editing) return;
    
    try {
      await apiFetch(`/attendance/${editing.id}`, {
        method: "PUT",
        body: { status: editing.status, date: editing.date },
        token: auth?.token,
      });
      
      const data = await apiFetch("/attendance", { token: auth?.token });
      setAttendance(data.map(normalise));
      setEditing(null);
      toast("Attendance updated", "success");
    } catch (err) { 
      toast(err.message || "Update failed", "error"); 
    }
  };

  // Delete attendance record
  const del = async id => {
    if (!window.confirm("Delete attendance record?")) return;
    
    try {
      await apiFetch(`/attendance/${id}`, { 
        method: "DELETE", 
        token: auth?.token 
      });
      setAttendance(prev => prev.filter(a => (a.id ?? a.attendance_id) !== id));
      toast("Attendance deleted", "success");
    } catch (err) { 
      toast(err.message || "Delete failed", "error"); 
    }
  };

  // Fee block check
  if (feeBlocked) {
    return <FeeBlock onGoFees={onGoFees} pageName="Attendance Records" />;
  }

  return (
    <div>
      {/* Summary badges */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Badge 
          text={`Present: ${normalised.filter(a => a.status === "present").length}`} 
          tone="success" 
        />
        <Badge 
          text={`Absent: ${normalised.filter(a => a.status === "absent").length}`} 
          tone="danger" 
        />
        <Badge 
          text={`Late: ${normalised.filter(a => a.status === "late").length}`} 
          tone="warning" 
        />
      </div>

      {/* Filters and actions */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", 
        gap: 8, 
        marginBottom: 10 
      }}>
        <select 
          style={inputStyle} 
          value={filterClass} 
          onChange={e => setFilterClass(e.target.value)}
        >
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        
        <input 
          type="date" 
          style={inputStyle} 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)} 
        />
        
        <Btn 
          variant="ghost" 
          onClick={() => { 
            csv(
              "attendance.csv", 
              ["Date","Class","Student","Status"], 
              filtered.map(a => [a.date, a.className, a.studentName, a.status])
            ); 
            toast("Attendance CSV exported","success"); 
          }}
        >
          Export CSV
        </Btn>
        
        {canEdit && (
          <Btn onClick={() => setShowBulk(true)}>
            Bulk Mark Class
          </Btn>
        )}
      </div>

      {/* Attendance table */}
      {filtered.length === 0 ? (
        <Msg text="No attendance records." />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date","Class","Student","Status","Actions"]}
              rows={rows.map(a => [
                a.date,
                a.className,
                <span key={a.id} style={{ color: C.text, fontWeight: 600 }}>
                  {a.studentName}
                </span>,
                <Badge 
                  key="s" 
                  text={a.status} 
                  tone={
                    a.status === "present" ? "success" : 
                    a.status === "late" ? "warning" : 
                    "danger"
                  } 
                />,
                <div key="x" style={{ display: "flex", gap: 6 }}>
                  {canEdit && (
                    <Btn variant="ghost" onClick={() => setEditing(a)}>
                      Edit
                    </Btn>
                  )}
                  {canEdit && (
                    <Btn variant="danger" onClick={() => del(a.id)}>
                      Delete
                    </Btn>
                  )}
                </div>
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Bulk marking modal */}
      {showBulk && (
        <Modal title="Bulk Attendance by Class" onClose={() => setShowBulk(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Class">
              <select 
                style={inputStyle} 
                value={cls} 
                onChange={e => setCls(e.target.value)}
              >
                {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input 
                type="date" 
                style={inputStyle} 
                value={date} 
                onChange={e => setDate(e.target.value)} 
              />
            </Field>
          </div>

          {classStudents.length === 0 ? (
            <Msg text="No active students in this class." />
          ) : (
            <div style={{ 
              maxHeight: 320, 
              overflowY: "auto", 
              border: `1px solid ${C.border}`, 
              borderRadius: 10, 
              padding: 8, 
              marginBottom: 10 
            }}>
              {classStudents.map(s => {
                const sid = s.id ?? s.student_id;
                const idx = bulk.findIndex(b => b.studentId === sid);
                const val = idx >= 0 ? bulk[idx].status : "present";
                const name = s.firstName 
                  ? `${s.firstName} ${s.lastName}` 
                  : `${s.first_name} ${s.last_name}`;
                
                return (
                  <div 
                    key={sid} 
                    style={{ 
                      display: "grid", 
                      gridTemplateColumns: "1fr 150px", 
                      gap: 8, 
                      alignItems: "center", 
                      borderBottom: `1px solid ${C.border}`, 
                      padding: "8px 4px" 
                    }}
                  >
                    <div style={{ color: C.text }}>{name}</div>
                    <select 
                      style={inputStyle} 
                      value={val} 
                      onChange={e => setBulk(prev => 
                        prev.map(x => 
                          x.studentId === sid 
                            ? { ...x, status: e.target.value } 
                            : x
                        )
                      )}
                    >
                      <option value="present">present</option>
                      <option value="absent">absent</option>
                      <option value="late">late</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowBulk(false)}>
              Cancel
            </Btn>
            <Btn onClick={saveBulk}>
              Save Class Attendance
            </Btn>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Edit Attendance" onClose={() => setEditing(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Student">
              <input style={inputStyle} value={editing.studentName} disabled />
            </Field>
            <Field label="Class">
              <input style={inputStyle} value={editing.className} disabled />
            </Field>
            <Field label="Date">
              <input 
                type="date" 
                style={inputStyle} 
                value={editing.date} 
                onChange={e => setEditing({ ...editing, date: e.target.value })} 
              />
            </Field>
            <Field label="Status">
              <select 
                style={inputStyle} 
                value={editing.status} 
                onChange={e => setEditing({ ...editing, status: e.target.value })}
              >
                <option value="present">present</option>
                <option value="absent">absent</option>
                <option value="late">late</option>
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Btn>
            <Btn onClick={saveEdit}>
              Save
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

AttendancePage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  attendance: PropTypes.array.isRequired,
  setAttendance: PropTypes.func.isRequired,
  canEdit: PropTypes.bool.isRequired,
  toast: PropTypes.func.isRequired,
  feeBlocked: PropTypes.bool,
  onGoFees: PropTypes.func,
};