import { sortClasses } from "../lib/classLevels";
import { useState, useEffect, useMemo } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import QRScanner from "../components/QRScanner";
import { apiFetch } from "../lib/api";
import { parseStudentQrContent } from "../lib/qr";
import { csv, pager } from "../components/Helpers";
import { useCurrentTerm } from "../hooks/useCurrentTerm";
import { useEntitySync } from "../hooks/useEntitySync";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

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
    id: a.attendance_id ?? a.id,
    studentId: a.student_id ?? a.studentId,
    studentName: studentName,
    className: a.class_name ?? a.className ?? "",
    date: a.attendance_date?.slice(0, 10) ?? a.date ?? "",
    status: a.status ?? "present",
  };
}

export default function AttendancePage({
  auth, students, attendance, setAttendance, canEdit, toast,
  feeBlocked = false, onGoFees
}) {
  const { term: currentTermName, startDate: currentTermStart, endDate: currentTermEnd } = useCurrentTerm(auth);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState("current");
  const [cls, setCls] = useState("");
  const [date, setDate] = useState(currentTermStart || new Date().toISOString().slice(0, 10));
  const [filterClass, setFilterClass] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(1);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState([]);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);

  useEffect(() => {
    if (!auth?.token) return;
    apiFetch(`/classes`, { token: auth.token })
      .then(data => {
        const payload = data?.data ?? data ?? [];
        const classes = Array.isArray(payload) ? payload : [];
        setAvailableClasses(sortClasses(classes.map(c => c.class_name).filter(Boolean)));
      })
      .catch(e => { console.warn("Failed to load classes", e); setAvailableClasses([]); });

    apiFetch("/academic/terms", { token: auth.token })
      .then(res => {
        const list = Array.isArray(res) ? res : res?.data ?? [];
        setTerms(list);
      })
      .catch(err => {
        console.warn("Failed to load academic terms:", err);
      });
  }, [auth]);

  const activeTermInfo = useMemo(() => {
    if (selectedTerm === "all") {
      return { name: "All Terms", from: null, to: null };
    }
    if (selectedTerm === "current") {
      const active = terms.find(t => t.status === "active" || t.is_current);
      return {
        name: currentTermName || active?.term_name || active?.name || "Current Term",
        from: currentTermStart || active?.start_date || null,
        to: currentTermEnd || active?.end_date || null,
      };
    }
    const found = terms.find(t => String(t.term_id ?? t.id) === String(selectedTerm));
    if (found) {
      return {
        name: found.term_name || found.name || "Selected Term",
        from: found.start_date || null,
        to: found.end_date || null,
      };
    }
    return { name: "Term", from: null, to: null };
  }, [selectedTerm, terms, currentTermName, currentTermStart, currentTermEnd]);

  useEffect(() => {
    if (activeTermInfo.from && !filterDate) {
      setDate(activeTermInfo.from);
    }
  }, [activeTermInfo.from, filterDate]);

  const attendanceQueryUrl = useMemo(() => {
    const params = [];
    if (activeTermInfo.from) params.push(`from=${encodeURIComponent(activeTermInfo.from)}`);
    if (activeTermInfo.to) params.push(`to=${encodeURIComponent(activeTermInfo.to)}`);
    return `/attendance${params.length ? `?${params.join("&")}` : ""}`;
  }, [activeTermInfo.from, activeTermInfo.to]);

  useEntitySync({
    url: attendanceQueryUrl,
    token: auth?.token,
    setter: setAttendance,
    transform: (data) => (Array.isArray(data) ? data.map(normalise) : []),
    dependencies: [attendanceQueryUrl],
  });

  const classStudents = useMemo(
    () => students.filter(s =>
      (s.className ?? s.class_name) === cls &&
      (s.status === "active" || s.status === "Active")
    ),
    [students, cls]
  );

  useEffect(() => {
    if (showBulk) {
      setBulk(classStudents.map(s => ({ studentId: s.student_id ?? s.id, status: "" })));
    }
  }, [showBulk, classStudents]);

  const normalised = useMemo(
    () => attendance.map(a => a.attendance_id ? normalise(a) : a),
    [attendance]
  );

  const filtered = normalised.filter(a => {
    if (filterClass !== "all" && a.className !== filterClass) return false;
    if (filterDate && a.date !== filterDate) return false;
    if (activeTermInfo.from && a.date < activeTermInfo.from) return false;
    if (activeTermInfo.to && a.date > activeTermInfo.to) return false;
    return true;
  });

  const { pages, rows } = pager(filtered, page);
  useEffect(() => {
    if (page > pages && pages > 0) setPage(1);
  }, [page, pages]);

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
      const data = await apiFetch(attendanceQueryUrl, { token: auth?.token });
      setAttendance(data.map(normalise));
      setShowBulk(false);
      toast(`Attendance saved for ${cls}`, "success");
    } catch (err) {
      toast(err.message || "Save failed", "error");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await apiFetch(`/attendance/${editing.id}`, {
        method: "PUT",
        body: { status: editing.status, date: editing.date },
        token: auth?.token,
      });
      const data = await apiFetch(attendanceQueryUrl, { token: auth?.token });
      setAttendance(data.map(normalise));
      setEditing(null);
      toast("Attendance updated", "success");
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  };

  const del = async id => {
    if (!window.confirm("Delete attendance record?")) return;
    try {
      await apiFetch(`/attendance/${id}`, { method: "DELETE", token: auth?.token });
      setAttendance(prev => prev.filter(a => (a.id ?? a.attendance_id) !== id));
      toast("Attendance deleted", "success");
    } catch (err) {
      toast(err.message || "Delete failed", "error");
    }
  };

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
        String(s.student_id ?? s.id ?? "") === scannedId ||
        String(s.admission ?? s.admission_number ?? "") === scannedId
      );
      if (!student) {
        toast("Student not found", "error");
        setShowQRScanner(false);
        return;
      }
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
      const data_response = await apiFetch(attendanceQueryUrl, { token: auth?.token });
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

  if (feeBlocked) {
    return <FeeBlock onGoFees={onGoFees} pageName="Attendance Records" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="ec-kpi-grid">
        {[
          { label: "Present", value: filtered.filter(a => a.status === "present").length, tone: "success" },
          { label: "Absent", value: filtered.filter(a => a.status === "absent").length, tone: "danger" },
          { label: "Late", value: filtered.filter(a => a.status === "late").length, tone: "warning" },
        ].map((item) => (
          <Card key={item.label} style={{ background: "linear-gradient(145deg, color-mix(in srgb, var(--color-bg-card) 96%, transparent) 0%, var(--color-bg-card) 100%)", boxShadow: "var(--shadow-sm)", padding: "var(--space-4)" }}>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", fontWeight: 800 }}>
              {item.label} {activeTermInfo.name ? `(${activeTermInfo.name})` : ""}
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-text-primary)", marginTop: "var(--space-2)", fontFamily: "var(--font-heading)" }}>{item.value}</div>
            <div style={{ marginTop: "var(--space-2)" }}><Badge text={item.label} variant={item.tone} /></div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: "var(--space-4)", background: "linear-gradient(145deg, color-mix(in srgb, var(--color-bg-card) 96%, transparent) 0%, var(--color-bg-card) 100%)", boxShadow: "var(--shadow-sm)" }}>
        <div className="ec-kpi-grid">
          <Select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            options={[
              { value: "current", label: currentTermName ? `${currentTermName} (Active)` : "Current Term" },
              ...terms.map(t => ({
                value: String(t.term_id ?? t.id),
                label: `${t.term_name || t.name}${t.academic_year ? ` · ${t.academic_year}` : ""}`,
              })),
              { value: "all", label: "All Terms (Full Year)" },
            ]}
          />
          <Select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
            options={[
              { value: "all", label: "All classes" },
              ...(availableClasses ?? []).map(c => ({ value: c, label: c }))
            ]}
          />
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => {
              csv("attendance.csv", ["Date","Class","Student","Status"], filtered.map(a => [a.date, a.className, a.studentName, a.status]));
              toast("Attendance CSV exported","success");
            }}>Export CSV</Button>
            <Button variant="secondary" onClick={() => setShowQRScanner(true)}>Scan QR</Button>
            {canEdit && (
              <Button variant="primary" onClick={() => setShowBulk(true)}>Bulk Mark Class</Button>
            )}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon="📅" title="No Attendance Records" description="Try selecting a different date or class." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Date", "Class", "Student", "Status", "Actions"]}
            data={rows.map(a => [
              a.date,
              a.className,
              <span key={a.id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{a.studentName}</span>,
              <Badge key="s" text={a.status} variant={a.status === "present" ? "success" : a.status === "late" ? "warning" : "danger"} />,
              <div key="x" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {canEdit && (<Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>)}
                {canEdit && (<Button size="sm" variant="danger" onClick={() => del(a.id)}>Delete</Button>)}
              </div>
            ])}
            renderMobileCard={(_row, idx) => {
              const a = rows[idx];
              if (!a) return null;
              return (
                <div key={a.id} style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text-primary)" }}>{a.studentName}</div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: 2 }}>{a.className} · {a.date}</div>
                    </div>
                    <Badge text={a.status} variant={a.status === "present" ? "success" : a.status === "late" ? "warning" : "danger"} />
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--color-border)" }}>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => del(a.id)}>Delete</Button>
                    </div>
                  )}
                </div>
              );
            }}
          />
        </Card>
      )}

      {showBulk && (
        <Modal isOpen={showBulk} title={`Bulk Mark — ${cls || "Select Class"}`} onClose={() => setShowBulk(false)} maxWidth="560px">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Select
                label="Class"
                value={cls}
                onChange={e => setCls(e.target.value)}
                options={[{ value: "", label: "Select class" }, ...(availableClasses ?? []).map(c => ({ value: c, label: c }))]}
              />
              <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            {classStudents.length === 0 && cls && (
              <EmptyState title="No students found" description={`No active students enrolled in ${cls}.`} />
            )}
            {classStudents.length > 0 && (
              <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {classStudents.map((s, idx) => (
                  <div key={s.student_id ?? s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-2) var(--space-3)", background: "var(--color-bg-base)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{s.firstName || s.first_name} {s.lastName || s.last_name}</span>
                    <Select
                      value={bulk[idx]?.status ?? ""}
                      onChange={e => {
                        const val = e.target.value;
                        setBulk(b => b.map((item, i) => i === idx ? { ...item, status: val } : item));
                      }}
                      options={[
                        { value: "", label: "Select status" },
                        { value: "present", label: "Present" },
                        { value: "absent", label: "Absent" },
                        { value: "late", label: "Late" },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              <Button variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveBulk}>Save Attendance</Button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal isOpen={!!editing} title="Edit Attendance" onClose={() => setEditing(null)} maxWidth="400px">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Student</div>
              <div style={{ fontWeight: 700 }}>{editing.studentName}</div>
            </div>
            <Input label="Date" type="date" value={editing.date} onChange={e => setEditing(ed => ({ ...ed, date: e.target.value }))} />
            <Select
              label="Status"
              value={editing.status}
              onChange={e => setEditing(ed => ({ ...ed, status: e.target.value }))}
              options={[
                { value: "present", label: "Present" },
                { value: "absent", label: "Absent" },
                { value: "late", label: "Late" },
              ]}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {showQRScanner && (
        <Modal isOpen={showQRScanner} title="Scan Student QR for Attendance" onClose={() => setShowQRScanner(false)} maxWidth="480px">
          <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />
        </Modal>
      )}
    </div>
  );
}

AttendancePage.propTypes = {
  auth: PropTypes.object.isRequired,
  students: PropTypes.array.isRequired,
  attendance: PropTypes.array.isRequired,
  setAttendance: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  toast: PropTypes.func.isRequired,
  feeBlocked: PropTypes.bool,
  onGoFees: PropTypes.func,
};
