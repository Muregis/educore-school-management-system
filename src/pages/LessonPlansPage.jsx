import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES, SUBJECTS } from "../lib/constants";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp = {
  background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
  color: "var(--color-text-primary)", padding: "10px 14px", fontSize: "14px", width: "100%",
  boxSizing: "border-box", transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

const Lbl = ({ children }) => (
  <label style={{ display: "block", fontSize: "12px", fontWeight: 600,
    color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>{children}</label>
);
Lbl.propTypes = { children: PropTypes.node };

const StatusBadge = ({ status }) => {
  const map = {
    draft:    { variant: "default", label: "Draft" },
    pending:  { variant: "warning", label: "Pending" },
    approved: { variant: "success", label: "Approved" },
    rejected: { variant: "danger", label: "Rejected" },
  };
  const s = map[status] || map.draft;
  return <Badge text={s.label} variant={s.variant} />;
};
StatusBadge.propTypes = { status: PropTypes.string };

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

  useEffect(() => { load(); }, [load]);

  const empty = !loading && plans.length === 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"center", marginBottom: "var(--space-4)", flexWrap:"wrap", gap: "var(--space-2)" }}>
        <div style={{ display:"flex", gap: "var(--space-2)", background: "var(--color-bg-base)", padding: "var(--space-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          {[["all","All"],["lesson_plan","Lesson Plans"],["scheme","Schemes of Work"]].map(([v,l]) => (
            <Button 
              key={v} 
              variant={typeFilter === v ? "primary" : "ghost"} 
              size="sm"
              onClick={() => setTypeFilter(v)}
            >
              {l}
            </Button>
          ))}
        </div>
        <div style={{ display:"flex", gap: "var(--space-2)" }}>
          <Button onClick={() => onNew("lesson_plan")} variant="primary">
            + Lesson Plan
          </Button>
          <Button onClick={() => onNew("scheme")} style={{ background: "var(--color-info)", borderColor: "var(--color-info)" }}>
            + Scheme of Work
          </Button>
        </div>
      </div>

      {loading && <div style={{ color: "var(--color-text-muted)", padding: "32px", textAlign: "center" }}>Loading…</div>}

      {!loading && err && (
        <Card style={{ padding: "var(--space-3)", marginBottom: "var(--space-3)", background: "color-mix(in srgb, var(--color-danger) 10%, transparent)", borderColor: "var(--color-danger)" }}>
          <div style={{ color: "var(--color-danger)", fontSize: "14px", fontWeight: 500 }}>{err}</div>
        </Card>
      )}

      {empty && !err && (
        <Card style={{ padding: "60px var(--space-4)" }}>
          <EmptyState 
            icon="📝" 
            title="No documents yet" 
            description="Create a lesson plan or scheme of work using the AI generator"
            action={<Button onClick={() => onNew("lesson_plan")}>Generate with AI</Button>}
          />
        </Card>
      )}

      {!loading && plans.length > 0 && (
        <Card>
          <Table 
            headers={["Type", "Subject", "Class", "Term / Week", "Topic", "Status", "Date"]}
            data={plans.map(p => [
              <span key="type" style={{ fontSize: "12px", fontWeight: 700,
                color: p.type === "scheme" ? "var(--color-info)" : "var(--color-primary)",
                background: p.type === "scheme" ? "color-mix(in srgb, var(--color-info) 10%, transparent)" : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                borderRadius: "var(--radius-sm)", padding: "2px 8px" }}>
                {p.type === "scheme" ? "Scheme" : "Lesson"}
              </span>,
              <span key="sub" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{p.subject}</span>,
              <span key="cls" style={{ color: "var(--color-text-secondary)" }}>{p.class_name}</span>,
              <span key="term" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>
                {p.term}{p.week ? ` · Wk ${p.week}` : ""}
              </span>,
              <span key="topic" style={{ color: "var(--color-text-primary)", maxWidth: 200, display: "block",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.topic}
              </span>,
              <StatusBadge key="status" status={p.status} />,
              <span key="date" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
                {new Date(p.updated_at).toLocaleDateString()}
              </span>
            ])}
            onRowClick={(idx) => onOpen(plans[idx])}
          />
        </Card>
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
  const [uploading, setUploading]     = useState(false);
  const [rejectionNote, setRejNote]   = useState(editPlan?.admin_feedback || "");

  const handleSelectChange = (e, key) => {
    setForm(p => ({ ...p, [key]: e.target.value }));
  };

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

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExt = [".txt", ".md", ".csv"];
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowedExt.some(ext => lowerName.endsWith(ext));

    if (!isAllowed) {
      toast("Upload a .txt, .md, or .csv lesson plan file", "error");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const importedText = await file.text();
      setContent(importedText);
      toast(`Imported ${file.name}`, "success");
    } catch (e) {
      toast(e.message || "File import failed", "error");
    }
    event.target.value = "";
    setUploading(false);
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
      <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: "var(--space-4)" }}>
        ← Back
      </Button>

      <div style={{ display:"flex", alignItems:"center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div style={{ fontSize: "32px" }}>{planType === "scheme" ? "📅" : "📝"}</div>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "20px", fontWeight: 700 }}>
            {isEdit ? "Edit" : "New"} {planType === "scheme" ? "Scheme of Work" : "Lesson Plan"}
          </h2>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginTop: "var(--space-1)" }}>
            Fill the details below, then click <strong>Generate with AI</strong> for a CBC-compliant draft
          </div>
        </div>
      </div>

      {/* Rejection notice */}
      {isRejected && rejectionNote && (
        <Card style={{ background: "color-mix(in srgb, var(--color-danger) 10%, transparent)", borderColor: "var(--color-danger)", padding: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <div style={{ color: "var(--color-danger)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
            ❌ Rejected by Admin
          </div>
          <div style={{ color: "var(--color-text-primary)", fontSize: "14px" }}>{rejectionNote}</div>
          <div style={{ color: "var(--color-danger)", fontSize: "13px", marginTop: "var(--space-2)" }}>
            Edit the content below and resubmit.
          </div>
        </Card>
      )}

      {/* Form fields */}
      <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          <div>
            <Select 
              label="Subject *" 
              value={form.subject} 
              onChange={e => handleSelectChange(e, "subject")}
              options={[{ value: "", label: "Select subject…" }, ...SUBJECTS.map(s => ({ value: s, label: s }))]}
            />
          </div>
          <div>
            <Select 
              label="Class *" 
              value={form.class_name} 
              onChange={e => handleSelectChange(e, "class_name")}
              options={[{ value: "", label: "Select class…" }, ...ALL_CLASSES.map(c => ({ value: c, label: c }))]}
            />
          </div>
          <div>
            <Select 
              label="Term" 
              value={form.term} 
              onChange={e => handleSelectChange(e, "term")}
              options={["Term 1", "Term 2", "Term 3"].map(t => ({ value: t, label: t }))}
            />
          </div>
          {planType === "lesson_plan" && <>
            <div><Lbl>Topic *</Lbl><input value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))} style={inp} placeholder="e.g. Fractions" /></div>
            <div><Lbl>Duration</Lbl><input value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} style={inp} placeholder="e.g. 40 minutes" /></div>
            <div><Lbl>Week</Lbl><input value={form.week} onChange={e => setForm(p => ({ ...p, week: e.target.value }))} style={inp} placeholder="e.g. 3" /></div>
          </>}
          {planType === "scheme" && (
            <div style={{ gridColumn: "1/-1" }}>
              <Lbl>Description / Focus (optional)</Lbl>
              <input value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))} style={inp} placeholder="e.g. Number concepts and operations" />
            </div>
          )}
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <Lbl>Extra details for AI (optional)</Lbl>
          <textarea
            value={aiNotes}
            onChange={e => setAiNotes(e.target.value)}
            placeholder="Paste your answers/requirements here (e.g. Strand, Sub-strand, Learning outcomes, Activities, Resources, Assessment)."
            style={{ ...inp, height: 90, resize: "vertical", fontSize: "14px", lineHeight: 1.6 }}
          />
        </div>

        <div style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Button onClick={generate} disabled={generating} size="lg" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-info))", border: "none" }}>
            {generating ? "⏳ Generating…" : "✨ Generate with AI"}
          </Button>
          <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
            Uses KICD CBC framework
          </span>
        </div>

        <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-4)" }}>
          <Lbl>Import Existing File</Lbl>
          <input
            type="file"
            accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
            onChange={importFile}
            style={{ ...inp, padding: "8px 12px", background: "var(--color-bg-surface)" }}
          />
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
            Upload a text-based lesson plan or scheme file and review it before saving.
            {uploading ? " Importing file..." : ""}
          </div>
        </div>
      </Card>

      {/* Content editor */}
      <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
          <Lbl>Content (edit before submitting)</Lbl>
          {content && (
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
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
          style={{ ...inp, height: 420, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.8 }}
        />
      </Card>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <Button onClick={() => save("draft")} disabled={saving || !content.trim()} variant="secondary">
          💾 Save Draft
        </Button>
        <Button onClick={() => save("pending")} disabled={saving || !content.trim()} variant="primary">
          {saving ? "Submitting…" : "📤 Submit for Approval"}
        </Button>
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
      <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: "var(--space-4)" }}>
        ← Back
      </Button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "20px", fontWeight: 700 }}>
            {plan.type === "scheme" ? "📅 Scheme of Work" : "📝 Lesson Plan"}
          </h2>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginTop: "var(--space-1)" }}>
            {plan.subject} · {plan.class_name} · {plan.term}
            {plan.week ? ` · Week ${plan.week}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <StatusBadge status={plan.status} />
          {canEdit && (
            <Button onClick={onEdit} variant="primary" size="sm">
              ✏️ Edit
            </Button>
          )}
        </div>
      </div>

      {/* Admin feedback */}
      {plan.status === "rejected" && plan.admin_feedback && (
        <Card style={{ background: "color-mix(in srgb, var(--color-danger) 10%, transparent)", borderColor: "var(--color-danger)", padding: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <div style={{ color: "var(--color-danger)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
            ❌ Admin Feedback
          </div>
          <div style={{ color: "var(--color-text-primary)", fontSize: "14px" }}>{plan.admin_feedback}</div>
        </Card>
      )}

      {/* Content */}
      <Card style={{ padding: "var(--space-4)" }}>
        <pre style={{ color: "var(--color-text-primary)", fontSize: "14px", lineHeight: 1.8,
          whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", margin: 0 }}>
          {plan.content}
        </pre>
      </Card>
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
        <div style={{ color: "var(--color-text-muted)", padding: "40px", textAlign: "center" }}>Loading plan…</div>
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
