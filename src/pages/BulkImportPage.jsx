import React, { useState, useRef } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Msg } from "../components/Helpers";

export default function BulkImportPage({ auth, students, setStudents, toast, payments, feeStructures }) {
  const [activeTab, setActiveTab] = useState("import");
  const [csvContent, setCsvContent] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // Export filter state
  const [exportFilter, setExportFilter] = useState("all"); // all, class, defaulter, individual
  const [exportClass, setExportClass] = useState("all");
  const [exportDefaulterAmount, setExportDefaulterAmount] = useState(0);
  const [selectedStudents, setSelectedStudents] = useState([]);

  // CSV Template
  const csvTemplate = `first_name,last_name,gender,class_name,admission_number,parent_name,parent_phone,date_of_birth,nemis_number,status
John,Doe,male,Grade 1,ADM001,Jane Doe,0712345678,2015-03-15,NEM123456,active
Jane,Smith,female,Grade 2,ADM002,John Smith,0723456789,2014-07-22,NEM789012,active`;

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result);
      parseCSV(event.target.result);
    };
    reader.readAsText(file);
  };

  // Parse CSV
  const parseCSV = (content) => {
    setParsing(true);
    try {
      const lines = content.trim().split("\n");
      if (lines.length < 2) {
        toast("CSV must have a header row and at least one data row", "error");
        setParsing(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const required = ["first_name", "last_name", "admission_number"];
      const missing = required.filter(r => !headers.includes(r));
      
      if (missing.length > 0) {
        toast(`Missing required columns: ${missing.join(", ")}`, "error");
        setParsing(false);
        return;
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((h, idx) => row[h] = values[idx]);
          
          // Validate required fields
          row._valid = row.first_name && row.last_name && row.admission_number;
          row._existing = students.find(s => 
            (s.admission || s.admission_number) === row.admission_number
          );
          
          rows.push(row);
        }
      }

      setPreview(rows);
      toast(`Parsed ${rows.length} students`, "success");
    } catch (err) {
      toast("Failed to parse CSV", "error");
    }
    setParsing(false);
  };

  // Import students
  const handleImport = async () => {
    const validRows = preview.filter(r => r._valid && !r._existing);
    if (validRows.length === 0) {
      toast("No valid new students to import", "error");
      return;
    }

    setImporting(true);
    const results = { success: 0, failed: 0, errors: [] };

    for (const row of validRows) {
      try {
        await apiFetch("/students", {
          method: "POST",
          body: {
            admissionNumber: row.admission_number,
            firstName: row.first_name,
            lastName: row.last_name,
            gender: row.gender || "male",
            className: row.class_name || "Grade 1",
            parentName: row.parent_name || null,
            parentPhone: row.parent_phone || null,
            dateOfBirth: row.date_of_birth || null,
            nemisNumber: row.nemis_number || null,
            status: row.status || "active",
          },
          token: auth?.token,
        });
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${row.admission_number}: ${err.message}`);
      }
    }

    setImportResults(results);
    toast(`Imported ${results.success} students, ${results.failed} failed`, results.failed > 0 ? "warning" : "success");
    
    // Refresh students list
    if (results.success > 0) {
      const data = await apiFetch("/students", { token: auth.token });
      setStudents(data.map(s => ({
        id: s.student_id,
        firstName: s.first_name,
        lastName: s.last_name,
        gender: s.gender,
        className: s.class_name,
        admission: s.admission_number,
        parentName: s.parent_name,
        parentPhone: s.parent_phone,
        status: s.status,
      })));
    }
    
    setImporting(false);
  };

  // Export students to CSV with filters
  const handleExport = () => {
    let filteredStudents = students;

    // Apply filters
    if (exportFilter === "class" && exportClass !== "all") {
      filteredStudents = students.filter(s => (s.className || s.class_name) === exportClass);
    } else if (exportFilter === "defaulter") {
      filteredStudents = students.filter(s => {
        const studentId = s.id ?? s.student_id;
        const expected = feeStructures.find(f => (f.className || f.class_name) === (s.className || s.class_name));
        const expectedAmount = expected ? Number(expected.tuition || 0) + Number(expected.activity || 0) + Number(expected.misc || 0) : 0;
        const paidAmount = payments.filter(p => (p.studentId ?? p.student_id) === studentId && p.status === "paid").reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const balance = expectedAmount - paidAmount;
        return balance > exportDefaulterAmount;
      });
    } else if (exportFilter === "individual") {
      filteredStudents = students.filter(s => selectedStudents.includes(s.id ?? s.student_id));
    }

    const headers = ["first_name", "last_name", "gender", "class_name", "admission_number", "parent_name", "parent_phone", "date_of_birth", "nemis_number", "blood_group", "allergies", "medical_conditions", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship", "status"];
    
    const rows = filteredStudents.map(s => {
      const studentId = s.id ?? s.student_id;
      const expected = feeStructures.find(f => (f.className || f.class_name) === (s.className || s.class_name));
      const expectedAmount = expected ? Number(expected.tuition || 0) + Number(expected.activity || 0) + Number(expected.misc || 0) : 0;
      const paidAmount = payments.filter(p => (p.studentId ?? p.student_id) === studentId && p.status === "paid").reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const balance = expectedAmount - paidAmount;
      
      return [
        s.firstName || s.first_name || "",
        s.lastName || s.last_name || "",
        s.gender || "",
        s.className || s.class_name || "",
        s.admission || s.admission_number || "",
        s.parentName || s.parent_name || "",
        s.parentPhone || s.parent_phone || "",
        s.dob || s.date_of_birth || "",
        s.nemisNumber || s.nemis_number || "",
        s.bloodGroup || s.blood_group || "",
        s.allergies || "",
        s.medicalConditions || s.medical_conditions || "",
        s.emergencyContactName || s.emergency_contact_name || "",
        s.emergencyContactPhone || s.emergency_contact_phone || "",
        s.emergencyContactRelationship || s.emergency_contact_relationship || "",
        s.status || "active",
        balance > 0 ? balance.toString() : "0", // balance column
      ];
    });

    const csvHeaders = [...headers, "balance"];
    const csv = [csvHeaders.join(","), ...rows.map(r => r.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const suffix = exportFilter === "defaulter" ? "defaulters" : exportFilter === "class" ? exportClass.replace(" ", "_") : "all";
    link.download = `students_export_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    
    toast(`Exported ${filteredStudents.length} students`, "success");
  };

  // Toggle student selection for individual export
  const toggleStudent = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Download template
  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "students_import_template.csv";
    link.click();
  };

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("import")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "import" ? C.accent : C.surface,
            color: activeTab === "import" ? "#fff" : C.text,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          📥 Import CSV
        </button>
        <button
          onClick={() => setActiveTab("export")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "export" ? C.accent : C.surface,
            color: activeTab === "export" ? "#fff" : C.text,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          📤 Export CSV ({students.length})
        </button>
      </div>

      {activeTab === "import" ? (
        <div>
          {/* Instructions */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 12px", color: C.text }}>How to Import Students</h4>
            <ol style={{ color: C.textSub, fontSize: 14, margin: 0, paddingLeft: 20 }}>
              <li>Download the CSV template below</li>
              <li>Fill in student data (required: first_name, last_name, admission_number)</li>
              <li>Upload your CSV file</li>
              <li>Review the preview before importing</li>
              <li>Click "Import Students" to add them to the system</li>
            </ol>
            <Btn variant="ghost" onClick={downloadTemplate} style={{ marginTop: 12 }}>
              ⬇ Download Template CSV
            </Btn>
          </div>

          {/* File Upload */}
          <div style={{ marginBottom: 20 }}>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${C.border}`,
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                cursor: "pointer",
                background: C.bg,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ color: C.text, fontWeight: 600 }}>Click to upload CSV file</div>
              <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>or drag and drop here</div>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 12px", color: C.text }}>
                Preview ({preview.length} students)
                <Badge 
                  text={`${preview.filter(r => r._valid && !r._existing).length} ready to import`} 
                  tone="success" 
                  style={{ marginLeft: 8 }}
                />
                {preview.some(r => r._existing) && (
                  <Badge 
                    text={`${preview.filter(r => r._existing).length} already exist`} 
                    tone="warning" 
                    style={{ marginLeft: 8 }}
                  />
                )}
              </h4>
              
              <div style={{ overflowX: "auto", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      <th style={{ padding: 10, textAlign: "left" }}>Status</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Name</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Admission #</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Class</th>
                      <th style={{ padding: 10, textAlign: "left" }}>Parent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, idx) => (
                      <tr key={idx} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: 8 }}>
                          {!row._valid ? (
                            <Badge text="Invalid" tone="danger" />
                          ) : row._existing ? (
                            <Badge text="Exists" tone="warning" />
                          ) : (
                            <Badge text="New" tone="success" />
                          )}
                        </td>
                        <td style={{ padding: 8 }}>{row.first_name} {row.last_name}</td>
                        <td style={{ padding: 8 }}><code>{row.admission_number}</code></td>
                        <td style={{ padding: 8 }}>{row.class_name || "-"}</td>
                        <td style={{ padding: 8 }}>{row.parent_name || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <div style={{ padding: 10, textAlign: "center", color: C.textSub, fontSize: 12 }}>
                    ... and {preview.length - 10} more
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <Btn variant="ghost" onClick={() => { setPreview([]); setCsvContent(""); }}>
                  Clear
                </Btn>
                <Btn 
                  onClick={handleImport} 
                  loading={importing}
                  disabled={preview.filter(r => r._valid && !r._existing).length === 0}
                >
                  Import {preview.filter(r => r._valid && !r._existing).length} Students
                </Btn>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <Modal title="Import Results" onClose={() => setImportResults(null)}>
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>
                  {importResults.failed === 0 ? "✅" : "⚠️"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  Import Complete
                </div>
                <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#22C55E" }}>{importResults.success}</div>
                    <div style={{ color: C.textSub, fontSize: 12 }}>Imported</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: importResults.failed > 0 ? "#EF4444" : "#22C55E" }}>{importResults.failed}</div>
                    <div style={{ color: C.textSub, fontSize: 12 }}>Failed</div>
                  </div>
                </div>
                {importResults.errors.length > 0 && (
                  <div style={{ textAlign: "left", background: C.bg, padding: 12, borderRadius: 8, maxHeight: 200, overflow: "auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: C.text }}>Errors:</div>
                    {importResults.errors.map((err, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: "#EF4444", marginBottom: 4 }}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            </Modal>
          )}
        </div>
      ) : (
        <div>
          {/* Export Filter Options */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 16px", color: C.text }}>Export Options</h4>
            
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => setExportFilter("all")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: exportFilter === "all" ? C.accent : C.bg,
                  color: exportFilter === "all" ? "#fff" : C.text,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                All Students
              </button>
              <button
                onClick={() => setExportFilter("class")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: exportFilter === "class" ? C.accent : C.bg,
                  color: exportFilter === "class" ? "#fff" : C.text,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                By Class
              </button>
              <button
                onClick={() => setExportFilter("defaulter")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: exportFilter === "defaulter" ? C.accent : C.bg,
                  color: exportFilter === "defaulter" ? "#fff" : C.text,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Fee Defaulters
              </button>
              <button
                onClick={() => setExportFilter("individual")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: exportFilter === "individual" ? C.accent : C.bg,
                  color: exportFilter === "individual" ? "#fff" : C.text,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Individual Select
              </button>
            </div>

            {/* Class filter */}
            {exportFilter === "class" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: C.textSub, marginRight: 12 }}>Select Class:</label>
                <select 
                  style={{ ...inputStyle, width: "auto" }} 
                  value={exportClass} 
                  onChange={e => setExportClass(e.target.value)}
                >
                  <option value="all">All Classes</option>
                  {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Defaulter filter */}
            {exportFilter === "defaulter" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ color: C.textSub, marginRight: 12 }}>Balance above (KES):</label>
                <input 
                  type="number" 
                  style={{ ...inputStyle, width: 120 }} 
                  value={exportDefaulterAmount} 
                  onChange={e => setExportDefaulterAmount(Number(e.target.value))}
                  placeholder="0"
                />
                <span style={{ color: C.textSub, marginLeft: 8, fontSize: 13 }}>Students with balance greater than this amount</span>
              </div>
            )}

            {/* Individual select */}
            {exportFilter === "individual" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: C.textSub, marginBottom: 8 }}>Select students ({selectedStudents.length} selected):</div>
                <div style={{ maxHeight: 200, overflow: "auto", background: C.bg, padding: 10, borderRadius: 8 }}>
                  {students.map(s => {
                    const sid = s.id ?? s.student_id;
                    return (
                      <label key={sid} style={{ display: "flex", alignItems: "center", gap: 8, padding: 4, cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={selectedStudents.includes(sid)}
                          onChange={() => toggleStudent(sid)}
                        />
                        <span style={{ color: C.text }}>{s.firstName || s.first_name} {s.lastName || s.last_name} ({s.admission || s.admission_number})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export Button */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h4 style={{ margin: "0 0 8px", color: C.text }}>
              {exportFilter === "all" && "Export All Students"}
              {exportFilter === "class" && `Export ${exportClass === "all" ? "All Classes" : exportClass}`}
              {exportFilter === "defaulter" && "Export Fee Defaulters"}
              {exportFilter === "individual" && `Export ${selectedStudents.length} Selected Students`}
            </h4>
            <p style={{ color: C.textSub, fontSize: 14, margin: "0 0 20px" }}>
              Download a CSV file with complete student information including medical data and fee balance.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Btn variant="ghost" onClick={() => setActiveTab("import")}>Cancel</Btn>
              <Btn 
                onClick={handleExport}
                disabled={exportFilter === "individual" && selectedStudents.length === 0}
              >
                📤 Export to CSV
              </Btn>
            </div>
          </div>

          {/* Export Fields Info */}
          <div style={{ marginTop: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <h4 style={{ margin: "0 0 12px", color: C.text }}>Exported Fields</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, fontSize: 13, color: C.textSub }}>
              <div>• first_name</div>
              <div>• last_name</div>
              <div>• gender</div>
              <div>• class_name</div>
              <div>• admission_number</div>
              <div>• parent_name</div>
              <div>• parent_phone</div>
              <div>• date_of_birth</div>
              <div>• nemis_number</div>
              <div>• blood_group</div>
              <div>• allergies</div>
              <div>• medical_conditions</div>
              <div>• emergency_contact_name</div>
              <div>• emergency_contact_phone</div>
              <div>• emergency_contact_relationship</div>
              <div>• status</div>
              <div>• balance (KES)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

BulkImportPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  setStudents: PropTypes.func.isRequired,
  toast: PropTypes.func.isRequired,
};
