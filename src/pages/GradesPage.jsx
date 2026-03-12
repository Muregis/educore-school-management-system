import { useState, useEffect } from "react";
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

// Special mark codes
const SPECIAL_MARKS = [
  { value:"NA", label:"N/A — Did not sit this subject" },
  { value:"X",  label:"X — Missed / Absent from exam" },
  { value:"Y",  label:"Y — Disqualified (cheating)" },
];

function markDisplay(marks, total) {
  if (marks === "NA") return <span style={{ color:C.textMuted, fontStyle:"italic" }}>N/A</span>;
  if (marks === "X")  return <span style={{ color:C.amber }}>X (Absent)</span>;
  if (marks === "Y")  return <span style={{ color:C.rose }}>Y (Disqualified)</span>;
  return `${marks}/${total}`;
}

function gradeFor(marks, total) {
  if (["NA","X","Y"].includes(String(marks))) return String(marks);
  const pct = (Number(marks) / Number(total)) * 100;
  if (pct >= 75) return "EE";
  if (pct >= 50) return "ME";
  if (pct >= 25) return "AE";
  return "BE";
}

function gradeTone(g) {
  if (g === "EE")            return "success";
  if (g === "ME")            return "info";
  if (g === "AE")            return "warning";
  if (g === "BE")            return "danger";
  if (g === "NA")            return "muted";
  if (g === "X" || g === "Y") return "danger";
  return "info";
}

