import { useState, useEffect, useMemo, useCallback } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { apiFetch, API_BASE } from "../lib/api";
import { getAuthHeaders } from "../lib/auth";
import { Pager, Msg, csv, pager } from "../components/Helpers";
import { useCurrentTerm } from "../hooks/useCurrentTerm";
import { getGradeColor as getGradeHexColor, parseMark } from "../lib/grading";
import { rankingService } from "../services/rankingService";

// Use shared grading utilities instead of local definitions
const SPECIAL_MARKS = {
  "N/A": "na",      // Did not sit this subject
  "X":   "absent",  // Missed exam / absent
  "Y":   "cheat",   // Caught cheating
};

function displayMark(marks, total) {
  const parsed = parseMark(marks);
  if (parsed.isSpecial) {
    if (parsed.specialType === 'ABSENT') return <Badge tone="warning">X – Absent</Badge>;
    if (parsed.specialType === 'CHEATING') return <Badge tone="danger">Y – Cheating</Badge>;
    if (parsed.specialType === 'NOT_ASSESSED') return <span style={{ color:C.textMuted, fontStyle:"italic" }}>N/A</span>;
  }
  return `${marks}/${total}`;
}
function gradeColor(grade) {
  // Map grades to Badge tones - uses shared utility logic
  if (!grade) return "info";
  if (grade === "EE") return "success";
  if (grade === "ME") return "info";
  if (grade === "AE") return "warning";
  return "danger";
}

function parseSubjectRows(data) {
  return (data || [])
    .map(s => ({
      name: (s.name ?? s.subject_name ?? "").trim(),
      classLevels: (s.class_levels ?? s.classLevels ?? "").toString(),
    }))
    .filter(s => s.name);
}

function defaultSubjectCatalog() {
  return SUBJECTS.map(name => ({ name, classLevels: "" }));
}

function markToCsv(val) {
  if (val === "na" || val === "N/A") return "N/A";
  if (val === "absent" || val === "X") return "X";
  if (val === "cheat" || val === "Y") return "Y";
  return val != null && val !== "" ? String(val) : "";
}

function lookupSubjectMark(existing, subject) {
  if (!existing) return "";
  if (existing[subject] != null && existing[subject] !== "") return existing[subject];
  const key = Object.keys(existing).find(k => k.toLowerCase() === subject.toLowerCase());
  return key ? existing[key] : "";
}

