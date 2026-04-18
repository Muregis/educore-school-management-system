import { useState, useEffect } from "react";
import FeeBlock from "../components/FeeBlock";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Pager, Msg, csv, pager } from "../components/Helpers";

// Special mark values
const SPECIAL_MARKS = {
  "N/A": "na",      // Did not sit this subject
  "X":   "absent",  // Missed exam / absent
  "Y":   "cheat",   // Caught cheating
};

function displayMark(marks, total) {
  if (marks === "na")     return <span style={{ color:C.textMuted, fontStyle:"italic" }}>N/A</span>;
  if (marks === "absent") return <Badge tone="warning">X – Absent</Badge>;
  if (marks === "cheat")  return <Badge tone="danger">Y – Cheating</Badge>;
  return `${marks}/${total}`;
}

function gradeColor(grade) {
  if (!grade) return "info";
  if (grade === "EE") return "success";
  if (grade === "ME") return "info";
  if (grade === "AE") return "warning";
  return "danger";
}

export default function GradesPage({ auth, students, results, setResults, canEdit, toast, feeBlocked = false, onGoFees}) {
  const [term, setTerm]                   = useState("Term 2");
  const [filterClass, setFilterClass]     = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [classOptions, setClassOptions] = useState([]);

  useEffect(() => {
    apiFetch('/api/classes', { token: auth?.token })
      .then(res => setClassOptions(res.data || res || []))
      .catch(() => {});
  }, [auth]);
  const [page, setPage]                   = useState(1);
  const [showBulk, setShowBulk]           = useState(false);
  const [bulkClass, setBulkClass]          = useState("");
  const [studentId, setStudentId]         = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [total, setTotal]                 = useState("100");
  const [subjects, setSubjects]           = useState([]);
  const [bulkMarks, setBulkMarks]         = useState({});
  const [editing, setEditing] = useState(null);

  // Load subjects from API
  useEffect(() => {
    if (!auth?.token) return;
    apiFetch("/subjects", { token: auth.token })
      .then(data => {
        const subjs = (data || []).map(s => s.name);
        setSubjects(subjs);
        // Initialize bulkMarks with subjects
        setBulkMarks(subjs.reduce((a, s) => ({ ...a, [s]: "" }), {}));
      })
      .catch(() => {
        // Fallback to constants if API fails
        setSubjects(SUBJECTS);
        setBulkMarks(SUBJECTS.reduce((a, s) => ({ ...a, [s]: "" }), {}));
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
    const s = students.find(x => x.id === Number(studentId));
    if (!s) return toast("Select student", "error");
    const t = Number(total);
    if (!t) return toast("Total marks required", "error");
    const entered = subjects.filter(sub => bulkMarks[sub] !== "");
    if (entered.length === 0) return toast("Enter at least one subject mark", "error");
    try {
      const classId = s.classId ?? s.class_id ?? null;
      await apiFetch("/grades/bulk", {
        method: "POST",
        body: {
          studentId: s.id, classId, term,
          totalMarks: t,
          subjects: entered.map(sub => ({
            subject: sub,
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
        {[["EE","success"],["ME","info"],["AE","warning"],["BE","danger"]].map(([g,t]) => (
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
          {classOptions.map(c => <option key={c.class_id} value={c.class_name}>{c.class_name}</option>)}
        </select>
        <select style={inputStyle} value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
          <option value="all">{filterClass === "all" ? "All students" : `Students in ${filterClass}`}</option>
          {(filterClass === "all" ? students : students.filter(s => s.className === filterClass)).map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
          ))}
        </select>
        <select style={inputStyle} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="all">All subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Btn variant="ghost" onClick={() => {
          csv("results.csv",
            ["Student","Class","Subject","Term","Marks","Total","Grade"],
            filtered.map(r => [r.studentName, r.className, r.subject, r.term, r.marks, r.total, r.grade])
          );
          toast("CSV exported", "success");
        }}>Export CSV</Btn>
        {canEdit && <Btn onClick={() => setShowBulk(true)}>Bulk Enter Results</Btn>}
      </div>

      {/* Table */}
      {filtered.length === 0 ? <Msg text="No results yet." /> : (
        <>
          <div style={{ overflowX:"auto" }}>
            <Table
              headers={["Student","Class","Subject","Term","Score","Grade","Actions"]}
              rows={rows.map(r => [
                <span key={r.id} style={{ color:C.text, fontWeight:600 }}>{r.studentName}</span>,
                r.className, r.subject, r.term,
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

      {/* Bulk Modal */}
      {showBulk && (
        <Modal title="Bulk Results Entry" onClose={() => { setShowBulk(false); setBulkClass(""); setStudentId(""); }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <Field label="Class">
              <select style={inputStyle} value={bulkClass} onChange={e => { setBulkClass(e.target.value); setStudentId(""); }}>
                <option value="">Select class...</option>
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Student">
              <select style={inputStyle} value={studentId} onChange={e => setStudentId(Number(e.target.value))} disabled={!bulkClass}>
                <option value="">{bulkClass ? "Select student..." : "Select class first"}</option>
                {students.filter(s => s.className === bulkClass).map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
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
            {subjects.map(sub => (
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
};