export default function GradesPage({ auth, students, results, setResults, canEdit, toast }) {
  const [term, setTerm]               = useState("Term 2");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [page, setPage]               = useState(1);
  const [showBulk, setShowBulk]       = useState(false);
  const [studentId, setStudentId]     = useState(students[0]?.id || "");
  const [total, setTotal]             = useState("100");
  const [bulkMarks, setBulkMarks]     = useState(() => SUBJECTS.reduce((a,s)=>({...a,[s]:""}),{}));
  const [editing, setEditing]         = useState(null);

  useEffect(() => {
    if (auth?.token) {
      apiFetch("/grades", { token:auth.token })
        .then(data => setResults(data))
        .catch(() => toast("Failed to fetch results", "error"));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const filtered = results.filter(r =>
    (term === "all" || r.term === term) &&
    (filterClass === "all" || r.className === filterClass) &&
    (filterStudent === "all" || String(r.studentId) === String(filterStudent))
  );

  const { pages, rows } = pager(filtered, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const saveBulk = async () => {
    const s = students.find(x => x.id === Number(studentId));
    if (!s) return toast("Select student", "error");
    const t = Number(total);
    if (!t) return toast("Total marks required", "error");
    const entered = SUBJECTS.filter(sub => bulkMarks[sub] !== "");
    if (entered.length === 0) return toast("Enter at least one subject mark", "error");
    try {
      const classId = s.classId ?? s.class_id ?? null;
      await apiFetch("/grades/bulk", {
        method:"POST",
        body:{
          studentId: s.id, classId, term, totalMarks: t,
          subjects: entered.map(sub => ({
            subject: sub,
            marks:   ["NA","X","Y"].includes(bulkMarks[sub]) ? bulkMarks[sub] : Number(bulkMarks[sub]),
          })),
        },
        token: auth?.token,
      });
      const data = await apiFetch("/grades", { token:auth?.token });
      setResults(data);
      setBulkMarks(SUBJECTS.reduce((a,sub)=>({...a,[sub]:""}),{}));
      setShowBulk(false);
      toast("Bulk results saved", "success");
    } catch (err) { toast(err.message||"Save failed","error"); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const special = ["NA","X","Y"].includes(String(editing.marks));
    if (!special) {
      const m = Number(editing.marks);
      const t = Number(editing.total);
      if (Number.isNaN(m)||Number.isNaN(t)||m<0||m>t) return toast("Invalid marks","error");
    }
    try {
      await apiFetch(`/grades/${editing.id}`, {
        method:"PUT",
        body:{ subject:editing.subject, term:editing.term, marks:editing.marks, totalMarks:editing.total, teacherComment:editing.teacherComment??"" },
        token: auth?.token,
      });
      const data = await apiFetch("/grades", { token:auth?.token });
      setResults(data);
      setEditing(null);
      toast("Result updated", "success");
    } catch (err) { toast(err.message||"Update failed","error"); }
  };

  const del = async id => {
    if (!window.confirm("Delete this result?")) return;
    try {
      await apiFetch(`/grades/${id}`, { method:"DELETE", token:auth?.token });
      setResults(results.filter(r => r.id !== id));
      toast("Result deleted", "success");
    } catch (err) { toast(err.message||"Delete failed","error"); }
  };

  const counts = { EE:0, ME:0, AE:0, BE:0 };
  results.forEach(r => { if (counts[r.grade] !== undefined) counts[r.grade]++; });

  return (
    <div>
      {/* Grade summary badges */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[["EE","success"],["ME","info"],["AE","warning"],["BE","danger"]].map(([g,t])=>(
          <Badge key={g} tone={t}>{g}: {counts[g]}</Badge>
        ))}
        <Badge tone="muted">NA: {results.filter(r=>r.marks==="NA"||r.grade==="NA").length}</Badge>
        <Badge tone="danger">X: {results.filter(r=>r.marks==="X"||r.grade==="X").length}</Badge>
        <Badge tone="danger">Y: {results.filter(r=>r.marks==="Y"||r.grade==="Y").length}</Badge>
      </div>

      {/* Special codes legend */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 14px", marginBottom:14, fontSize:12, color:C.textSub, display:"flex", gap:20, flexWrap:"wrap" }}>
        <span><strong style={{ color:C.textMuted }}>N/A</strong> — Student doesn't do this subject</span>
        <span><strong style={{ color:C.amber }}>X</strong> — Missed / absent from exam</span>
        <span><strong style={{ color:C.rose }}>Y</strong> — Disqualified (cheating)</span>
      </div>

      {/* Filters */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:12 }}>
        <select style={inputStyle} value={term} onChange={e=>setTerm(e.target.value)}>
          <option value="all">All terms</option>
          <option value="Term 1">Term 1</option>
          <option value="Term 2">Term 2</option>
          <option value="Term 3">Term 3</option>
        </select>
        <select style={inputStyle} value={filterClass} onChange={e=>setFilterClass(e.target.value)}>
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
        <select style={inputStyle} value={filterStudent} onChange={e=>setFilterStudent(e.target.value)}>
          <option value="all">All students</option>
          {students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
        </select>
        <Btn variant="ghost" onClick={()=>{
          csv("results.csv",["Student","Class","Subject","Term","Marks","Total","Grade"],
            filtered.map(r=>[r.studentName,r.className,r.subject,r.term,r.marks,r.total,r.grade]));
          toast("CSV exported","success");
        }}>Export CSV</Btn>
        {canEdit && <Btn onClick={()=>setShowBulk(true)}>Bulk Enter</Btn>}
      </div>

      {filtered.length === 0 ? <Msg text="No results yet." /> : (
        <>
          <div style={{ overflowX:"auto" }}>
            <Table
              headers={["Student","Class","Subject","Term","Score","Grade","Actions"]}
              rows={rows.map(r => [
                <span key={r.id} style={{ color:C.text, fontWeight:600 }}>{r.studentName}</span>,
                r.className, r.subject, r.term,
                markDisplay(r.marks, r.total),
                <Badge key="g" tone={gradeTone(r.grade)}>{r.grade}</Badge>,
                <div key="a" style={{ display:"flex", gap:6 }}>
                  {canEdit && <Btn variant="ghost" onClick={()=>setEditing(r)}>Edit</Btn>}
                  {canEdit && <Btn variant="danger" onClick={()=>del(r.id)}>Delete</Btn>}
                </div>,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Bulk Entry Modal */}
      {showBulk && (
        <Modal title="Bulk Results Entry" onClose={()=>setShowBulk(false)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
            <Field label="Student">
              <select style={inputStyle} value={studentId} onChange={e=>setStudentId(Number(e.target.value))}>
                {students.map(s=>(
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.className})</option>
                ))}
              </select>
            </Field>
            <Field label="Term">
              <select style={inputStyle} value={term==="all"?"Term 2":term} onChange={e=>setTerm(e.target.value)}>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </Field>
            <Field label="Total Marks">
              <input type="number" style={inputStyle} value={total} onChange={e=>setTotal(e.target.value)} />
            </Field>
          </div>

          <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>
            Enter a number for marks, or select a special code from the dropdown.
          </div>

          <div style={{ maxHeight:340, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:10, padding:8, marginBottom:12 }}>
            {SUBJECTS.map(sub => {
              const val = bulkMarks[sub];
              const isSpecial = ["NA","X","Y"].includes(val);
              return (
                <div key={sub} style={{ display:"grid", gridTemplateColumns:"1fr 130px 140px", gap:8, alignItems:"center", borderBottom:`1px solid ${C.border}`, padding:"8px 4px" }}>
                  <div style={{ color:C.text, fontSize:13 }}>{sub}</div>
                  <input
                    type={isSpecial ? "text" : "number"}
                    min="0"
                    style={{ ...inputStyle, opacity: isSpecial ? 0.4 : 1 }}
                    value={isSpecial ? "" : val}
                    disabled={isSpecial}
                    onChange={e => setBulkMarks({...bulkMarks,[sub]:e.target.value})}
                    placeholder="marks"
                  />
                  <select
                    style={{ ...inputStyle, fontSize:11 }}
                    value={isSpecial ? val : ""}
                    onChange={e => setBulkMarks({...bulkMarks,[sub]:e.target.value})}
                  >
                    <option value="">— numeric —</option>
                    {SPECIAL_MARKS.map(sm=>(
                      <option key={sm.value} value={sm.value}>{sm.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <Btn variant="ghost" onClick={()=>setShowBulk(false)}>Cancel</Btn>
            <Btn onClick={saveBulk}>Save Results</Btn>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Result" onClose={()=>setEditing(null)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <Field label="Student"><input style={inputStyle} value={editing.studentName} disabled /></Field>
            <Field label="Subject"><input style={inputStyle} value={editing.subject} disabled /></Field>
            <Field label="Term">
              <select style={inputStyle} value={editing.term} onChange={e=>setEditing({...editing,term:e.target.value})}>
                <option>Term 1</option><option>Term 2</option><option>Term 3</option>
              </select>
            </Field>
            <Field label="Total Marks">
              <input type="number" style={inputStyle} value={editing.total} onChange={e=>setEditing({...editing,total:e.target.value})} />
            </Field>
          </div>
          <Field label="Marks / Special Code">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <input
                type={["NA","X","Y"].includes(String(editing.marks)) ? "text" : "number"}
                style={{ ...inputStyle, opacity:["NA","X","Y"].includes(String(editing.marks))?0.4:1 }}
                value={["NA","X","Y"].includes(String(editing.marks)) ? "" : editing.marks}
                disabled={["NA","X","Y"].includes(String(editing.marks))}
                onChange={e=>setEditing({...editing,marks:e.target.value})}
              />
              <select style={inputStyle} value={["NA","X","Y"].includes(String(editing.marks))?editing.marks:""}
                onChange={e=>setEditing({...editing,marks:e.target.value||editing.marks})}>
                <option value="">— numeric —</option>
                {SPECIAL_MARKS.map(sm=><option key={sm.value} value={sm.value}>{sm.label}</option>)}
              </select>
            </div>
          </Field>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:12 }}>
            <Btn variant="ghost" onClick={()=>setEditing(null)}>Cancel</Btn>
            <Btn onClick={saveEdit}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

GradesPage.propTypes = {
  auth:PropTypes.object, students:PropTypes.array.isRequired,
  results:PropTypes.array.isRequired, setResults:PropTypes.func.isRequired,
  canEdit:PropTypes.bool.isRequired, toast:PropTypes.func.isRequired,
};