export default function GradesPage({ auth, students, results, setResults, canEdit, toast, feeBlocked = false, onGoFees}) {
  // Use current term from API instead of hardcoded "Term 2"
  const { term: currentTerm } = useCurrentTerm(auth);
  const [term, setTerm] = useState(""); // Will be set from currentTerm
  const [examType, setExamType] = useState("Mid-Term");const [filterClass, setFilterClass]     = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [classOptions, setClassOptions] = useState([]);

  // Set term from currentTerm when loaded
  useEffect(() => {
    if (currentTerm && !term) {
      setTerm(currentTerm);
    }
  }, [currentTerm, term]);

  useEffect(() => {
    const token = auth?.token || sessionStorage.getItem("token");
    if (token) {
      apiFetch('/classes', { token })
        .then(res => setClassOptions(res.data || res || []))
        .catch(() => {});
    }
  }, [auth]);
  const [page, setPage]                   = useState(1);
  const [showBulk, setShowBulk]           = useState(false);
  const [bulkClass, setBulkClass]          = useState("");
  const [studentId, setStudentId]         = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [total, setTotal]                 = useState("100");
  const [subjectCatalog, setSubjectCatalog] = useState(defaultSubjectCatalog);
  const [bulkMarks, setBulkMarks]         = useState({});
  const [editing, setEditing] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [showRankings, setShowRankings] = useState(false);

   // Calculate rankings when results change
   const getStudentClass = s => (s.className ?? s.class_name ?? "").toString().trim();
   const getStudentId = s => s.id ?? s.student_id ?? "";
   const getStudentName = s => `${s.firstName ?? s.first_name ?? ""} ${s.lastName ?? s.last_name ?? ""}`.trim();
   const getAdmissionNumber = s =>
     (s.admissionNumber ?? s.admission_number ?? s.admission ?? "").toString().trim();
   const normalizeClassName = value => value?.toString().trim().toLowerCase() ?? "";
   const findStudentById = id => students.find(x => `${x.id ?? x.student_id ?? ""}` === `${id}`);

   const classesForDropdown = useMemo(() => {
     const fromApi = classOptions.map(c => (c.class_name ?? c.className ?? "").toString().trim()).filter(Boolean);
     const fromStudents = students.map(getStudentClass).filter(Boolean);
     const merged = Array.from(new Set([...fromApi, ...fromStudents]));
     return merged.length ? merged.sort() : ALL_CLASSES;
   }, [classOptions, students]);

   const subjects = useMemo(() => {
     const fromCatalog = subjectCatalog.map(s => s.name);
     const fromResults = results.map(r => (r.subject ?? "").trim()).filter(Boolean);
     return [...new Set([...fromCatalog, ...fromResults])].sort();
   }, [subjectCatalog, results]);

   const getExportSubjects = useCallback((className, classTerm) => {
     const cls = normalizeClassName(className);
     const fromCatalog = subjectCatalog
       .filter(s => {
         const levels = s.classLevels.trim();
         if (!levels) return true;
         return levels.split(",").some(l => normalizeClassName(l.trim()) === cls);
       })
       .map(s => s.name);

     const fromResults = results
       .filter(r => {
         if (classTerm && r.term !== classTerm) return false;
         return normalizeClassName(r.className) === cls;
       })
       .map(r => (r.subject ?? "").trim())
       .filter(Boolean);

     const merged = [...new Set([...fromCatalog, ...fromResults])].sort();
     return merged.length ? merged : [...SUBJECTS];
   }, [subjectCatalog, results]);

  useEffect(() => {
    if (results.length > 0 && filterClass !== "all") {
      const classResults = results.filter(
        r => normalizeClassName(r.className) === normalizeClassName(filterClass) &&
          (term === "all" || r.term === term)
      );
      if (classResults.length > 0) {
        const calculatedRankings = rankingService.calculateClassRankings(classResults);
        setRankings(calculatedRankings);
      } else {
        setRankings(null);
      }
    } else {
      setRankings(null);
    }
  }, [results, filterClass, term]);

  // Load subjects from API (fallback to curriculum defaults when none configured)
  useEffect(() => {
    if (!auth?.token) return;
    apiFetch("/subjects", { token: auth.token })
      .then(data => {
        const catalog = parseSubjectRows(data);
        const resolved = catalog.length ? catalog : defaultSubjectCatalog();
        setSubjectCatalog(resolved);
        setBulkMarks(resolved.reduce((a, s) => ({ ...a, [s.name]: "" }), {}));
      })
      .catch(() => {
        const resolved = defaultSubjectCatalog();
        setSubjectCatalog(resolved);
        setBulkMarks(resolved.reduce((a, s) => ({ ...a, [s.name]: "" }), {}));
      });
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/grades", { token: auth.token, signal: ac.signal })
      .then(data => setResults(data))
      .catch(e => { if (e?.code !== "EABORT") toast("Failed to fetch results", "error"); });
    return () => ac.abort();
  }, [auth, setResults, toast]);

  const filtered = results.filter(r =>
    (term === "all" || r.term === term) &&
    (filterClass === "all" || r.className === filterClass) &&
    (filterStudent === "all" || String(r.studentId) === String(filterStudent)) &&
    (filterSubject === "all" || r.subject === filterSubject)
  );

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const saveBulk = async () => {
    const s = findStudentById(studentId);
    if (!s) return toast("Select student", "error");
    const t = Number(total);
    if (!t) return toast("Total marks required", "error");
    const bulkSubjects = selectedSubject ? [selectedSubject] : subjects;
    const entered = bulkSubjects.filter(sub => bulkMarks[sub] !== "");
    if (entered.length === 0) {
      return toast(selectedSubject ? `Enter marks for ${selectedSubject}` : "Enter at least one subject mark", "error");
    }
    try {
      const classId = s.classId ?? s.class_id ?? null;
      await apiFetch("/grades/bulk", {
        method: "POST",
        body: {
          studentId: getStudentId(s), classId, term,
          totalMarks: t,
          subjects: entered.map(sub => ({
          subject: sub,
          examType,
          marks: Object.values(SPECIAL_MARKS).includes(bulkMarks[sub])
              ? bulkMarks[sub]
              : Number(bulkMarks[sub]),
          })),
        },
        token: auth?.token,
      });
      const data = await apiFetch("/grades", { token: auth?.token });
      setResults(data);
      setBulkMarks(subjects.reduce((a, sub) => ({ ...a, [sub]: "" }), {}));
      setShowBulk(false);
      toast("Bulk results saved", "success");
    } catch (err) { toast(err.message || "Save failed", "error"); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    // Allow special marks
    const isSpecial = Object.values(SPECIAL_MARKS).includes(editing.marks);
    if (!isSpecial) {
      const m = Number(editing.marks);
      const t = Number(editing.total);
      if (Number.isNaN(m) || Number.isNaN(t) || m < 0 || m > t)
        return toast("Invalid marks", "error");
    }
    try {
      await apiFetch(`/grades/${editing.id}`, {
        method: "PUT",
        body: {
          subject: editing.subject, term: editing.term,
          examType: editing.examType || examType,
          marks: isSpecial ? editing.marks : Number(editing.marks),
          totalMarks: Number(editing.total),
          teacherComment: editing.teacherComment ?? "",
        },
        token: auth?.token,
      });
      const data = await apiFetch("/grades", { token: auth?.token });
      setResults(data);
      setEditing(null);
      toast("Result updated", "success");
    } catch (err) { toast(err.message || "Update failed", "error"); }
  };

  const del = async id => {
    if (!window.confirm("Delete this result?")) return;
    try {
      await apiFetch(`/grades/${id}`, { method: "DELETE", token: auth?.token });
      setResults(results.filter(r => r.id !== id));
      toast("Result deleted", "success");
    } catch (err) { toast(err.message || "Delete failed", "error"); }
  };

  const counts = {
    EE: results.filter(r => r.grade === "EE").length,
    ME: results.filter(r => r.grade === "ME").length,
    AE: results.filter(r => r.grade === "AE").length,
    BE: results.filter(r => r.grade === "BE").length,
  };


  if (feeBlocked) return <FeeBlock onGoFees={onGoFees} pageName="Grades & Results" />;
  return (
    <div>
       {/* Grade summary */}
       <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
         {[["EE","success"],["ME","info"],["AE","warning"],["BE","danger"]].map(([g]) => (
           <div key={g} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", minWidth:70, textAlign:"center" }}>
             <div style={{ fontWeight:800, fontSize:20, color: g==="EE"?"#22c55e":g==="ME"?"#38bdf8":g==="AE"?"#f59e0b":"#ef4444" }}>{counts[g]}</div>
             <div style={{ fontSize:11, color:C.textMuted }}>{g}</div>
           </div>
         ))}
        {/* Legend */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", fontSize:11, color:C.textMuted, display:"flex", flexDirection:"column", gap:2, justifyContent:"center" }}>
          <div><span style={{color:C.textMuted, fontStyle:"italic"}}>N/A</span> — Did not sit subject</div>
          <div><Badge tone="warning">X</Badge> — Absent / missed exam</div>
          <div><Badge tone="danger">Y</Badge> — Caught cheating</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:10 }}>
        <select style={inputStyle} value={term} onChange={e => setTerm(e.target.value)}>
          <option value="all">All terms</option>
          <option value="Term 1">Term 1</option>
          <option value="Term 2">Term 2</option>
          <option value="Term 3">Term 3</option>
        </select>
        <select style={inputStyle} value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="all">All classes</option>
          {classesForDropdown.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={inputStyle} value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
          <option value="all">{filterClass === "all" ? "All students" : `Students in ${filterClass}`}</option>
          {(filterClass === "all" ? students : students.filter(s => normalizeClassName(getStudentClass(s)) === normalizeClassName(filterClass))).map(s => (
            <option key={getStudentId(s)} value={getStudentId(s)}>{getStudentName(s)}</option>
          ))}
        </select>
        <select style={inputStyle} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="all">All subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={inputStyle} value={examType} onChange={e => setExamType(e.target.value)}>
  <option value="Opener">Opener</option>
  <option value="Mid-Term">Mid-Term</option>
  <option value="End-Term">End-Term</option>
</select>
        <Btn variant="ghost" onClick={() => {
          // Columns: Student Name | Admission Number | Subject1 | … | Term
          if (filterClass === "all") {
            return toast("Select a class from the dropdown, then export", "warn");
          }
          const cls = filterClass;
          const classTerm = term === "all" ? (currentTerm || "Term 1") : term;
          const exportSubjects = getExportSubjects(cls, classTerm);

          if (!exportSubjects.length) {
            return toast("No subjects found. Add subjects under Subjects, or use Seed Defaults.", "warn");
          }

          const studentsInClass = students.filter(
            s => normalizeClassName(getStudentClass(s)) === normalizeClassName(cls)
          );

          if (studentsInClass.length === 0) {
            return toast(`No students found in ${cls}. Check that students have this class assigned.`, "warn");
          }

          const missingAdm = studentsInClass.filter(s => !getAdmissionNumber(s));
          if (missingAdm.length > 0) {
            return toast(
              `${missingAdm.length} student(s) in ${cls} have no admission number. Add admission numbers on the Students page first.`,
              "error"
            );
          }

          const marksByStudent = {};
          for (const r of results) {
            if (r.term !== classTerm) continue;
            if (normalizeClassName(r.className) !== normalizeClassName(cls)) continue;
            const sid = `${r.studentId ?? r.student_id ?? ""}`;
            if (!marksByStudent[sid]) marksByStudent[sid] = {};
            const raw = r.marks;
            marksByStudent[sid][r.subject] =
              raw === "na" ? "N/A" : raw === "absent" ? "X" : raw === "cheat" ? "Y" : raw ?? "";
          }

          const headers = ["Student Name", "Admission Number", ...exportSubjects, "Term"];
          const rows = studentsInClass.map(s => {
            const sid = `${getStudentId(s)}`;
            const existing = marksByStudent[sid] || {};
            return [
              getStudentName(s),
              getAdmissionNumber(s),
              ...exportSubjects.map(sub => markToCsv(lookupSubjectMark(existing, sub))),
              classTerm,
            ];
          });

          const safeClass = cls.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
          csv(`grades_${safeClass}_${classTerm.replace(/\s+/g, "_")}.csv`, headers, rows);
          toast(
            `Exported ${studentsInClass.length} students with ${exportSubjects.length} subject columns for ${cls}`,
            "success"
          );
        }}>Export Template</Btn>
        {canEdit && (
          <>
            <label style={{ cursor: "pointer" }}>
              <span style={{ display:"inline-block", padding:"6px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.accent, fontSize:13, fontWeight:500 }}>
                Import CSV
              </span>
              <input
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  try {
                    const token = auth?.token || sessionStorage.getItem("token");
                    const res = await fetch(`${API_BASE}/grades/import`, {
                    method: "POST",
                    headers: await getAuthHeaders(),
                    body: form,
                    });

                    const data = await res.json();

                    if (!res.ok) {
                    throw new Error(data.message || "Import failed");
                    }
                    if (!res.ok) {
                      toast(data.message || "Import failed", "error");
                      return;
                    }
                    const imp = data.imported ?? 0;
                    const sk = data.skipped ?? 0;
                    const errs = data.errors ?? [];
                    let detail = "";

                    if (errs.length > 0) {
                    detail = ` ${errs.length} row(s) had errors.`;
                  }
                    toast(
                    `Imported ${imp} grade(s). Skipped ${sk}.${detail}`,
                    errs.length ? "warn" : "success"
                  );  
                    if (nf > 0 && imp === 0) {
                      tone = "error";
                      detail = ` ${nf} admission number(s) did not match any student.`;
                    } else if (nf > 0) {
                      tone = "warn";
                      detail = ` ${nf} row(s) had unmatched admission numbers.`;
                    }
                    if (sk > nf) {
                      detail += ` ${sk - nf} other row(s) were skipped (errors).`;
                    }
                    toast(
                      `Imported ${imp} grade(s) across ${rp} row(s).${detail}`,
                      tone
                    );
                    const fresh = await apiFetch("/grades", { token });
                    setResults(fresh);
                  } catch (err) {
                    toast(err.message || "Import failed", "error");
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <Btn onClick={() => {
              setShowBulk(true);
              setBulkClass("");
              setStudentId("");
              setSelectedSubject("");
              setBulkMarks(subjects.reduce((a, sub) => ({ ...a, [sub]: "" }), {}));
            }}>Bulk Enter Results</Btn>
          </>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? <Msg text="No results yet." /> : (
        <>
          <div style={{ overflowX:"auto" }}>
            <Table
              headers={["Student","Class","Subject","Term","Exam Type","Score","Grade","Actions"]}
              rows={rows.map(r => [
                <span key={r.id} style={{ color:C.text, fontWeight:600 }}>{r.studentName}</span>,
                r.className, r.subject, r.term, r.examType,
                displayMark(r.marks, r.total),
                r.marks === "na" || r.marks === "absent" || r.marks === "cheat"
                  ? <span style={{ color:C.textMuted, fontSize:12 }}>—</span>
                  : <Badge tone={gradeColor(r.grade)}>{r.grade}</Badge>,
                <div key="a" style={{ display:"flex", gap:6 }}>
                  {canEdit && <Btn variant="ghost" onClick={() => setEditing(r)}>Edit</Btn>}
                  {canEdit && <Btn variant="danger" onClick={() => del(r.id)}>Del</Btn>}
                </div>,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Class Rankings */}
      {rankings && filterClass !== "all" && (
        <div style={{ marginTop: 24, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, background: C.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: C.text, fontSize: 16 }}>
              🏆 Class Rankings: {filterClass}
            </h3>
            <Btn variant="ghost" onClick={() => setShowRankings(!showRankings)}>
              {showRankings ? "Hide" : "Show"} Details
            </Btn>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={{ textAlign: "center", padding: "8px 12px", background: "#1A2A42", borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#3B82F6" }}>{rankings.classStats.meanScore.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Class Mean</div>
            </div>
            <div style={{ textAlign: "center", padding: "8px 12px", background: "#1A2A42", borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>{rankings.classStats.passRate.toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Pass Rate</div>
            </div>
            <div style={{ textAlign: "center", padding: "8px 12px", background: "#1A2A42", borderRadius: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{rankings.students.length}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Students</div>
            </div>
          </div>

          {showRankings && (
            <div style={{ overflowX: "auto" }}>
              <Table
                headers={["Rank", "Student", "Exam Type", "Mean Score", "Total Marks", "Grade", "Position"]} 
                rows={rankings.students.slice(0, 20).map((s, idx) => [
                  <span key="rank" style={{ fontWeight: 700, fontSize: 16, color: idx < 3 ? '#f59e0b' : C.text }}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${s.rank}`}
                  </span>,
                  <span key="name" style={{ color: C.text, fontWeight: 600 }}>{s.studentName}</span>,
                  <span key="examType" style={{ color: C.text, fontWeight: 600 }}>{s.examType}</span>,
                  <span key="mean" style={{ fontWeight: 600, color: '#3B82F6' }}>{s.meanScore.toFixed(1)}%</span>,
                  <span key="total">{s.totalMarks}/{s.maxPossible}</span>,
                  <Badge key="grade" tone={getGradeHexColor(s.overallGrade)}>{s.overallGrade}</Badge>,
                  <span key="pos" style={{ fontSize: 12, color: C.textMuted }}>Position {s.rank} of {rankings.students.length}</span>
                ])}
              />
            </div>
          )}
        </div>
      )}

      {/* Bulk Modal */}
      {showBulk && (
        <Modal title="Bulk Results Entry" onClose={() => {
          setShowBulk(false);
          setBulkClass("");
          setStudentId("");
          setSelectedSubject("");
          setBulkMarks(subjects.reduce((a, sub) => ({ ...a, [sub]: "" }), {}));
        }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <Field label="Class">
              <select style={inputStyle} value={bulkClass} onChange={e => { setBulkClass(e.target.value); setStudentId(""); }}>
                <option value="">Select class...</option>
                {classesForDropdown.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Student">
              <select style={inputStyle} value={studentId} onChange={e => setStudentId(e.target.value)} disabled={!bulkClass}>
                <option value="">{bulkClass ? "Select student..." : "Select class first"}</option>
                {students.filter(s => normalizeClassName(getStudentClass(s)) === normalizeClassName(bulkClass)).map(s => (
                  <option key={getStudentId(s)} value={getStudentId(s)}>{getStudentName(s)}</option>
                ))}
              </select>
            </Field>
            <Field label="Subject (Optional)">
              <select style={inputStyle} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                <option value="">All subjects (multi-entry mode)</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Term">
              <select style={inputStyle} value={term === "all" ? "Term 2" : term} onChange={e => setTerm(e.target.value)}>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </Field>
            <Field label="Total Marks">
              <input type="number" style={inputStyle} value={total} onChange={e => setTotal(e.target.value)} />
            </Field>
          </div>

          {/* Legend inside modal */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", fontSize:12, color:C.textMuted, marginBottom:8, display:"flex", gap:16 }}>
            <span>Leave blank to skip subject</span>
            <span><strong style={{color:C.text}}>N/A</strong> = does not take subject</span>
            <span><strong style={{color:"#f59e0b"}}>X</strong> = absent</span>
            <span><strong style={{color:"#ef4444"}}>Y</strong> = cheating</span>
          </div>

          <div style={{ maxHeight:340, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:10, padding:8, marginBottom:10 }}>
            {(selectedSubject ? [selectedSubject] : subjects).map(sub => (
              <div key={sub} style={{ display:"grid", gridTemplateColumns:"1fr 180px", gap:8, alignItems:"center", borderBottom:`1px solid ${C.border}`, padding:"8px 4px" }}>
                <div style={{ color:C.text, fontSize:13 }}>{sub}</div>
                <select
                  value={["na","absent","cheat"].includes(bulkMarks[sub]) ? bulkMarks[sub] : "__num__"}
                  onChange={e => {
                    const v = e.target.value;
                    if (v !== "__num__") setBulkMarks({ ...bulkMarks, [sub]: v });
                    else setBulkMarks({ ...bulkMarks, [sub]: "" });
                  }}
                  style={{ ...inputStyle, marginBottom:0 }}
                >
                  <option value="__num__">Enter marks →</option>
                  <option value="na">N/A – Does not sit</option>
                  <option value="absent">X – Absent</option>
                  <option value="cheat">Y – Cheating</option>
                </select>
                {!["na","absent","cheat"].includes(bulkMarks[sub]) && (
                  <input
                    type="number" min="0" style={{ ...inputStyle, gridColumn:"2", marginTop:4 }}
                    value={bulkMarks[sub]}
                    onChange={e => setBulkMarks({ ...bulkMarks, [sub]: e.target.value })}
                    placeholder="marks"
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <Btn variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Btn>
            <Btn onClick={saveBulk}>Save Results</Btn>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Result" onClose={() => setEditing(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Student">
              <input style={inputStyle} value={editing.studentName} disabled />
            </Field>
            <Field label="Subject">
              <input style={inputStyle} value={editing.subject} disabled />
            </Field>
            <Field label="Term">
              <select style={inputStyle} value={editing.term} onChange={e => setEditing({ ...editing, term:e.target.value })}>
                <option>Term 1</option><option>Term 2</option><option>Term 3</option>
              </select>
            </Field>
            <Field label="Total">
              <input type="number" style={inputStyle} value={editing.total} onChange={e => setEditing({ ...editing, total:e.target.value })} />
            </Field>
            <Field label="Marks / Status">
              <select style={inputStyle} value={["na","absent","cheat"].includes(editing.marks) ? editing.marks : "__num__"}
                onChange={e => {
                  const v = e.target.value;
                  if (v !== "__num__") setEditing({ ...editing, marks:v });
                  else setEditing({ ...editing, marks:"" });
                }}>
                <option value="__num__">Numeric marks</option>
                <option value="na">N/A – Does not sit</option>
                <option value="absent">X – Absent</option>
                <option value="cheat">Y – Cheating</option>
              </select>
              {!["na","absent","cheat"].includes(editing.marks) && (
                <input type="number" style={{ ...inputStyle, marginTop:6 }} value={editing.marks}
                  onChange={e => setEditing({ ...editing, marks:e.target.value })} />
              )}
            </Field>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:10 }}>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn onClick={saveEdit}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

GradesPage.propTypes = {
  auth:       PropTypes.object,
  students:   PropTypes.array.isRequired,
  results:    PropTypes.array.isRequired,
  setResults: PropTypes.func.isRequired,
  canEdit:    PropTypes.bool.isRequired,
  toast:      PropTypes.func.isRequired,
  feeBlocked: PropTypes.bool,
  onGoFees:   PropTypes.func,
};
