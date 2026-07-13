import { useState, useEffect, useMemo } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import QRScanner from "../components/QRScanner";
import { ALL_CLASSES } from "../lib/constants";
import { apiFetch } from "../lib/api";
import { parseStudentQrContent } from "../lib/qr";
import { Pager, csv, pager } from "../components/Helpers";
import { useCurrentTerm } from "../hooks/useCurrentTerm";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

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
  const { term, startDate, endDate } = useCurrentTerm(auth);
  const [cls, setCls] = useState("Grade 7");
  const [date, setDate] = useState(startDate || new Date().toISOString().slice(0, 10));
  const [filterClass, setFilterClass] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(1);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState([]);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Update date when term dates change
  useEffect(() => {
    if (startDate && !filterDate) {
      setDate(startDate);
    }
  }, [startDate, filterDate]);

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
        status: "" // Default to empty instead of hardcoded "present"
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
    const resolvedClassId = classStudents[0]?.class_id ?? classStudents[0]?.classId ?? null;
    
    try {
      await apiFetch("/attendance/bulk", {
        method: "POST",
        body: { classId: resolvedClassId, className: cls, date, records: bulk },
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

  // Handle QR scan for attendance marking
  const handleQRScan = async (qrText) => {
    try {
      const parsedQr = parseStudentQrContent(qrText);
      if (!parsedQr?.studentId) {
        toast("Invalid QR code", "error");
        setShowQRScanner(false);
        return;
      }

      const scannedId = String(parsedQr.studentId).trim();

      const student = students.find(s =>
        String(s.id ?? s.student_id ?? "") === scannedId ||
        String(s.admission ?? s.admission_number ?? "") === scannedId
      );

      if (!student) {
        toast("Student not found", "error");
        setShowQRScanner(false);
        return;
      }

      // Mark attendance for today
      const today = new Date().toISOString().slice(0, 10);
      const resolvedClassId = student.class_id ?? student.classId ?? null;

      await apiFetch("/attendance/bulk", {
        method: "POST",
        body: {
          classId: resolvedClassId,
          className: student.className || student.class_name,
          date: today,
          records: [{ studentId: student.student_id || student.id, status: "present" }]
        },
        token: auth?.token,
      });

      // Refresh attendance data
      const data_response = await apiFetch("/attendance", { token: auth?.token });
      setAttendance(data_response.map(normalise));

      const studentName = student.firstName || student.first_name;
      const studentLastName = student.lastName || student.last_name;
      toast(`Attendance marked for ${studentName} ${studentLastName}`, "success");
    } catch (err) {
      console.error("QR scan error:", err);
      toast("Invalid QR code or attendance marking failed", "error");
    }
    setShowQRScanner(false);
  };

  // Fee block check
  if (feeBlocked) {
    return <FeeBlock onGoFees={onGoFees} pageName="Attendance Records" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
        {[
          { label: "Present", value: normalised.filter(a => a.status === "present").length, tone: "success" },
          { label: "Absent", value: normalised.filter(a => a.status === "absent").length, tone: "danger" },
          { label: "Late", value: normalised.filter(a => a.status === "late").length, tone: "warning" },
        ].map((item) => (
          <Card key={item.label} style={{ background: "linear-gradient(145deg, color-mix(in srgb, var(--color-bg-card) 96%, transparent) 0%, var(--color-bg-card) 100%)", boxShadow: "var(--shadow-sm)", padding: "var(--space-4)" }}>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 800 }}>{item.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "var(--space-2)", fontFamily: "var(--font-heading)" }}>{item.value}</div>
            <div style={{ marginTop: "var(--space-2)" }}><Badge text={item.label} variant={item.tone} /></div>
          </Card>
        ))}
      </div>

      {/* Filters and actions */}
      <Card style={{ padding: "var(--space-4)", background: "linear-gradient(145deg, color-mix(in srgb, var(--color-bg-card) 96%, transparent) 0%, var(--color-bg-card) 100%)", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
          gap: "var(--space-3)", 
          alignItems: "end" 
        }}>
          <Select 
            value={filterClass} 
            onChange={e => setFilterClass(e.target.value)}
            options={[
              { value: "all", label: "All classes" },
              ...ALL_CLASSES.map(c => ({ value: c, label: c }))
            ]}
          />
          
          <Input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
          />
          
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button 
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
            </Button>
            
            <Button variant="secondary" onClick={() => setShowQRScanner(true)}>
              📱 Scan QR
            </Button>
            
            {canEdit && (
              <Button variant="primary" onClick={() => setShowBulk(true)}>
                Bulk Mark Class
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Attendance table */}
      {filtered.length === 0 ? (
        <EmptyState icon="📅" title="No Attendance Records" description="Try selecting a different date or class." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Date", "Class", "Student", "Status", "Actions"]}
            data={rows.map(a => [
              a.date,
              a.className,
              <span key={a.id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                {a.studentName}
              </span>,
              <Badge 
                key="s" 
                text={a.status} 
                variant={
                  a.status === "present" ? "success" : 
                  a.status === "late" ? "warning" : 
                  "danger"
                } 
              />,
              <div key="x" style={{ display: "flex", gap: "var(--space-2)" }}>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="danger" onClick={() => del(a.id)}>
                    Delete
                  </Button>
                )}
              </div>
            ])}
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      {/* Bulk marking modal */}
      <Modal isOpen={showBulk} title="Bulk Attendance by Class" onClose={() => setShowBulk(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowBulk(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveBulk}>
            Save Class Attendance
          </Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <Select 
            label="Class"
            value={cls} 
            onChange={e => setCls(e.target.value)}
            options={ALL_CLASSES.map(c => ({ value: c, label: c }))}
          />
          <Input 
            label="Date"
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
          />
        </div>

        {classStudents.length === 0 ? (
          <EmptyState icon="👩‍🎓" title="No Active Students" description="There are no active students in this class." />
        ) : (
          <div style={{ 
            maxHeight: "320px", 
            overflowY: "auto", 
            border: "1px solid var(--color-border)", 
            borderRadius: "var(--radius-md)", 
            padding: "var(--space-2)", 
            background: "var(--color-bg-base)"
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
                    gap: "var(--space-3)", 
                    alignItems: "center", 
                    borderBottom: "1px solid var(--color-border)", 
                    padding: "var(--space-2) var(--space-2)" 
                  }}
                >
                  <div style={{ color: "var(--color-text-primary)", fontWeight: 500, fontSize: "14px" }}>{name}</div>
                  <Select 
                    value={val} 
                    onChange={e => setBulk(prev => 
                      prev.map(x => 
                        x.studentId === sid 
                          ? { ...x, status: e.target.value } 
                          : x
                      )
                    )}
                    options={[
                      { value: "present", label: "Present" },
                      { value: "absent", label: "Absent" },
                      { value: "late", label: "Late" }
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editing} title="Edit Attendance" onClose={() => setEditing(null)} footer={
        <>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveEdit}>
            Save Changes
          </Button>
        </>
      }>
        {editing && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Input label="Student" value={editing.studentName} disabled />
            <Input label="Class" value={editing.className} disabled />
            <Input 
              label="Date"
              type="date" 
              value={editing.date} 
              onChange={e => setEditing({ ...editing, date: e.target.value })} 
            />
            <Select 
              label="Status"
              value={editing.status} 
              onChange={e => setEditing({ ...editing, status: e.target.value })}
              options={[
                { value: "present", label: "Present" },
                { value: "absent", label: "Absent" },
                { value: "late", label: "Late" }
              ]}
            />
          </div>
        )}
      </Modal>
      
      {showQRScanner && (
        <QRScanner
          title="Scan Student QR for Attendance"
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
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
