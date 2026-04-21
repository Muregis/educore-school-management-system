import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import StudentIDCard from "../components/StudentIDCard";
import QRScanner from "../components/QRScanner";
import { ALL_CLASSES } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { money } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";
import { parseStudentQrContent } from "../lib/qr";
import { Pager, Msg } from "../components/Helpers";
import { csv, pager } from "../lib/utils";

// Normalise a student row coming from the backend into the shape the UI expects
function normalise(s) {
  return {
    id:          s.student_id  ?? s.id,
    admission:   s.admission_number ?? s.admission,
    firstName:   s.first_name  ?? s.firstName,
    lastName:    s.last_name   ?? s.lastName,
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
  const [f, setF] = useState({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", nemisNumber: "", bloodGroup: "", allergies: "", medicalConditions: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "", photoUrl: "", status: "active", admission: "" });

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/students", { token: auth.token, signal: ac.signal })
      .then(data => setStudents(data.map(normalise)))
      .catch(e => { if (e?.code !== "EABORT") toast("Failed to fetch students", "error"); });
    return () => ac.abort();
  }, [auth, setStudents]);

  const expected = c => {
    const x = feeStructures.find(s => s.className === c || s.class_name === c);
    return x ? Number(x.tuition) + Number(x.activity) + Number(x.misc) : 0;
  };

  const normalised = useMemo(() => students.map(s => s.first_name ? normalise(s) : s), [students]);

  const filtered = normalised.filter(s =>
    `${s.firstName} ${s.lastName} ${s.className} ${s.admission} ${s.parentPhone || ""} ${s.nemisNumber || ""}`
      .toLowerCase().includes(q.toLowerCase()) &&
    (cls === "all" || s.className === cls) &&
    (status === "all" || s.status === status)
  );

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const openAdd = () => {
    setEditId(null); setErr("");
    setF({ firstName: "", lastName: "", className: "Grade 7", gender: "female", parentName: "", parentPhone: "", dob: "", nemisNumber: "", bloodGroup: "", allergies: "", medicalConditions: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "", photoUrl: "", status: "active", admission: "" });
    setShow(true);
  };

  const save = async () => {
    setErr("");
    if (!f.firstName.trim() || !f.lastName.trim()) return setErr("First and last name are required.");
    
    // Validate WhatsApp number format (Kenyan) - supports 07, 01, 254, +254 prefixes
    if (f.parentPhone) {
      const cleanPhone = f.parentPhone.replace(/[^\d+]/g, '');
      // Accept: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, +2541xxxxxxxx
      const phoneRegex = /^(\+?254|0)[17][0-9]{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return setErr("Invalid Kenyan phone format. Use: 07xxxxxxxx, 01xxxxxxxx, 2547xxxxxxxx, 2541xxxxxxxx, +2547xxxxxxxx, or +2541xxxxxxxx");
      }
    }
    
    try {
      if (editId) {
        await apiFetch(`/students/${editId}`, {
          method: "PUT",
          body: { admissionNumber: f.admission || null, firstName: f.firstName, lastName: f.lastName, gender: f.gender, className: f.className || null, classId: null, dateOfBirth: f.dob || null, nemisNumber: f.nemisNumber || null, bloodGroup: f.bloodGroup || null, allergies: f.allergies || null, medicalConditions: f.medicalConditions || null, emergencyContactName: f.emergencyContactName || null, emergencyContactPhone: f.emergencyContactPhone || null, emergencyContactRelationship: f.emergencyContactRelationship || null, phone: f.parentPhone || null, email: null, address: null, photoUrl: f.photoUrl || null, status: f.status, parentName: f.parentName || null, parentPhone: f.parentPhone || null },
          token: auth?.token,
        });
        setStudents(prev => prev.map(s => (s.id === editId || s.student_id === editId) ? { ...normalise(s), ...f, id: editId } : s));
      } else {
        const res = await apiFetch(`/students`, {
          method: "POST",
          body: { admissionNumber: f.admission || `ADM-${Date.now()}`, firstName: f.firstName, lastName: f.lastName, gender: f.gender, className: f.className || null, classId: null, dateOfBirth: f.dob || null, nemisNumber: f.nemisNumber || null, bloodGroup: f.bloodGroup || null, allergies: f.allergies || null, medicalConditions: f.medicalConditions || null, emergencyContactName: f.emergencyContactName || null, emergencyContactPhone: f.emergencyContactPhone || null, emergencyContactRelationship: f.emergencyContactRelationship || null, phone: f.parentPhone || null, email: null, address: null, photoUrl: f.photoUrl || null, status: f.status, parentName: f.parentName || null, parentPhone: f.parentPhone || null },
          token: auth?.token,
        });
        setStudents(prev => [...prev, normalise(res)]);
      }
      setShow(false);
      toast("Student saved", "success");
    } catch (err) {
      setErr(err.message || "Save failed");
    }
  };

  const del = async id => {
    if (!window.confirm("Delete this student?")) return;
    try {
      await apiFetch(`/students/${id}`, { method: "DELETE", token: auth?.token });
      setStudents(prev => prev.filter(s => (s.id ?? s.student_id) !== id));
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
        headers: {
          'Authorization': `Bearer ${auth?.token}`,
        },
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
      console.error('Upload error:', error);
      toast("Failed to upload photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast("Please select an image file", "error");
        return;
      }
      // Validate file size (2MB limit)
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
        String(s.id ?? s.student_id ?? "") === scannedId ||
        String(s.admission ?? s.admission_number ?? "") === scannedId
      );

      if (student) {
        setProfile(student);
        toast("Student found and profile opened", "success");
      } else {
        toast("Student not found", "error");
      }
    } catch (err) {
      console.error("QR scan error:", err);
      toast("Invalid QR code", "error");
    }
    setShowQRScanner(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Badge text={`Total: ${filtered.length}`} tone="success" />
        <Badge text={`Boys: ${filtered.filter(s => s.gender === "male").length}`} tone="info" />
        <Badge text={`Girls: ${filtered.filter(s => s.gender === "female").length}`} tone="warning" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8, marginBottom: 10 }}>
        <input style={inputStyle} value={q} onChange={e => setQ(e.target.value)} placeholder="Search students" />
        <select style={inputStyle} value={cls} onChange={e => setCls(e.target.value)}>
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
        <Btn variant="ghost" onClick={() => { csv("students.csv", ["Admission","First","Last","Class","Gender","Parent","Phone","Status"], filtered.map(s => [s.admission,s.firstName,s.lastName,s.className,s.gender,s.parentName||"",s.parentPhone||"",s.status])); toast("Students CSV exported","success"); }}>Export CSV</Btn>
        <Btn variant="secondary" onClick={() => setShowQRScanner(true)}>📱 Scan QR</Btn>
        {canEdit && auth.role !== "finance" && <Btn onClick={openAdd}>Add Student</Btn>}
      </div>
      {filtered.length === 0 ? <Msg text="No students found." /> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Student","Admission","Class","Parent","Status","Actions"]}
              rows={rows.map(s => [
                <div key={s.id}><div style={{ color: C.text, fontWeight: 600 }}>{s.firstName} {s.lastName}</div><div style={{ fontSize: 11, color: C.textMuted }}>{s.dob || "-"}</div></div>,
                s.admission, s.className,
                `${s.parentName || "-"} ${s.parentPhone ? `(${s.parentPhone})` : ""}`,
                <Badge key="b" text={s.status} tone={s.status === "active" ? "success" : "danger"} />,
                <div key="a" style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" onClick={() => setProfile(s)}>Profile</Btn>
                  <Btn variant="ghost" onClick={() => setIdCardStudent(s)}>🪪 ID Card</Btn>
                  {canEdit && auth.role !== "finance" && <Btn variant="ghost" onClick={() => { setEditId(s.id); setF(s); setShow(true); }}>Edit</Btn>}
                  {canEdit && auth.role !== "finance" && <Btn variant="danger" onClick={() => del(s.id)}>Delete</Btn>}
                </div>
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}
      {show && (
        <Modal title={editId ? "Edit Student" : "Add Student"} onClose={() => setShow(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="First Name"><input style={inputStyle} value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></Field>
            <Field label="Last Name"><input style={inputStyle} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></Field>
            <Field label="Admission"><input style={inputStyle} value={f.admission || ""} onChange={e => setF({ ...f, admission: e.target.value })} /></Field>
            <Field label="Class"><select style={inputStyle} value={f.className} onChange={e => setF({ ...f, className: e.target.value })}>{ALL_CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Gender"><select style={inputStyle} value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}><option value="female">female</option><option value="male">male</option></select></Field>
            <Field label="Status"><select style={inputStyle} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option></select></Field>
            <Field label="Parent"><input style={inputStyle} value={f.parentName || ""} onChange={e => setF({ ...f, parentName: e.target.value })} /></Field>
            <Field label="Parent WhatsApp"><input style={inputStyle} value={f.parentPhone || ""} onChange={e => setF({ ...f, parentPhone: e.target.value })} placeholder="07xxxxxxxx, 01xxxxxxxx, 2547..." /></Field>
            <Field label="Date of Birth"><input type="date" style={inputStyle} value={f.dob || ""} onChange={e => setF({ ...f, dob: e.target.value })} /></Field>
            <Field label="NEMIS Number"><input style={inputStyle} value={f.nemisNumber || ""} onChange={e => setF({ ...f, nemisNumber: e.target.value.toUpperCase() })} placeholder="e.g. NEM12345678" /></Field>
            <Field label="Blood Group">
              <select style={inputStyle} value={f.bloodGroup || ""} onChange={e => setF({ ...f, bloodGroup: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </Field>
            <Field label="Allergies"><input style={inputStyle} value={f.allergies || ""} onChange={e => setF({ ...f, allergies: e.target.value })} placeholder="e.g. Peanuts, Penicillin" /></Field>
            <Field label="Medical Conditions" style={{ gridColumn: "1 / -1" }}>
              <textarea style={{ ...inputStyle, height: 60, resize: "vertical" }} value={f.medicalConditions || ""} onChange={e => setF({ ...f, medicalConditions: e.target.value })} placeholder="Any medical conditions or special needs" />
            </Field>
            <Field label="Emergency Contact"><input style={inputStyle} value={f.emergencyContactName || ""} onChange={e => setF({ ...f, emergencyContactName: e.target.value })} placeholder="Name" /></Field>
            <Field label="Emergency Phone"><input style={inputStyle} value={f.emergencyContactPhone || ""} onChange={e => setF({ ...f, emergencyContactPhone: e.target.value })} placeholder="07xxxxxxxx" /></Field>
            <Field label="Relationship"><input style={inputStyle} value={f.emergencyContactRelationship || ""} onChange={e => setF({ ...f, emergencyContactRelationship: e.target.value })} placeholder="e.g. Parent, Guardian" /></Field>
            <Field label="Photo" style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ flex: 1 }}
                />
                {f.photoUrl && (
                  <img
                    src={f.photoUrl}
                    alt="Student photo"
                    style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 4 }}
                  />
                )}
                {selectedFile && editId && (
                  <Btn
                    onClick={() => uploadPhoto(editId)}
                    disabled={uploadingPhoto}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {uploadingPhoto ? "Uploading..." : "Upload"}
                  </Btn>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                Upload a photo for the student ID card (max 2MB, JPG/PNG only)
              </div>
            </Field>
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShow(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
      {profile && (
        <Modal title="Student Profile" onClose={() => setProfile(null)}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 17 }}>{profile.firstName} {profile.lastName}</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>{profile.admission} | {profile.className}</div>
          {profile.dob && <div style={{ color: C.textSub, marginBottom: 8 }}>Date of Birth: {new Date(profile.dob).toLocaleDateString()}</div>}
          {profile.nemisNumber && <div style={{ color: C.textSub, marginBottom: 8 }}>NEMIS: {profile.nemisNumber}</div>}
          {profile.bloodGroup && <div style={{ color: C.textSub, marginBottom: 8 }}>Blood Group: {profile.bloodGroup}</div>}
          {profile.allergies && <div style={{ color: C.textSub, marginBottom: 8 }}>⚠️ Allergies: {profile.allergies}</div>}
          {profile.medicalConditions && <div style={{ color: C.textSub, marginBottom: 8 }}>Medical: {profile.medicalConditions}</div>}
          {profile.emergencyContactName && <div style={{ color: C.textSub, marginBottom: 8 }}>Emergency: {profile.emergencyContactName} ({profile.emergencyContactPhone || "-"}) - {profile.emergencyContactRelationship}</div>}
          <div style={{ color: C.textSub, marginBottom: 8 }}>Parent: {profile.parentName} ({profile.parentPhone || "-"})</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>Expected Fees: {money(expected(profile.className))}</div>
          <div style={{ color: C.textSub, marginBottom: 8 }}>Paid: {money(payments.filter(p => (p.studentId ?? p.student_id) === profile.id && p.status === "paid").reduce((s, p) => s + Number(p.amount), 0))}</div>
          <div style={{ color: C.textSub, marginBottom: 14 }}>Results: {results.filter(r => (r.studentId ?? r.student_id) === profile.id).length}</div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Btn onClick={() => { setProfile(null); setIdCardStudent(profile); }}>🪪 View ID Card</Btn>
            <Btn onClick={() => { const rowsHtml = results.filter(r => (r.studentId ?? r.student_id) === profile.id).map(r => `<li>${r.subject}: ${r.marks}/${r.total || r.total_marks} (${r.grade})</li>`).join(""); const w = window.open("","_blank"); if (!w) return; w.document.write(`<h2>${profile.firstName} ${profile.lastName}</h2><p>${profile.admission}</p><ul>${rowsHtml||"<li>No results</li>"}</ul>`); w.document.close(); w.print(); }}>Export Report (Print/PDF)</Btn>
          </div>
        </Modal>
      )}
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
