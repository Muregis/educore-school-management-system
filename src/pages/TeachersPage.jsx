import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { SUBJECTS } from "../lib/constants";
import { pager } from "../components/Helpers";
import { useEntitySync } from "../hooks/useEntitySync";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

function normalise(t) {
  return {
    id: t.teacher_id ?? t.id,
    userId: t.user_id ?? t.userId ?? null,
    staffNumber: t.staff_number ?? t.staffNumber ?? "",
    tscStaffId: t.tsc_staff_id ?? t.tscStaffId ?? "",
    firstName: t.first_name ?? t.firstName,
    lastName: t.last_name ?? t.lastName,
    email: t.email ?? "",
    phone: t.phone ?? "",
    gender: t.gender ?? "",
    status: t.status ?? "active",
    classes: t.classes ?? [],
    subjects: t.subjects ?? [],
    timetable: t.timetable ?? "",
  };
}

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center", marginTop: "var(--space-3)" }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === 1 ? "default" : "pointer" }}>‹</button>
      <span style={{ padding: "4px 10px", fontSize: "13px", color: "var(--color-text-secondary)" }}>{page} / {pages}</span>
      <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === pages ? "default" : "pointer" }}>›</button>
    </div>
  );
}

export default function TeachersPage({ auth, teachers, setTeachers, canEdit, toast }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", staffNumber: "", tscStaffId: "", gender: "", status: "active", classes: [], timetable: "", subjects: [] });
  const [loading, setLoading] = useState(false);
  const [assignmentTeachers, setAssignmentTeachers] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ classId: "", subjectId: "", isClassTeacher: false });
  const [availableClasses, setAvailableClasses] = useState([]);
  const canAssign = ["admin", "director", "superadmin"].includes(auth?.role);
  const isSyncingRef = useRef(false);
  const syncControllerRef = useRef(null);

  useEffect(() => {
    if (!auth?.token) return;
    apiFetch("/classes", { token: auth.token })
      .then(data => {
        const payload = data?.data ?? data ?? [];
        const classes = Array.isArray(payload) ? payload : [];
        setAvailableClasses(classes.map(c => c.class_name).filter(Boolean));
      })
      .catch(() => { setAvailableClasses([]); });
  }, [auth]);

  const assignmentUserForTeacher = teacher =>
    assignmentTeachers.find(t =>
      String(t.user_id) === String(teacher.userId || teacher.user_id) ||
      (t.email && teacher.email && String(t.email).toLowerCase() === String(teacher.email).toLowerCase())
    );

  const assignmentsForTeacher = teacher => assignmentUserForTeacher(teacher)?.assignments || [];

  const loadAssignmentData = async () => {
    if (!auth?.token || !canAssign) return;
    const [teacherRows, classRows, subjectRows] = await Promise.all([
      apiFetch("/teacherassignments/teachers-with-classes", { token: auth.token }),
      apiFetch("/classes", { token: auth.token }),
      apiFetch("/subjects", { token: auth.token }),
    ]);
    setAssignmentTeachers(teacherRows || []);
    setClassOptions(classRows?.data || classRows || []);
    setSubjectOptions(subjectRows || []);
  };

  useEntitySync({
    url: "/teachers",
    token: auth?.token,
    setter: async (data) => {
      setTeachers(Array.isArray(data) ? data.map(normalise) : []);
      if (canAssign) await loadAssignmentData();
      setLoading(false);
    },
    dependencies: [canAssign],
  });

  useEffect(() => {
    return () => {
      if (syncControllerRef.current) {
        syncControllerRef.current.abort();
        syncControllerRef.current = null;
      }
    };
  }, []);

  const normalised = teachers.reduce((acc, t) => {
    const normalized = normalise(t);
    if (!acc.find(item => item.id === normalized.id)) acc.push(normalized);
    return acc;
  }, []);

  const filtered = normalised.filter(t => {
    const assignments = assignmentsForTeacher(t);
    const classNames = assignments.length ? assignments.map(a => a.class_name).filter(Boolean).join(" ") : (t.classes||[]).join(" ");
    const subjectNames = assignments.length ? assignments.map(a => a.subject_name).filter(Boolean).join(" ") : (t.subjects||[]).join(" ");
    return `${t.firstName} ${t.lastName} ${t.email} ${subjectNames} ${classNames}`
      .toLowerCase().includes(q.toLowerCase()) && (status === "all" || t.status === status);
  });

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const openAdd = () => {
    setEditId(null);
    setF({ firstName: "", lastName: "", email: "", phone: "", staffNumber: "", tscStaffId: "", gender: "", status: "active", classes: [], timetable: "", subjects: [] });
    setShow(true);
  };

  const save = async () => {
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim()) return toast("Name and email required", "error");
    try {
      const body = {
        firstName: f.firstName, lastName: f.lastName, email: f.email,
        phone: f.phone || null, staffNumber: f.staffNumber || null, tscStaffId: f.tscStaffId || null,
        gender: f.gender || null, status: f.status, classes: f.classes, subjects: f.subjects, timetable: f.timetable || null
      };
      if (editId) await apiFetch(`/teachers/${editId}`, { method: "PUT", body, token: auth?.token });
      else await apiFetch(`/teachers`, { method: "POST", body, token: auth?.token });
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
    if (!window.confirm("Sync all teachers to HR staff table and create user accounts?")) return;
    toast("Starting sync...", "info");
    isSyncingRef.current = true;
    const syncController = new AbortController();
    syncControllerRef.current = syncController;
    try {
      const { jobId } = await apiFetch("/teachers/sync-hr/start", {
        method: "POST", token: auth?.token, timeoutMs: 30000, retries: 2, signal: syncController.signal
      });
      let pollCount = 0;
      while (pollCount < 120) {
        if (syncController.signal.aborted) throw new Error("Request cancelled.");
        await new Promise(r => setTimeout(r, 1000));
        const st = await apiFetch(`/teachers/sync-hr/status/${jobId}`, {
          token: auth?.token, timeoutMs: 10000, retries: 1, signal: syncController.signal
        });
        if (st.status === "completed") {
          const { syncedToHR, userAccountsCreated, userAccountsLinked, total, errors } = st.result;
          let message = `Synced ${syncedToHR}/${total} teachers to HR. Created ${userAccountsCreated} accounts. Linked ${userAccountsLinked}.`;
          toast(errors?.length ? `${message} ${errors.length} errors.` : message, errors?.length ? "warning" : "success");
          const refreshed = await apiFetch("/teachers", { token: auth.token });
          setTeachers(refreshed.map(normalise));
          if (canAssign) await loadAssignmentData();
          break;
        } else if (st.status === "failed") throw new Error(st.error || "Sync failed");
        pollCount++;
      }
      if (pollCount >= 120) toast("Sync is taking longer than expected.", "warning");
    } catch (err) {
      toast(err.message || "Sync failed", "error");
    } finally {
      isSyncingRef.current = false;
      syncControllerRef.current = null;
    }
  };

  const openAssign = teacher => {
    const userTeacher = assignmentUserForTeacher(teacher);
    if (!userTeacher?.user_id) return toast("Teacher user account not found. Click Sync to HR first.", "error");
    setAssigningTeacher({ ...teacher, userId: userTeacher.user_id });
    setAssignmentForm({ classId: "", subjectId: "", isClassTeacher: false });
    setShowAssign(true);
  };

  const saveAssignment = async () => {
    if (!assigningTeacher?.userId) return toast("Teacher user account not found", "error");
    const cls = classOptions.find(c => String(c.class_id ?? c.id) === String(assignmentForm.classId));
    if (!cls) return toast("Select a class", "error");
    const subj = subjectOptions.find(s => String(s.subject_id ?? s.id) === String(assignmentForm.subjectId));
    try {
      await apiFetch("/teacherassignments", {
        method: "POST", token: auth?.token,
        body: {
          teacherId: assigningTeacher.userId,
          classId: cls.class_id ?? cls.id ?? null,
          className: cls.class_name ?? cls.className ?? cls.name,
          subjectId: subj ? (subj.subject_id ?? subj.id) : null,
          subjectName: subj ? (subj.name ?? subj.subject_name ?? subj.subjectName) : null,
          isClassTeacher: assignmentForm.isClassTeacher,
        },
      });
      await loadAssignmentData();
      setShowAssign(false);
      toast("Class assigned", "success");
    } catch (err) {
      toast(err.message || "Failed to assign class", "error");
    }
  };

  const removeAssignment = async assignmentId => {
    if (!window.confirm("Remove this class assignment?")) return;
    try {
      await apiFetch(`/teacherassignments/${assignmentId}`, { method: "DELETE", token: auth?.token });
      await loadAssignmentData();
      toast("Assignment removed", "success");
    } catch (err) {
      toast(err.message || "Failed to remove assignment", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input placeholder="Search teacher, class, subject..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ width: "150px" }}>
            <Select value={status} onChange={e => setStatus(e.target.value)} options={[
              { value: "all", label: "All status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }
            ]} />
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => {
              const headers = ["Name","Email","Phone","Staff Number","TSC/Staff ID","Status","Classes","Subjects"];
              const exportRows = filtered.map(t => [`${t.firstName} ${t.lastName}`,t.email,t.phone||"",t.staffNumber||"",t.tscStaffId||"",t.status,(t.classes||[]).join("|"),(t.subjects||[]).join("|")]);
              const content = [headers, ...exportRows].map(r => r.join(",")).join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" })); a.download = "teachers.csv"; a.click();
              toast("Teachers CSV exported", "success");
            }}>Export CSV</Button>
            {["admin","director","superadmin"].includes(auth?.role) && <Button variant="ghost" onClick={syncToHR}>Sync to HR</Button>}
            {canEdit && <Button onClick={openAdd}>+ Add Teacher</Button>}
          </div>
        </div>
      </Card>

      {loading ? (
        <EmptyState icon="⏳" title="Loading Teachers" description="Please wait while we load the staff directory..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👨‍🏫" title="No Teachers Found" description={q || status !== "all" ? "No teachers match your search filters." : "No teachers have been added yet."} />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Name","Email","Phone","Staff No.","TSC/Staff ID","Classes","Subjects","Timetable","Status","Actions"]}
            data={rows.map(t => [
              <span key={t.id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{t.firstName} {t.lastName}</span>,
              <span key="email" style={{ color: "var(--color-text-secondary)" }}>{t.email}</span>,
              <span key="phone" style={{ color: "var(--color-text-secondary)" }}>{t.phone || "-"}</span>,
              <span key="staffNo" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{t.staffNumber || "-"}</span>,
              <span key="tscId" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{t.tscStaffId || "-"}</span>,
              <span key="classes" style={{ fontSize: "13px" }}>
                {assignmentsForTeacher(t).length ? assignmentsForTeacher(t).map(a => a.class_name).filter(Boolean).join(", ") : (t.classes||[]).join(", ") || "-"}
              </span>,
              <span key="subjects" style={{ fontSize: "13px" }}>
                {assignmentsForTeacher(t).length ? assignmentsForTeacher(t).map(a => a.subject_name).filter(Boolean).join(", ") || "General" : (t.subjects||[]).join(", ") || "-"}
              </span>,
              <span key="tt" style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{t.timetable || "-"}</span>,
              <Badge key="st" text={t.status} variant={t.status === "active" ? "success" : "danger"} />,
              <div key="a" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditId(t.id);
                    setF({ firstName: t.firstName, lastName: t.lastName, email: t.email, phone: t.phone, staffNumber: t.staffNumber, tscStaffId: t.tscStaffId, gender: t.gender, status: t.status, classes: t.classes || [], subjects: t.subjects || [], timetable: t.timetable || "" });
                    setShow(true);
                  }}>Edit</Button>
                )}
                {canAssign && <Button size="sm" variant="secondary" onClick={() => openAssign(t)}>Assign</Button>}
                {canEdit && <Button size="sm" variant="danger" onClick={() => del(t.id)}>Delete</Button>}
              </div>
            ])}
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      <Modal isOpen={show} title={editId ? "Edit Teacher" : "Add Teacher"} onClose={() => setShow(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }>
        <div className="ec-grid-auto">
          <Input label="First Name" value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} />
          <Input label="Last Name" value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} />
          <Input label="Email" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          <Input label="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          <Input label="Staff Number" value={f.staffNumber} onChange={e => setF({ ...f, staffNumber: e.target.value })} />
          <Input label="TSC / Staff ID" value={f.tscStaffId} onChange={e => setF({ ...f, tscStaffId: e.target.value })} />
          <Select label="Gender" value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })} options={[{ value: "", label: "—" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }]} />
          <Select label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          <div style={{ gridColumn: "1 / -1" }}>
            <Input label="Timetable notes" value={f.timetable} onChange={e => setF({ ...f, timetable: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAssign} title="Assign Class / Subject" onClose={() => setShowAssign(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
          <Button variant="primary" onClick={saveAssignment}>Assign</Button>
        </>
      }>
        <div className="ec-grid-auto">
          <Select label="Class" value={assignmentForm.classId} onChange={e => setAssignmentForm(prev => ({ ...prev, classId: e.target.value }))}
            options={[{ value: "", label: "Select class" }, ...classOptions.map(c => ({ value: String(c.class_id ?? c.id), label: c.class_name ?? c.name ?? String(c.class_id) }))]} />
          <Select label="Subject" value={assignmentForm.subjectId} onChange={e => setAssignmentForm(prev => ({ ...prev, subjectId: e.target.value }))}
            options={[{ value: "", label: "Select subject" }, ...subjectOptions.map(s => ({ value: String(s.subject_id ?? s.id), label: s.name ?? s.subject_name ?? String(s.subject_id) }))]} />
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={assignmentForm.isClassTeacher} onChange={e => setAssignmentForm(prev => ({ ...prev, isClassTeacher: e.target.checked }))} />
            Is class teacher
          </label>
        </div>
      </Modal>
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
