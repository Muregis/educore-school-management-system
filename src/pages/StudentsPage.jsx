import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import StudentIDCard from "../components/StudentIDCard";
import QRScanner from "../components/QRScanner";
import { SUBJECTS } from "../lib/constants";
import { money, isPaidStatus } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";
import { getAuthHeaders } from "../lib/auth";
import { parseStudentQrContent } from "../lib/qr";
import { printHTML } from "../lib/print";
import { Pager } from "../components/Helpers";
import { csv, pager } from "../lib/utils";
import { useCurrentTerm } from "../hooks/useCurrentTerm";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import StatCard from "../components/ui/StatCard";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

function normalise(s) {
  return {
    id:          s.student_id  ?? s.id,
    admission:   s.admission_number ?? s.admission,
    firstName:   s.first_name  ?? s.firstName ?? "",
    lastName:    s.last_name   ?? s.lastName ?? "",
    className:   s.class_name  ?? s.className  ?? "",
    gender:      s.gender      ?? "female",
    parentName:  s.parent_name ?? s.parentName ?? "",
    parentPhone: s.parent_phone ?? s.parentPhone ?? "",
    dob:         s.date_of_birth ?? s.dob ?? "",
    nemisNumber: s.nemis_number ?? s.nemisNumber ?? "",
    bloodGroup:  s.blood_group ?? s.bloodGroup ?? "",
    allergies:   s.allergies ?? "",
    medicalConditions: s.medical_conditions ?? s.medicalConditions ?? "",
    emergencyContactName: s.emergency_contact_name ?? s.emergencyContactName ?? "",
    emergencyContactPhone: s.emergency_contact_phone ?? s.emergencyContactPhone ?? "",
    emergencyContactRelationship: s.emergency_contact_relationship ?? s.emergencyContactRelationship ?? "",
    photoUrl:    s.photo_url ?? s.photoUrl ?? "",
    status:      s.status      ?? "active",
    opening_balance: s.opening_balance ?? 0,
    opening_balance_type: s.opening_balance_type ?? "owing",
    transport_direction: s.transport_direction ?? "none",
    transport_base_fee: s.transport_base_fee ?? 0,
    lunch_enabled: s.lunch_enabled ?? false,
    lunch_daily_rate: s.lunch_daily_rate ?? 0,
    lunch_days: s.lunch_days ?? null,
    lunch_billing_type: s.lunch_billing_type ?? "daily",
    breakfast_enabled: s.breakfast_enabled ?? false,
    breakfast_daily_rate: s.breakfast_daily_rate ?? 0,
    breakfast_days: s.breakfast_days ?? null,
    breakfast_billing_type: s.breakfast_billing_type ?? "daily",
    discount_type: s.discount_type ?? null,
    discount_value: s.discount_value ?? 0,
    discount_is_percentage: s.discount_is_percentage ?? true,
  };
}

