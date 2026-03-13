import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", fontSize: 13, width: "100%",
  boxSizing: "border-box",
};
const Lbl = ({ children }) => (
  <label style={{ display: "block", fontSize: 11, fontWeight: 700,
    color: C.textMuted, marginBottom: 5, textTransform: "uppercase",
    letterSpacing: "0.06em" }}>{children}</label>
);
Lbl.propTypes = { children: PropTypes.node };

const STATUS_COLOR = {
  draft:    { bg:"#1a1a2e", border:"#3d3d6b", text:"#8888cc" },
  pending:  { bg:"#1c1400", border:"#a16207", text:"#facc15" },
  approved: { bg:"#052e16", border:"#166534", text:"#4ade80" },
  rejected: { bg:"#1c0505", border:"#991b1b", text:"#f87171" },
};

const Badge = ({ status }) => {
  const s = STATUS_COLOR[status] || STATUS_COLOR.draft;
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`,
      color: s.text, borderRadius: 20, padding: "2px 10px",
      fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
      {status.replace("_", " ")}
    </span>
  );
};
Badge.propTypes = { status: PropTypes.string };

// ── Plan list ─────────────────────────────────────────────────────────────────
function PlanList({ auth, onNew, onOpen }) {
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    const qs = typeFilter !== "all" ? `?type=${typeFilter}` : "";
    apiFetch(`/lesson-plans${qs}`, { token: auth?.token })
      .then(d => { setPlans(d || []); setLoading(false); })
      .catch(e => { setPlans([]); setErr(e?.message || "Failed to load lesson plans"); setLoading(false); });
  }, [auth, typeFilter]);

  useEffect(load, [load]);

  const empty = !loading && plans.length === 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:8 }}>
          {[["all","All"],["lesson_plan","Lesson Plans"],["scheme","Schemes of Work"]].map(([v,l]) => (
            <button key={v} onClick={() => setTypeFilter(v)} style={{
              padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:700,
              cursor:"pointer",
              background: typeFilter===v ? C.accent : C.card,
              color: typeFilter===v ? "#fff" : C.textMuted,
              border: `1px solid ${typeFilter===v ? C.accent : C.border}`,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onNew("lesson_plan")} style={{
            background:C.accent, color:"#fff", border:"none", borderRadius:8,
            padding:"8px 16px", fontWeight:700, fontSize:13, cursor:"pointer",
          }}>+ Lesson Plan</button>
          <button onClick={() => onNew("scheme")} style={{
            background:"#6366f1", color:"#fff", border:"none", borderRadius:8,
            padding:"8px 16px", fontWeight:700, fontSize:13, cursor:"pointer",
          }}>+ Scheme of Work</button>
        </div>
      </div>

      {loading && <div style={{ color:C.textMuted, padding:32 }}>Loading…</div>}

      {!loading && err && (
        <div style={{ background:"#1c0505", border:"1px solid #991b1b", borderRadius:12, padding:12, color:"#fca5a5", fontSize:13, marginBottom:12 }}>
          {err}
        </div>
      )}

      {empty && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`,
          borderRadius:16, padding:60, textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📝</div>
          <div style={{ fontWeight:700, color:C.text, marginBottom:8 }}>No documents yet</div>
          <div style={{ color:C.textMuted, fontSize:13, marginBottom:20 }}>
            Create a lesson plan or scheme of work using the AI generator
          </div>
          <button onClick={() => onNew("lesson_plan")} style={{
            background:C.accent, color:"#fff", border:"none", borderRadius:8,
            padding:"9px 24px", fontWeight:700, fontSize:13, cursor:"pointer",
          }}>Generate with AI</button>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`,
          borderRadius:12, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["Type","Subject","Class","Term / Week","Topic","Status","Date"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"10px 14px",
                    borderBottom:`1px solid ${C.border}`, color:C.textMuted,
                    fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.plan_id}
                  onClick={() => onOpen(p)}
                  style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer",
                    transition:"background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accentGlow}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding:"10px 14px" }}>
                    <span style={{ fontSize:11, fontWeight:700,
                      color: p.type==="scheme" ? "#6366f1" : C.accent,
                      background: p.type==="scheme" ? "#1e1b4b" : C.accentGlow,
                      borderRadius:6, padding:"2px 8px" }}>
                      {p.type === "scheme" ? "Scheme" : "Lesson"}
                    </span>
                  </td>
                  <td style={{ padding:"10px 14px", color:C.text, fontWeight:600 }}>{p.subject}</td>
                  <td style={{ padding:"10px 14px", color:C.textSub }}>{p.class_name}</td>
                  <td style={{ padding:"10px 14px", color:C.textSub, fontSize:12 }}>
                    {p.term}{p.week ? ` · Wk ${p.week}` : ""}
                  </td>
                  <td style={{ padding:"10px 14px", color:C.text, maxWidth:200,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {p.topic}
                  </td>
                  <td style={{ padding:"10px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding:"10px 14px", color:C.textMuted, fontSize:12 }}>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
PlanList.propTypes = { auth:PropTypes.object, onNew:PropTypes.func, onOpen:PropTypes.func };

// ── Plan editor / AI generator ────────────────────────────────────────────────
function PlanEditor({ auth, toast, editPlan, type: initType, onBack, onSaved }) {
  const isEdit   = Boolean(editPlan);
  const planType = editPlan?.type || initType || "lesson_plan";

  const [form, setForm] = useState({
    subject:    editPlan?.subject    || "",
    class_name: editPlan?.class_name || "",
    term:       editPlan?.term       || "Term 1",
    week:       editPlan?.week       || "",
    topic:      editPlan?.topic      || "",
    duration:   editPlan?.duration   || "40 minutes",
  });
  const [aiNotes, setAiNotes] = useState("");
  const [content, setContent]         = useState(editPlan?.content || "");
  const [generating, setGenerating]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [rejectionNote, setRejNote]   = useState(editPlan?.admin_feedback || "");

  const f = key => ({
    value: form[key],
    onChange: e => setForm(p => ({ ...p, [key]: e.target.value })),
    style: inp,
  });

  const generate = async () => {
    if (!form.subject || !form.class_name || !form.topic)
      return toast("Fill Subject, Class and Topic first", "error");
    setGenerating(true);
    try {
      const res = await apiFetch("/lesson-plans/generate", {
        method: "POST", token: auth?.token,
        body: {
          subject: form.subject,
          class: form.class_name,
          term: form.term,
          week: form.week,
          topic: form.topic,
          duration: form.duration,
          type: planType,
          ai_notes: aiNotes,
        },
      });
      setContent(res.content || "");
      toast("Draft generated — review and edit before submitting", "success");
    } catch (e) {
      toast(e.message || "Generation failed", "error");
    }
    setGenerating(false);
  };

  const save = async (submitStatus) => {
    if (!content.trim()) return toast("Content cannot be empty", "error");
    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch(`/lesson-plans/${editPlan.plan_id}`, {
          method: "PUT", token: auth?.token,
          body: { ...form, content, status: submitStatus },
        });
      } else {
        await apiFetch("/lesson-plans", {
          method: "POST", token: auth?.token,
          body: { ...form, content, type: planType, status: submitStatus },
        });
      }
      toast(submitStatus === "pending"
        ? "Submitted for approval ✅"
        : "Saved as draft", "success");
      onSaved();
    } catch (e) {
      toast(e.message || "Save failed", "error");
    }
    setSaving(false);
  };

  const isRejected = editPlan?.status === "rejected";

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{ background:"transparent",
        border:`1px solid ${C.border}`, borderRadius:8, color:C.textMuted,
        cursor:"pointer", padding:"6px 14px", fontSize:13, marginBottom:20 }}>
        ← Back
      </button>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ fontSize:26 }}>{planType === "scheme" ? "📅" : "📝"}</div>
        <div>
          <h2 style={{ margin:0, color:C.text, fontSize:18 }}>
            {isEdit ? "Edit" : "New"} {planType === "scheme" ? "Scheme of Work" : "Lesson Plan"}
          </h2>
          <div style={{ color:C.textMuted, fontSize:12, marginTop:2 }}>
            Fill the details below, then click <strong>Generate with AI</strong> for a CBC-compliant draft
          </div>
        </div>
      </div>

      {/* Rejection notice */}
      {isRejected && rejectionNote && (
        <div style={{ background:"#1c0505", border:"1px solid #991b1b",
          borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ color:"#f87171", fontWeight:700, marginBottom:6 }}>
            ❌ Rejected by Admin
          </div>
          <div style={{ color:"#fca5a5", fontSize:13 }}>{rejectionNote}</div>
          <div style={{ color:"#f87171", fontSize:12, marginTop:8 }}>
            Edit the content below and resubmit.
          </div>
        </div>
      )}

      {/* Form fields */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`,
        borderRadius:12, padding:20, marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
          <div><Lbl>Subject *</Lbl>
            <select {...f("subject")} style={inp}>
              <option value="">Select subject…</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Lbl>Class *</Lbl>
            <select {...f("class_name")} style={inp}>
              <option value="">Select class…</option>
              {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Lbl>Term</Lbl>
            <select {...f("term")} style={inp}>
              {["Term 1","Term 2","Term 3"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {planType === "lesson_plan" && <>
            <div><Lbl>Topic *</Lbl><input {...f("topic")} placeholder="e.g. Fractions" /></div>
            <div><Lbl>Duration</Lbl><input {...f("duration")} placeholder="e.g. 40 minutes" /></div>
            <div><Lbl>Week</Lbl><input {...f("week")} placeholder="e.g. 3" /></div>
          </>}
          {planType === "scheme" && (
            <div style={{ gridColumn:"1/-1" }}>
              <Lbl>Description / Focus (optional)</Lbl>
              <input {...f("topic")} placeholder="e.g. Number concepts and operations" />
            </div>
          )}
        </div>

        <div style={{ marginTop:14 }}>
          <Lbl>Extra details for AI (optional)</Lbl>
          <textarea
            value={aiNotes}
            onChange={e => setAiNotes(e.target.value)}
            placeholder="Paste your answers/requirements here (e.g. Strand, Sub-strand, Learning outcomes, Activities, Resources, Assessment)."
            style={{ ...inp, height: 90, resize: "vertical", fontSize: 12, lineHeight: 1.6 }}
          />
        </div>

        <div style={{ marginTop:16 }}>
          <button onClick={generate} disabled={generating} style={{
            background: `linear-gradient(135deg, ${C.accent}, #6366f1)`,
            color:"#fff", border:"none", borderRadius:9,
            padding:"10px 28px", fontWeight:800, fontSize:14,
            cursor: generating ? "not-allowed" : "pointer",
            opacity: generating ? 0.7 : 1,
          }}>
            {generating ? "⏳ Generating…" : "✨ Generate with AI"}
          </button>
          <span style={{ fontSize:11, color:C.textMuted, marginLeft:12 }}>
            Uses KICD CBC framework
          </span>
        </div>
      </div>

      {/* Content editor */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`,
        borderRadius:12, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:10 }}>
          <Lbl>Content (edit before submitting)</Lbl>
          {content && (
            <span style={{ fontSize:11, color:C.textMuted }}>
              {content.length.toLocaleString()} chars
            </span>
          )}
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={generating
            ? "Generating CBC-compliant draft…"
            : "Click 'Generate with AI' above, or type your lesson plan here…"}
          style={{ ...inp, height:420, resize:"vertical", fontFamily:"'Courier New', monospace",
            fontSize:12, lineHeight:1.8 }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={() => save("draft")} disabled={saving || !content.trim()} style={{
          background:C.card, border:`1px solid ${C.border}`, color:C.textSub,
          borderRadius:8, padding:"9px 20px", fontWeight:700, fontSize:13,
          cursor:"pointer",
        }}>
          💾 Save Draft
        </button>
        <button onClick={() => save("pending")} disabled={saving || !content.trim()} style={{
          background:C.accent, color:"#fff", border:"none", borderRadius:8,
          padding:"9px 24px", fontWeight:700, fontSize:13, cursor:"pointer",
          opacity: (!content.trim() || saving) ? 0.6 : 1,
        }}>
          {saving ? "Submitting…" : "📤 Submit for Approval"}
        </button>
      </div>
    </div>
  );
}
PlanEditor.propTypes = {
  auth:PropTypes.object, toast:PropTypes.func,
  editPlan:PropTypes.object, type:PropTypes.string,
  onBack:PropTypes.func, onSaved:PropTypes.func,
};

// ── Plan viewer (read-only for teacher) ───────────────────────────────────────
function PlanViewer({ plan, onBack, onEdit }) {
  const canEdit = ["draft","rejected"].includes(plan.status);
  return (
    <div>
      <button onClick={onBack} style={{ background:"transparent",
        border:`1px solid ${C.border}`, borderRadius:8, color:C.textMuted,
        cursor:"pointer", padding:"6px 14px", fontSize:13, marginBottom:20 }}>
        ← Back
      </button>

      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ margin:0, color:C.text, fontSize:18 }}>
            {plan.type === "scheme" ? "📅 Scheme of Work" : "📝 Lesson Plan"}
          </h2>
          <div style={{ color:C.textMuted, fontSize:12, marginTop:4 }}>
            {plan.subject} · {plan.class_name} · {plan.term}
            {plan.week ? ` · Week ${plan.week}` : ""}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Badge status={plan.status} />
          {canEdit && (
            <button onClick={onEdit} style={{
              background:C.accent, color:"#fff", border:"none", borderRadius:8,
              padding:"7px 16px", fontWeight:700, fontSize:13, cursor:"pointer",
            }}>✏️ Edit</button>
          )}
        </div>
      </div>

      {/* Admin feedback */}
      {plan.status === "rejected" && plan.admin_feedback && (
        <div style={{ background:"#1c0505", border:"1px solid #991b1b",
          borderRadius:12, padding:16, marginBottom:20 }}>
          <div style={{ color:"#f87171", fontWeight:700, marginBottom:6 }}>
            ❌ Admin Feedback
          </div>
          <div style={{ color:"#fca5a5", fontSize:13 }}>{plan.admin_feedback}</div>
        </div>
      )}

      {/* Content */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`,
        borderRadius:12, padding:24 }}>
        <pre style={{ color:C.text, fontSize:13, lineHeight:1.9,
          whiteSpace:"pre-wrap", fontFamily:"'Segoe UI', Arial, sans-serif",
          margin:0 }}>
          {plan.content}
        </pre>
      </div>
    </div>
  );
}
PlanViewer.propTypes = { plan:PropTypes.object, onBack:PropTypes.func, onEdit:PropTypes.func };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LessonPlansPage({ auth, toast }) {
  const [view, setView]       = useState("list");   // list | new | edit | view
  const [selected, setSelected] = useState(null);
  const [newType, setNewType] = useState("lesson_plan");
  const [opening, setOpening] = useState(false);

  const openNew = (type) => { setNewType(type); setSelected(null); setView("new"); };
  const openPlan = async (p) => {
    setOpening(true);
    setSelected(null);
    setView("view");
    try {
      const full = await apiFetch(`/lesson-plans/${p.plan_id}`, { token: auth?.token });
      setSelected(full);
    } catch (e) {
      toast?.(e.message || "Failed to load lesson plan", "error");
      setView("list");
    }
    setOpening(false);
  };
  const openEdit = ()    => setView("edit");
  const goBack   = ()    => { setSelected(null); setView("list"); };
  const onSaved  = ()    => { setSelected(null); setView("list"); };

  return (
    <div>
      {view === "list" && (
        <PlanList auth={auth} onNew={openNew} onOpen={openPlan} />
      )}
      {view === "new" && (
        <PlanEditor auth={auth} toast={toast} type={newType}
          onBack={goBack} onSaved={onSaved} />
      )}
      {view === "view" && opening && !selected && (
        <div style={{ color: C.textMuted, padding: 40 }}>Loading plan…</div>
      )}
      {view === "view" && selected && (
        <PlanViewer plan={selected} onBack={goBack} onEdit={openEdit} />
      )}
      {view === "edit" && selected && (
        <PlanEditor auth={auth} toast={toast} editPlan={selected}
          onBack={goBack} onSaved={onSaved} />
      )}
    </div>
  );
}
LessonPlansPage.propTypes = { auth:PropTypes.object, toast:PropTypes.func };
