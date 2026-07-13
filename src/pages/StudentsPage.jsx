import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import StudentIDCard from "../components/StudentIDCard";
import QRScanner from "../components/QRScanner";
import { ALL_CLASSES } from "../lib/constants";
import { money } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";
import { getAuthHeaders } from "../lib/auth";
import { parseStudentQrContent } from "../lib/qr";
import { printHTML } from "../lib/print";
import { Pager } from "../components/Helpers";
import { csv, pager } from "../lib/utils";

// New UI Components
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

// Normalise a student row coming from the backend into the shape the UI expects
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

export default function StudentsPage({ auth, students, setStudents, canEdit, results, payments, feeStructures, toast }) {
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
  const [f, setF] = useState({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", nemisNumber: "", bloodGroup: "", allergies: "", medicalConditions: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "", photoUrl: "", status: "active", admission: "", opening_balance: "", opening_balance_type: "owing", transport_direction: "none", transport_base_fee: "", lunch_enabled: false, lunch_daily_rate: "", lunch_days: "", lunch_billing_type: "daily", breakfast_enabled: false, breakfast_daily_rate: "", breakfast_days: "", breakfast_billing_type: "daily", discount_type: "", discount_value: "", discount_is_percentage: true });

  const handleChange = useCallback((field, value) => {
    setF(prev => ({ ...prev, [field]: value }));
  }, []);

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
    setF({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", nemisNumber: "", bloodGroup: "", allergies: "", medicalConditions: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "", photoUrl: "", status: "active", admission: "", opening_balance: "", opening_balance_type: "owing", transport_direction: "none", transport_base_fee: "", lunch_enabled: false, lunch_daily_rate: "", lunch_days: "", lunch_billing_type: "daily", breakfast_enabled: false, breakfast_daily_rate: "", breakfast_days: "", breakfast_billing_type: "daily", discount_type: "", discount_value: "", discount_is_percentage: true });
    setShow(true);
  };

  const save = async () => {
    console.log('=== SAVE STARTED ===');
    console.log('editId:', editId);
    console.log('FORM STATE f:', JSON.stringify(f, null, 2));
    console.log('Fee fields specifically:');
    console.log('- opening_balance:', f.opening_balance, typeof f.opening_balance);
    console.log('- transport_direction:', f.transport_direction, typeof f.transport_direction);
    console.log('- transport_base_fee:', f.transport_base_fee, typeof f.transport_base_fee);
    console.log('- lunch_enabled:', f.lunch_enabled, typeof f.lunch_enabled);
    console.log('- lunch_daily_rate:', f.lunch_daily_rate, typeof f.lunch_daily_rate);
    console.log('- breakfast_enabled:', f.breakfast_enabled, typeof f.breakfast_enabled);
    console.log('- breakfast_daily_rate:', f.breakfast_daily_rate, typeof f.breakfast_daily_rate);
    console.log('- discount_type:', f.discount_type, typeof f.discount_type);
    console.log('- discount_value:', f.discount_value, typeof f.discount_value);
    console.log('=== END DEBUG ===');
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("First and last name are required.");
    
    // Validate admission number uniqueness (only for new students)
    if (!editId && f.admission && f.admission.trim() && Array.isArray(students) && students.length > 0) {
      const cleanAdmission = f.admission.trim();
      // Check if admission number already exists in current students list
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
        // PUT — personal info only, no fee fields
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

        // PATCH — fee/balance fields separately, no admission number
        const patchPayload = {
          opening_balance: parseFloat(f.opening_balance) || 0,
          opening_balance_type: f.opening_balance_type || "owing",
          transport_direction: f.transport_direction || "none",
          transport_base_fee: parseFloat(f.transport_base_fee) || 0,
          lunch_enabled: Boolean(f.lunch_enabled),
          lunch_daily_rate: parseFloat(f.lunch_daily_rate) || 0,
          lunch_days: f.lunch_days ? parseInt(f.lunch_days) : null,
          lunch_billing_type: f.lunch_billing_type || "daily",
          breakfast_enabled: Boolean(f.breakfast_enabled),
          breakfast_daily_rate: parseFloat(f.breakfast_daily_rate) || 0,
          breakfast_days: f.breakfast_days ? parseInt(f.breakfast_days) : null,
          breakfast_billing_type: f.breakfast_billing_type || "daily",
          discount_type: f.discount_type || null,
          discount_value: parseFloat(f.discount_value) || 0,
          discount_is_percentage: f.discount_is_percentage !== false,
        };
        
        console.log('=== PATCH /fees CALL ===');
        console.log('URL:', `/students/${editId}/fees`);
        console.log('Payload:', JSON.stringify(patchPayload, null, 2));
        console.log('Token exists:', !!auth?.token);
        
        try {
          console.log('Making PATCH call to:', `/students/${editId}/fees`);
          const patchResponse = await apiFetch(`/students/${editId}/fees`, {
            method: "PATCH",
            body: patchPayload,
            token: auth?.token,
          });
          console.log('PATCH /fees SUCCESS:', patchResponse);
          toast('Student fee settings updated successfully', 'success');
        } catch (feeErr) {
          console.error('=== PATCH /fees FAILED ===');
          console.error('Error:', feeErr);
          console.error('Error message:', feeErr.message);
          console.error('Error status:', feeErr.status);
          console.error('Full error object:', JSON.stringify(feeErr, null, 2));
          
          // Show detailed error to user
          const errorMsg = `Fee settings failed: ${feeErr.message || 'Unknown error'} (Status: ${feeErr.status || 'N/A'})`;
          toast(errorMsg, 'error');
          
          // Don't close modal on fee error - let user try again
          return;
        }

        // Only update local state and show success if both PUT and PATCH succeeded
        setStudents(prev => prev.map(s =>
          (s.student_id === editId || s.id === editId)
            ? { ...normalise(s), ...f, id: editId }
            : s
        ));
        
        // Refresh full list to ensure we have latest data from backend
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
        
        // Refresh full list for new student
        apiFetch("/students", { token: auth.token })
          .then(data => setStudents(data.map(normalise)))
          .catch(() => {});
        setShow(false);
        toast("Student saved", "success");
      }
    } catch (err) {
      // Handle duplicate admission number error specifically
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

      if (!response.ok) {
        throw new Error('Upload failed');
      }

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Top Bar Stats */}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Badge text={`Total: ${filtered.length}`} variant="success" />
        <Badge text={`Boys: ${filtered.filter(s => s.gender === "male").length}`} variant="primary" />
        <Badge text={`Girls: ${filtered.filter(s => s.gender === "female").length}`} variant="warning" />
      </div>

      {/* Controls */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", alignItems: "end" }}>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search students..." />
          <Select 
            value={cls} 
            onChange={e => setCls(e.target.value)}
            options={[
              { value: "all", label: "All classes" },
              ...ALL_CLASSES.map(c => ({ value: c, label: c }))
            ]}
          />
          <Select 
            value={status} 
            onChange={e => setStatus(e.target.value)}
            options={[
              { value: "all", label: "All status" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" }
            ]}
          />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="ghost" onClick={() => { csv("students.csv", ["Admission","First","Last","Class","Gender","Parent","Phone","Status"], filtered.map(s => [s.admission,s.firstName,s.lastName,s.className,s.gender,s.parentName||"",s.parentPhone||"",s.status])); toast("Students CSV exported","success"); }}>Export CSV</Button>
            <Button variant="secondary" onClick={() => setShowQRScanner(true)}>📱 Scan QR</Button>
            {canEdit && auth.role !== "finance" && <Button variant="primary" onClick={openAdd}>Add Student</Button>}
          </div>
        </div>
      </Card>

      {/* Table Area */}
      {filtered.length === 0 ? (
        <EmptyState icon="👨‍🎓" title="No Students" description="Could not find any students matching your criteria." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Student", "Admission", "Class", "Parent", "Status", "Actions"]}
            data={rows.map(s => [
              <div key={s.id}>
                <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{s.dob || "-"}</div>
              </div>,
              s.admission,
              s.className,
              `${s.parentName || "-"} ${s.parentPhone ? `(${s.parentPhone})` : ""}`,
              <Badge key="b" text={s.status} variant={s.status === "active" ? "success" : "danger"} />,
              <div key="a" style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button size="sm" variant="ghost" onClick={() => setProfile(s)}>Profile</Button>
                <Button size="sm" variant="ghost" onClick={() => setIdCardStudent(s)}>🪪 ID</Button>
                {canEdit && auth.role !== "finance" && <Button size="sm" variant="secondary" onClick={() => { 
                  console.log('=== EDIT BUTTON CLICKED ===');
                  console.log('Student data from list:', JSON.stringify(s, null, 2));
                  setEditId(s.id); 
                  
                  // Fetch fresh student data to ensure all fee fields are present
                  apiFetch(`/students/${s.id}`, { token: auth.token })
                    .then(fresh => {
                      console.log('Fresh student data from API:', JSON.stringify(fresh, null, 2));
                      const normalisedData = normalise(fresh);
                      console.log('Normalised data for form:', JSON.stringify(normalisedData, null, 2));
                      setF(normalisedData);
                      setShow(true);
                    })
                    .catch(err => {
                      console.error('Failed to fetch fresh student data, using list data:', err);
                      console.log('Fallback to list data (before normalise):', JSON.stringify(s, null, 2));
                      const normalisedListData = normalise(s);
                      console.log('Normalised list data for form:', JSON.stringify(normalisedListData, null, 2));
                      setF(normalisedListData); 
                      setShow(true);
                    });
                }}>Edit</Button>}
                {canEdit && auth.role !== "finance" && <Button size="sm" variant="danger" onClick={() => del(s.id)}>Delete</Button>}
              </div>
            ])}
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      {/* Edit/Add Modal */}
      <Modal isOpen={show} title={editId ? "Edit Student" : "Add Student"} onClose={() => setShow(false)} maxWidth="800px" footer={
        <>
          <Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
          <Button variant="primary" onClick={save}>{editId ? "Update Student" : "Save Student"}</Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Input label="First Name" value={f.firstName} onChange={e => handleChange('firstName', e.target.value)} />
          <Input label="Last Name" value={f.lastName} onChange={e => handleChange('lastName', e.target.value)} />
          <Input label="Admission" value={f.admission || ""} onChange={e => handleChange('admission', e.target.value)} />
          
          <Select label="Class" value={f.className} onChange={e => handleChange('className', e.target.value)} options={ALL_CLASSES.map(c => ({ value: c, label: c }))} />
          <Select label="Gender" value={f.gender} onChange={e => handleChange('gender', e.target.value)} options={[{value:"female", label:"Female"}, {value:"male", label:"Male"}]} />
          <Select label="Status" value={f.status} onChange={e => handleChange('status', e.target.value)} options={[{value:"active", label:"Active"}, {value:"inactive", label:"Inactive"}]} />
          
          <Input label="Parent Name" value={f.parentName || ""} onChange={e => handleChange('parentName', e.target.value)} />
          <Input label="Parent WhatsApp" value={f.parentPhone || ""} onChange={e => handleChange('parentPhone', e.target.value)} placeholder="07xxxxxxxx" />
          <Input label="Date of Birth" type="date" value={f.dob || ""} onChange={e => handleChange('dob', e.target.value)} />
          <Input label="NEMIS Number" value={f.nemisNumber || ""} onChange={e => handleChange('nemisNumber', e.target.value.toUpperCase())} placeholder="e.g. NEM12345678" />
          
          <Select label="Blood Group" value={f.bloodGroup || ""} onChange={e => handleChange('bloodGroup', e.target.value)} options={[{value:"", label:"-- Select --"}, {value:"A+", label:"A+"}, {value:"A-", label:"A-"}, {value:"B+", label:"B+"}, {value:"B-", label:"B-"}, {value:"O+", label:"O+"}, {value:"O-", label:"O-"}, {value:"AB+", label:"AB+"}, {value:"AB-", label:"AB-"}]} />
          <Input label="Allergies" value={f.allergies || ""} onChange={e => handleChange('allergies', e.target.value)} placeholder="e.g. Peanuts" />
          
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Medical Conditions</label>
            <textarea 
              style={{
                width: '100%',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                outline: 'none',
                minHeight: '60px',
                resize: 'vertical'
              }} 
              value={f.medicalConditions || ""} 
              onChange={e => handleChange('medicalConditions', e.target.value)} 
              placeholder="Any medical conditions or special needs" 
            />
          </div>

          <Input label="Emergency Contact" value={f.emergencyContactName || ""} onChange={e => handleChange('emergencyContactName', e.target.value)} placeholder="Name" />
          <Input label="Emergency Phone" value={f.emergencyContactPhone || ""} onChange={e => handleChange('emergencyContactPhone', e.target.value)} placeholder="07xxxxxxxx" />
          <Input label="Relationship" value={f.emergencyContactRelationship || ""} onChange={e => handleChange('emergencyContactRelationship', e.target.value)} placeholder="e.g. Parent, Guardian" />
          
          {/* Transport */}
          <div style={{ gridColumn: "1 / -1", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Transport Settings</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Select value={f.transport_direction || "none"} onChange={e => handleChange('transport_direction', e.target.value)} options={[
                { value: "none", label: "No Transport" },
                { value: "one_way", label: "One Way (60% fee)" },
                { value: "two_way", label: "Two Way (100% fee)" }
              ]} />
              <Input type="number" value={f.transport_base_fee || ""} onChange={e => handleChange('transport_base_fee', e.target.value ? parseFloat(e.target.value) || 0 : 0)} placeholder="Base transport fee (KES)" disabled={f.transport_direction === "none"} />
            </div>
          </div>

          {/* Lunch */}
          <div style={{ gridColumn: "1 / -1", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Lunch Program</div>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", marginBottom: "var(--space-3)", color: "var(--color-text-primary)", fontSize: "14px" }}>
              <input type="checkbox" checked={f.lunch_enabled || false} onChange={e => handleChange('lunch_enabled', e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
              <span>Enrolled in lunch program</span>
            </label>
            {f.lunch_enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                <Select value={f.lunch_billing_type || 'daily'} onChange={e => handleChange('lunch_billing_type', e.target.value)} options={[{value:"daily", label:"Daily Rate"}, {value:"termly", label:"Termly Rate"}]} />
                <Input type="number" value={f.lunch_daily_rate || ""} onChange={e => handleChange('lunch_daily_rate', e.target.value ? parseFloat(e.target.value) || 0 : 0)} placeholder={f.lunch_billing_type === 'termly' ? "Termly rate (KES)" : "Daily rate (KES)"} />
                {f.lunch_billing_type !== 'termly' && (
                  <Input type="number" value={f.lunch_days || ""} onChange={e => handleChange('lunch_days', e.target.value)} placeholder="School days (optional)" />
                )}
              </div>
            )}
          </div>

          {/* Breakfast */}
          <div style={{ gridColumn: "1 / -1", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Breakfast Program</div>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", marginBottom: "var(--space-3)", color: "var(--color-text-primary)", fontSize: "14px" }}>
              <input type="checkbox" checked={f.breakfast_enabled || false} onChange={e => handleChange('breakfast_enabled', e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
              <span>Enrolled in breakfast program</span>
            </label>
            {f.breakfast_enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                <Select value={f.breakfast_billing_type || 'daily'} onChange={e => handleChange('breakfast_billing_type', e.target.value)} options={[{value:"daily", label:"Daily Rate"}, {value:"termly", label:"Termly Rate"}]} />
                <Input type="number" value={f.breakfast_daily_rate || ""} onChange={e => handleChange('breakfast_daily_rate', e.target.value ? parseFloat(e.target.value) || 0 : 0)} placeholder={f.breakfast_billing_type === 'termly' ? "Termly rate (KES)" : "Daily rate (KES)"} />
                {f.breakfast_billing_type !== 'termly' && (
                  <Input type="number" value={f.breakfast_days || ""} onChange={e => handleChange('breakfast_days', e.target.value)} placeholder="School days (optional)" />
                )}
              </div>
            )}
          </div>

          {/* Fee Discount */}
          <div style={{ gridColumn: "1 / -1", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Fee Discount</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)", alignItems: "start" }}>
              <Select value={f.discount_type || ""} onChange={e => setF({ ...f, discount_type: e.target.value })} options={[
                { value: "", label: "No Discount" },
                { value: "sibling_2nd", label: "2nd Sibling" },
                { value: "sibling_3rd", label: "3rd Sibling" },
                { value: "sibling_4th_plus", label: "4th+ Sibling" },
                { value: "staff_child", label: "Staff Child" },
                { value: "scholarship", label: "Scholarship" },
                { value: "bursary", label: "Bursary" },
                { value: "other", label: "Other" }
              ]} />
              <Input type="number" value={f.discount_value || ""} onChange={e => setF({ ...f, discount_value: e.target.value ? parseFloat(e.target.value) || 0 : 0 })} placeholder={f.discount_is_percentage ? "Discount %" : "Amount (KES)"} disabled={!f.discount_type} />
              <Select value={f.discount_is_percentage ? "percentage" : "amount"} onChange={e => setF({ ...f, discount_is_percentage: e.target.value === "percentage" })} disabled={!f.discount_type} options={[
                { value: "percentage", label: "Percentage (%)" },
                { value: "amount", label: "Fixed Amount (KES)" }
              ]} />
            </div>
            {f.discount_type && (
              <small style={{ color: "var(--color-warning)", fontSize: "11px", display: "block", marginTop: "var(--space-2)" }}>
                Discount applies to base tuition fee only. Transport, lunch, and breakfast are not discounted.
              </small>
            )}
          </div>

          {/* Opening Balance */}
          <div style={{ gridColumn: "1 / -1", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Opening Balance (KES)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-3)" }}>
              <Input type="number" value={f.opening_balance || ""} onChange={e => setF({ ...f, opening_balance: e.target.value ? parseFloat(e.target.value) || 0 : 0 })} placeholder="Amount carried forward" />
              <Select style={{ width: "160px" }} value={f.opening_balance_type || "owing"} onChange={e => setF({ ...f, opening_balance_type: e.target.value })} options={[
                { value: "owing", label: "Student Owes" },
                { value: "credit", label: "Credit (Prepaid)" }
              ]} />
            </div>
            <small style={{ color: "var(--color-text-muted)", fontSize: "11px", display: "block", marginTop: "var(--space-2)" }}>
              Opening balance is added to the student's total expected fees
            </small>
          </div>

          {/* Photo */}
          <div style={{ gridColumn: "1 / -1", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>Student Photo</div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <input type="file" accept="image/*" onChange={handleFileSelect} style={{ flex: 1, color: "var(--color-text-primary)" }} />
              {f.photoUrl && (
                <img src={f.photoUrl} alt="Student photo" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-card)" }} />
              )}
              {selectedFile && editId && (
                <Button onClick={() => uploadPhoto(editId)} loading={uploadingPhoto}>
                  Upload
                </Button>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
              Upload a photo for the student ID card (max 2MB, JPG/PNG only)
            </div>
          </div>
        </div>
        {err && <div style={{ color: "var(--color-danger)", background: "var(--color-danger-muted)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", marginTop: "var(--space-4)", fontSize: "14px", borderLeft: "4px solid var(--color-danger)" }}>{err}</div>}
      </Modal>

      {/* Profile Modal */}
      <Modal isOpen={!!profile} title="Student Profile" onClose={() => setProfile(null)} footer={
        <>
          <Button variant="ghost" onClick={() => { setProfile(null); setIdCardStudent(profile); }}>🪪 View ID Card</Button>
          <Button variant="primary" onClick={() => { 
            const rowsHtml = results.filter(r => (r.studentId ?? r.student_id) === (profile.student_id ?? profile.id)).map(r => `<li>${r.subject}: ${r.marks}/${r.total || r.total_marks} (${r.grade})</li>`).join(""); 
            const html = `<h2>${profile.firstName} ${profile.lastName}</h2><p>${profile.admission}</p><ul>${rowsHtml||"<li>No results</li>"}</ul>`;
            printHTML(html, { title: `Report - ${profile.firstName} ${profile.lastName}` });
          }}>Export Report (Print/PDF)</Button>
        </>
      }>
        {profile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-2)" }}>
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt="" style={{ width: 80, height: 80, borderRadius: "var(--radius-md)", objectFit: "cover", boxShadow: "var(--shadow-card)" }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: "var(--radius-md)", background: "var(--color-primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary)", fontSize: "24px", fontWeight: "bold" }}>
                  {profile.firstName[0]}{profile.lastName[0]}
                </div>
              )}
              <div>
                <div style={{ color: "var(--color-text-primary)", fontWeight: 800, fontSize: "24px", fontFamily: "var(--font-heading)" }}>{profile.firstName} {profile.lastName}</div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginTop: "4px" }}>{profile.admission} • {profile.className}</div>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <div style={{ background: "var(--color-bg-base)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Personal Info</div>
                <div style={{ color: "var(--color-text-primary)", fontSize: "13px", lineHeight: "1.6" }}>
                  {profile.dob && <div><strong>DOB:</strong> {new Date(profile.dob).toLocaleDateString()}</div>}
                  {profile.nemisNumber && <div><strong>NEMIS:</strong> {profile.nemisNumber}</div>}
                  {profile.bloodGroup && <div><strong>Blood Group:</strong> {profile.bloodGroup}</div>}
                  {profile.allergies && <div style={{ color: "var(--color-warning)" }}>⚠️ <strong>Allergies:</strong> {profile.allergies}</div>}
                  {profile.medicalConditions && <div><strong>Medical:</strong> {profile.medicalConditions}</div>}
                </div>
              </div>

              <div style={{ background: "var(--color-bg-base)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Contact Info</div>
                <div style={{ color: "var(--color-text-primary)", fontSize: "13px", lineHeight: "1.6" }}>
                  <div><strong>Parent:</strong> {profile.parentName}</div>
                  <div><strong>Phone:</strong> {profile.parentPhone || "-"}</div>
                  {profile.emergencyContactName && (
                    <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
                      <strong style={{ color: "var(--color-danger)" }}>Emergency:</strong><br/>
                      {profile.emergencyContactName} ({profile.emergencyContactRelationship})<br/>
                      {profile.emergencyContactPhone || "-"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: "var(--color-bg-base)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Financial Status</div>
                <div style={{ color: "var(--color-text-primary)", fontSize: "14px", marginTop: "4px" }}>
                  Expected: {money(expected(profile.className))}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Paid Amount</div>
                <div style={{ color: "var(--color-success)", fontWeight: 700, fontSize: "18px", marginTop: "4px" }}>
                  {money(payments.filter(p => (p.studentId ?? p.student_id) === (profile.student_id ?? profile.id) && p.status === "paid").reduce((s, p) => s + Number(p.amount), 0))}
                </div>
              </div>
            </div>
            
            <div style={{ background: "var(--color-bg-base)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", color: "var(--color-text-primary)", fontWeight: 600 }}>Results Recorded</div>
              <Badge text={results.filter(r => (r.studentId ?? r.student_id) === (profile.student_id ?? profile.id)).length.toString()} variant="primary" />
            </div>
          </div>
        )}
      </Modal>

      {/* ID Card / Scanner */}
      {idCardStudent && (
        <StudentIDCard 
          student={idCardStudent} 
          school={feeStructures[0]?.school || { name: "School", year: new Date().getFullYear() }} 
          onClose={() => setIdCardStudent(null)} 
        />
      )}
      {showQRScanner && (
        <QRScanner
          title="Scan Student QR Code"
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
}

StudentsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  setStudents: PropTypes.func.isRequired,
  canEdit: PropTypes.bool.isRequired,
  results: PropTypes.array.isRequired,
  payments: PropTypes.array.isRequired,
  feeStructures: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};