export default function StudentsPage({ auth, students, setStudents, canEdit, results, payments, feeStructures: rawFeeStructures = [], toast, school }) {
  const { term: currentTerm } = useCurrentTerm(auth);
  const feeStructures = Array.isArray(rawFeeStructures)
    ? rawFeeStructures.filter(f => (f?.term ?? f?.term_name ?? currentTerm) === currentTerm)
    : [];

  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [idCardStudent, setIdCardStudent] = useState(null);
  const [err, setErr] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const emptyFeeForm = () => ({
  opening_balance: "", opening_balance_type: "owing",
  transport_fee: "",
  transport_direction: "none", transport_base_fee: "",
  lunch_fee: "",
  lunch_enabled: false, lunch_daily_rate: "", lunch_days: "", lunch_billing_type: "termly",
  breakfast_termly_fee: "",
  breakfast_enabled: false, breakfast_daily_rate: "", breakfast_days: "", breakfast_billing_type: "termly",
  discount_type: "", discount_value: "", discount_is_percentage: true,
});

  const [f, setF] = useState({
    firstName: "", lastName: "", className: "Grade 7", gender: "female",
    parentName: "", parentPhone: "", dob: "", nemisNumber: "", bloodGroup: "",
    allergies: "", medicalConditions: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
    photoUrl: "", status: "active", admission: "",
    ...emptyFeeForm(),
  });

  const handleChange = useCallback((field, value) => {
    setF(prev => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    const loadClasses = async () => {
      if (!auth?.token) return;
      try {
        const res = await apiFetch(`/classes`, { token: auth.token });
        const payload = res?.data ?? res ?? [];
        const classes = Array.isArray(payload) ? payload : [];
        setAvailableClasses(classes.map(c => c.class_name).filter(Boolean));
      } catch (err) {
        console.warn("Failed to load classes", err);
        setAvailableClasses([]);
      }
    };
    loadClasses();
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/students", { token: auth.token, signal: ac.signal })
      .then(data => {
        const normalisedData = data.map(normalise);
        setStudents(normalisedData);
      })
      .catch(e => { 
        if (e?.code !== "EABORT") toast("Failed to fetch students: " + (e.message || ""), "error"); 
      });
    return () => ac.abort();
  }, [auth, setStudents]);

  const expected = c => {
    const x = feeStructures.find(s => s.className === c || s.class_name === c);
    return x ? Number(x.tuition) + Number(x.activity) + Number(x.misc) : 0;
  };

  const normalised = useMemo(() => {
    return students.map(s => {
      if (s.firstName) return s;
      return normalise(s);
    });
  }, [students]);

  const filtered = normalised.filter(s => {
    const searchMatch = `${s.firstName} ${s.lastName} ${s.className} ${s.admission} ${s.parentPhone || ""} ${s.nemisNumber || ""}`
      .toLowerCase().includes(q.toLowerCase());
    const classMatch = cls === "all" || s.className === cls;
    const statusMatch = status === "all" || s.status === status;
    return searchMatch && classMatch && statusMatch;
  });

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const openAdd = () => {
    setEditId(null); setErr("");
    setF({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", nemisNumber: "", bloodGroup: "", allergies: "", medicalConditions: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "", photoUrl: "", status: "active", admission: "", ...emptyFeeForm() });
    setShow(true);
  };

  const save = async () => {
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("First and last name are required.");
    if (!editId && f.admission && f.admission.trim() && Array.isArray(students) && students.length > 0) {
      const cleanAdmission = f.admission.trim();
      const existingStudent = students.find(s => 
        s && (s.admission === cleanAdmission || s.admission_number === cleanAdmission)
      );
      if (existingStudent) {
        return setErr(`Admission number "${cleanAdmission}" already exists. Please use a different admission number.`);
      }
    }
    if (f.parentPhone) {
      const cleanPhone = f.parentPhone.replace(/[^\d+]/g, '');
      const phoneRegex = /^(\+?254|0)[17][0-9]{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return setErr("Invalid Kenyan phone format. Use: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, or +2541xxxxxxxx");
      }
    }
    try {
      if (editId) {
        await apiFetch(`/students/${editId}`, {
          method: "PUT",
          body: {
            admissionNumber: f.admission || null,
            firstName: f.firstName,
            lastName: f.lastName,
            gender: f.gender,
            className: f.className || null,
            classId: null,
            dateOfBirth: f.dob || null,
            nemisNumber: f.nemisNumber || null,
            bloodGroup: f.bloodGroup || null,
            allergies: f.allergies || null,
            medicalConditions: f.medicalConditions || null,
            emergencyContactName: f.emergencyContactName || null,
            emergencyContactPhone: f.emergencyContactPhone || null,
            emergencyContactRelationship: f.emergencyContactRelationship || null,
            phone: f.parentPhone || null,
            email: null,
            address: null,
            photoUrl: f.photoUrl || null,
            status: f.status,
            parentName: f.parentName || null,
            parentPhone: f.parentPhone || null,
          },
          token: auth?.token,
        });
        const patchPayload = {
          opening_balance: parseFloat(f.opening_balance) || 0,
          opening_balance_type: f.opening_balance_type || "owing",
          transport_fee: f.transport_fee === "" ? 0 : parseFloat(f.transport_fee) || 0,
          transport_direction: f.transport_direction || "none",
          transport_base_fee: parseFloat(f.transport_base_fee) || 0,
          lunch_fee: f.lunch_fee === "" ? 0 : parseFloat(f.lunch_fee) || 0,
          lunch_enabled: Boolean(f.lunch_enabled),
          lunch_daily_rate: parseFloat(f.lunch_daily_rate) || 0,
          lunch_days: f.lunch_days ? parseInt(f.lunch_days) : null,
          lunch_billing_type: f.lunch_billing_type || "daily",
          breakfast_termly_fee: f.breakfast_termly_fee === "" ? 0 : parseFloat(f.breakfast_termly_fee) || 0,
          breakfast_enabled: Boolean(f.breakfast_enabled),
          breakfast_daily_rate: parseFloat(f.breakfast_daily_rate) || 0,
          breakfast_days: f.breakfast_days ? parseInt(f.breakfast_days) : null,
          breakfast_billing_type: f.breakfast_billing_type || "daily",
          discount_type: f.discount_type || null,
          discount_value: parseFloat(f.discount_value) || 0,
          discount_is_percentage: f.discount_is_percentage !== false,
        };
        try {
          await apiFetch(`/students/${editId}/fees`, {
            method: "PATCH",
            body: patchPayload,
            token: auth?.token,
          });
          toast('Student fee settings updated successfully', 'success');
        } catch (feeErr) {
          console.error('Fee settings failed:', feeErr);
          const errorMsg = `Fee settings failed: ${feeErr.message || 'Unknown error'} (Status: ${feeErr.status || 'N/A'})`;
          toast(errorMsg, 'error');
          return;
        }
        setStudents(prev => prev.map(s =>
          (s.student_id === editId || s.id === editId)
            ? { ...normalise(s), ...f, id: editId }
            : s
        ));
        apiFetch("/students", { token: auth.token })
          .then(data => setStudents(data.map(normalise)))
          .catch(() => {});
        setShow(false);
        toast("Student saved", "success");
      } else {
        const res = await apiFetch(`/students`, {
          method: "POST",
          body: { admissionNumber: f.admission || `ADM-${Date.now()}`, firstName: f.firstName, lastName: f.lastName, gender: f.gender, className: f.className || null, classId: null, dateOfBirth: f.dob || null, nemisNumber: f.nemisNumber || null, bloodGroup: f.bloodGroup || null, allergies: f.allergies || null, medicalConditions: f.medicalConditions || null, emergencyContactName: f.emergencyContactName || null, emergencyContactPhone: f.emergencyContactPhone || null, emergencyContactRelationship: f.emergencyContactRelationship || null, phone: f.parentPhone || null, email: null, address: null, photoUrl: f.photoUrl || null, status: f.status, parentName: f.parentName || null, parentPhone: f.parentPhone || null },
          token: auth?.token,
        });
        setStudents(prev => [...prev, normalise(res)]);
        apiFetch("/students", { token: auth.token })
          .then(data => setStudents(data.map(normalise)))
          .catch(() => {});
        setShow(false);
        toast("Student saved", "success");
      }
    } catch (err) {
      if (err.message?.includes("Admission number already exists") || 
          err.message?.includes("duplicate key") ||
          err.message?.includes("23505") ||
          err.message?.includes("ER_DUP_ENTRY")) {
        setErr(err.message || `Admission number "${f.admission}" already exists in this school. Please use a different admission number.`);
      } else {
        setErr(err.message || "Save failed");
      }
    }
  };

  const del = async id => {
    if (!window.confirm("Delete this student?")) return;
    try {
      await apiFetch(`/students/${id}`, { method: "DELETE", token: auth?.token });
      setStudents(prev => prev.filter(s => (s.student_id ?? s.id) !== id));
      toast("Student deleted", "success");
    } catch (err) { toast(err.message || "Delete failed", "error"); }
  };

  const uploadPhoto = async (studentId) => {
    if (!selectedFile) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('studentId', studentId);
      const response = await fetch(`${API_BASE}/students/upload-photo`, {
        method: 'POST',
        headers: getAuthHeaders(auth?.token),
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const result = await response.json();
      setF({ ...f, photoUrl: result.photoUrl });
      setSelectedFile(null);
      toast("Photo uploaded successfully", "success");
    } catch (error) {
      toast("Failed to upload photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast("Please select an image file", "error");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast("File size must be less than 2MB", "error");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleQRScan = async (qrText) => {
    try {
      const parsedQr = parseStudentQrContent(qrText);
      if (!parsedQr?.studentId) {
        toast("Invalid QR code", "error");
        return;
      }
      const scannedId = String(parsedQr.studentId).trim();
      const student = students.find(s =>
        String(s.student_id ?? s.id ?? "") === scannedId ||
        String(s.admission ?? s.admission_number ?? "") === scannedId
      );
      if (student) {
        setProfile(student);
        toast("Student found and profile opened", "success");
      } else {
        toast("Student not found", "error");
      }
    } catch (err) {
      toast("Invalid QR code", "error");
    }
    setShowQRScanner(false);
  };

  const openEdit = (s) => {
    setEditId(s.id);
    apiFetch(`/students/${s.id}`, { token: auth.token })
      .then(fresh => {
        setF(normalise(fresh));
        setShow(true);
      })
      .catch(err => {
        console.error('Failed to fetch fresh student data, using list data:', err);
        setF(normalise(s));
        setShow(true);
      });
  };

  const boyCount = filtered.filter(s => s.gender === "male").length;
  const girlCount = filtered.filter(s => s.gender === "female").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-3)" }}>
        {[
          { label: "Total", value: filtered.length, color: "var(--color-success)" },
          { label: "Boys", value: boyCount, color: "var(--color-primary)" },
          { label: "Girls", value: girlCount, color: "var(--color-warning)" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 12px",
              textAlign: "center",
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: "22px", fontWeight: 800, color: stat.color, fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>{stat.value}</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 600, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <Card style={{ padding: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: "var(--space-3)", alignItems: "end" }}>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, admission, phone..." />
          <Select
            value={cls}
            onChange={e => setCls(e.target.value)}
            options={[
              { value: "all", label: "All classes" },
              ...(availableClasses ?? []).map(c => ({ value: c, label: c })),
            ]}
          />
          <Select
            value={status}
            onChange={e => setStatus(e.target.value)}
            options={[
              { value: "all", label: "All status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: "var(--space-3)" }}>
          <Button variant="ghost" onClick={() => { csv("students.csv", ["Admission","First","Last","Class","Gender","Parent","Phone","Status"], filtered.map(s => [s.admission,s.firstName,s.lastName,s.className,s.gender,s.parentName||"",s.parentPhone||"",s.status])); toast("Students CSV exported","success"); }}>Export CSV</Button>
          <Button variant="secondary" onClick={() => setShowQRScanner(true)}>Scan QR</Button>
          {canEdit && auth.role !== "finance" && <Button variant="primary" onClick={openAdd}>Add Student</Button>}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon="👨‍🎓" title="No Students" description="Could not find any students matching your criteria." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Student", "Admission", "Class", "Parent", "Status", "Actions"]}
            data={rows.map(s => [
              <div key={s.id} style={{ minWidth: 140 }}>
                <div style={{ color: "var(--color-text-primary)", fontWeight: 700, fontSize: "14px", lineHeight: 1.35 }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: 2 }}>{s.dob || "—"}</div>
              </div>,
              s.admission,
              s.className || "—",
              <div key="p" style={{ minWidth: 100 }}>
                <div>{s.parentName || "—"}</div>
                {s.parentPhone && <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{s.parentPhone}</div>}
              </div>,
              <Badge key="b" text={s.status} variant={s.status === "active" ? "success" : "danger"} />,
              <div key="a" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Button size="sm" variant="ghost" onClick={() => setProfile(s)}>Profile</Button>
                <Button size="sm" variant="ghost" onClick={() => setIdCardStudent(s)}>ID</Button>
                {canEdit && auth.role !== "finance" && <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>Edit</Button>}
                {canEdit && auth.role !== "finance" && <Button size="sm" variant="danger" onClick={() => del(s.id)}>Delete</Button>}
              </div>,
            ])}
            renderMobileCard={(_row, i) => {
              const s = rows[i];
              if (!s) return null;
              return (
                <div
                  key={s.id}
                  className="ui-table-mobile-card"
                  style={{
                    padding: 16,
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-bg-card)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                        {s.firstName} {s.lastName}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: 4 }}>
                        {s.admission || "—"}{s.className ? ` · ${s.className}` : ""}
                      </div>
                    </div>
                    <Badge text={s.status} variant={s.status === "active" ? "success" : "danger"} />
                  </div>
                  {(s.parentName || s.parentPhone) && (
                    <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", padding: "10px 12px", background: "var(--color-bg-surface)", borderRadius: "var(--radius-md)" }}>
                      <div style={{ fontWeight: 600 }}>{s.parentName || "Parent"}</div>
                      {s.parentPhone && <div style={{ marginTop: 2, color: "var(--color-text-muted)" }}>{s.parentPhone}</div>}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Button size="sm" variant="ghost" onClick={() => setProfile(s)}>Profile</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIdCardStudent(s)}>ID Card</Button>
                    {canEdit && auth.role !== "finance" && (
                      <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>Edit</Button>
                    )}
                    {canEdit && auth.role !== "finance" && (
                      <Button size="sm" variant="danger" onClick={() => del(s.id)}>Delete</Button>
                    )}
                  </div>
                </div>
              );
            }}
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      <Modal isOpen={show} title={editId ? "Edit Student" : "Add Student"} onClose={() => setShow(false)} maxWidth="800px" footer={
        <>
          <Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}>{editId ? "Update Student" : "Save Student"}</Button>
        </>
      }>
        <div className="ec-grid-auto">
          <Input label="First Name" value={f.firstName} onChange={e => handleChange('firstName', e.target.value)} />
          <Input label="Last Name" value={f.lastName} onChange={e => handleChange('lastName', e.target.value)} />
          <Input label="Admission Number" value={f.admission} onChange={e => handleChange('admission', e.target.value)} placeholder="Leave blank to auto-generate" />
          <Select label="Class" value={f.className} onChange={e => handleChange('className', e.target.value)} options={(availableClasses ?? []).map(c => ({ value: c, label: c }))} />
          <Select label="Gender" value={f.gender} onChange={e => handleChange('gender', e.target.value)} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} />
          <Input label="Date of Birth" type="date" value={f.dob} onChange={e => handleChange('dob', e.target.value)} />
          <Input label="Parent Name" value={f.parentName} onChange={e => handleChange('parentName', e.target.value)} />
          <Input label="Parent Phone" value={f.parentPhone} onChange={e => handleChange('parentPhone', e.target.value)} />
          <Input label="NEMIS Number" value={f.nemisNumber} onChange={e => handleChange('nemisNumber', e.target.value)} />
          <Input label="Blood Group" value={f.bloodGroup} onChange={e => handleChange('bloodGroup', e.target.value)} />
          <Select label="Status" value={f.status} onChange={e => handleChange('status', e.target.value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </div>
        {err && <div style={{ color: "var(--color-danger)", background: "var(--color-danger-muted)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", marginTop: "var(--space-4)", fontSize: "14px", borderLeft: "4px solid var(--color-danger)" }}>{err}</div>}
      </Modal>

      {profile && (
        <Modal isOpen={!!profile} title="Student Profile" onClose={() => setProfile(null)} maxWidth="640px">
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--color-primary)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22 }}>
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </div>
            <div>
              <div style={{ color: "var(--color-text-primary)", fontWeight: 800, fontSize: "24px", fontFamily: "var(--font-heading)" }}>{profile.firstName} {profile.lastName}</div>
              <div style={{ color: "var(--color-text-muted)" }}>{profile.admission} · {profile.className}</div>
            </div>
          </div>
          <div className="ec-grid-auto">
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Gender</div><div style={{ fontWeight: 600 }}>{profile.gender}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Status</div><div style={{ fontWeight: 600 }}>{profile.status}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Parent</div><div style={{ fontWeight: 600 }}>{profile.parentName || "—"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Phone</div><div style={{ fontWeight: 600 }}>{profile.parentPhone || "—"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>DOB</div><div style={{ fontWeight: 600 }}>{profile.dob || "—"}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>NEMIS</div><div style={{ fontWeight: 600 }}>{profile.nemisNumber || "—"}</div></div>
          </div>
        </Modal>
      )}

      {idCardStudent && (
        <Modal isOpen={!!idCardStudent} title="Student ID Card" onClose={() => setIdCardStudent(null)} maxWidth="420px">
          <StudentIDCard student={idCardStudent} school={school} />
        </Modal>
      )}

      {showQRScanner && (
        <Modal isOpen={showQRScanner} title="Scan Student QR" onClose={() => setShowQRScanner(false)} maxWidth="480px">
          <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />
        </Modal>
      )}
    </div>
  );
}

StudentsPage.propTypes = {
  auth: PropTypes.object.isRequired,
  students: PropTypes.array.isRequired,
  setStudents: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
  results: PropTypes.array,
  payments: PropTypes.array,
  feeStructures: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};
