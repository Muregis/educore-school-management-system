import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", fontSize: 13, width: "100%",
  boxSizing: "border-box",
};

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

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#facc15" : "#f87171";
  const bg    = score >= 80 ? "#052e16" : score >= 60 ? "#1c1400" : "#1c0505";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      background: bg, border: `2px solid ${color}`, borderRadius: 16,
      padding: "20px 28px", minWidth: 120 }}>
      <div style={{ fontSize: 38, fontWeight: 900, color, lineHeight: 1 }}>{score}%</div>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginTop: 4,
        textTransform: "uppercase", letterSpacing: "0.05em" }}>CBC Score</div>
    </div>
  );
}
ScoreRing.propTypes = { score: PropTypes.number };

// ── Plan list (admin view — all pending + others) ─────────────────────────────
function AdminPlanList({ auth, onOpen }) {
  const [plans, setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  const load = useCallback(() => {
    setLoading(true);
    const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    apiFetch(`/lesson-plans${qs}`, { token: auth?.token })
      .then(d => { setPlans(d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [auth, statusFilter]);

  useEffect(load, [load]);

  const pendingCount = plans.filter(p => p.status === "pending").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: C.text, fontSize: 20 }}>
            🔍 Pending Lesson Plans
          </h2>
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 3 }}>
            Review submissions, run AI compliance check, then approve or reject
          </div>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: "#1c1400", border: "1px solid #a16207",
            borderRadius: 20, padding: "6px 16px", fontSize: 13,
            fontWeight: 700, color: "#facc15" }}>
            {pendingCount} awaiting review
          </div>
        )}
      </div>

      {/* Status filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[["pending","⏳ Pending"],["approved","✅ Approved"],["rejected","❌ Rejected"],["all","All"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)} style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: "pointer",
            background: statusFilter === v ? C.accent : C.card,
            color: statusFilter === v ? "#fff" : C.textMuted,
            border: `1px solid ${statusFilter === v ? C.accent : C.border}`,
          }}>{l}</button>
        ))}
      </div>

      {loading && <div style={{ color: C.textMuted, padding: 32 }}>Loading…</div>}

      {!loading && plans.length === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 8 }}>
            No {statusFilter !== "all" ? statusFilter : ""} submissions
          </div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            Teachers will appear here once they submit lesson plans for approval.
          </div>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Type","Teacher","Subject","Class","Topic","AI Score","Status","Submitted"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px",
                    borderBottom: `1px solid ${C.border}`, color: C.textMuted,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.plan_id}
                  onClick={() => onOpen(p)}
                  style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                    transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.accentGlow}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700,
                      color: p.type === "scheme" ? "#6366f1" : C.accent,
                      background: p.type === "scheme" ? "#1e1b4b" : C.accentGlow,
                      borderRadius: 6, padding: "2px 8px" }}>
                      {p.type === "scheme" ? "Scheme" : "Lesson"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: C.text, fontWeight: 600, fontSize: 13 }}>
                    {p.teacher_name}
                  </td>
                  <td style={{ padding: "10px 14px", color: C.textSub }}>{p.subject}</td>
                  <td style={{ padding: "10px 14px", color: C.textSub }}>{p.class_name}</td>
                  <td style={{ padding: "10px 14px", color: C.text, maxWidth: 180,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.topic}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {p.ai_score != null ? (
                      <span style={{
                        fontWeight: 800, fontSize: 13,
                        color: p.ai_score >= 80 ? "#4ade80" : p.ai_score >= 60 ? "#facc15" : "#f87171",
                      }}>{p.ai_score}%</span>
                    ) : (
                      <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "10px 14px", color: C.textMuted, fontSize: 12 }}>
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
AdminPlanList.propTypes = { auth: PropTypes.object, onOpen: PropTypes.func };

// ── Plan review detail (admin) ─────────────────────────────────────────────────
function AdminPlanReview({ auth, planSummary, toast, onBack, onDecision }) {
  const [plan, setPlan]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis]   = useState(null);
  const [action, setAction]       = useState(null);  // "approve" | "reject"
  const [feedback, setFeedback]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load full plan
  useEffect(() => {
    setLoading(true);
    apiFetch(`/lesson-plans/${planSummary.plan_id}`, { token: auth?.token })
      .then(d => {
        setPlan(d);
        // Restore previous analysis if it exists
        if (d.ai_score != null) {
          setAnalysis({
            score: d.ai_score,
            missing_sections: tryParse(d.ai_missing, []),
            weak_areas: tryParse(d.ai_weak, []),
            recommendations: tryParse(d.ai_recommendations, []),
            feedback_for_teacher: d.ai_feedback_draft || "",
          });
          setFeedback(d.ai_feedback_draft || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [auth, planSummary.plan_id]);

  const tryParse = (val, fallback) => {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await apiFetch(`/lesson-plans/${plan.plan_id}/analyze`, {
        method: "POST", token: auth?.token, body: {},
      });
      setAnalysis(res.analysis);
      setFeedback(res.analysis.feedback_for_teacher || "");
      toast("AI analysis complete", "success");
    } catch (e) {
      toast(e.message || "Analysis failed", "error");
    }
    setAnalyzing(false);
  };

  const submitDecision = async () => {
    if (action === "reject" && !feedback.trim())
      return toast("Please provide feedback before rejecting", "error");
    setSubmitting(true);
    try {
      if (action === "approve") {
        await apiFetch(`/lesson-plans/${plan.plan_id}/approve`, {
          method: "POST", token: auth?.token, body: {},
        });
        toast("✅ Lesson plan approved", "success");
      } else {
        await apiFetch(`/lesson-plans/${plan.plan_id}/reject`, {
          method: "POST", token: auth?.token, body: { feedback },
        });
        toast("Lesson plan rejected — teacher notified", "success");
      }
      onDecision();
    } catch (e) {
      toast(e.message || "Failed", "error");
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ color: C.textMuted, padding: 40 }}>Loading plan…</div>
  );

  if (!plan) return (
    <div style={{ color: "#f87171", padding: 40 }}>Plan not found.</div>
  );

  const isPending  = plan.status === "pending";
  const scoreColor = analysis ? (
    analysis.score >= 80 ? "#4ade80" : analysis.score >= 60 ? "#facc15" : "#f87171"
  ) : C.textMuted;

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{ background: "transparent",
        border: `1px solid ${C.border}`, borderRadius: 8, color: C.textMuted,
        cursor: "pointer", padding: "6px 14px", fontSize: 13, marginBottom: 20 }}>
        ← Back to list
      </button>

      {/* Plan header */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: C.text, fontSize: 20 }}>
            {plan.type === "scheme" ? "📅 Scheme of Work" : "📝 Lesson Plan"}
          </h2>
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
            {plan.subject} · {plan.class_name} · {plan.term}
            {plan.week ? ` · Week ${plan.week}` : ""} · {plan.duration}
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
            Submitted by <strong style={{ color: C.text }}>{plan.teacher_name}</strong>
            {" · "}{new Date(plan.updated_at).toLocaleString()}
          </div>
        </div>
        <Badge status={plan.status} />
      </div>

      {/* ── AI Analysis Panel ─────────────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 24, marginBottom: 20 }}>

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: analysis ? 20 : 0 }}>
          <div>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>
              🤖 AI CBC Compliance Analyzer
            </div>
            <div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
              Checks against KICD Competency-Based Curriculum framework
            </div>
          </div>
          <button onClick={runAnalysis} disabled={analyzing} style={{
            background: analyzing ? C.card : `linear-gradient(135deg, ${C.accent}, #6366f1)`,
            color: analyzing ? C.textMuted : "#fff",
            border: `1px solid ${analyzing ? C.border : C.accent}`,
            borderRadius: 9, padding: "9px 22px", fontWeight: 800, fontSize: 13,
            cursor: analyzing ? "not-allowed" : "pointer",
          }}>
            {analyzing ? "⏳ Analyzing…" : analysis ? "↺ Re-analyze" : "🔍 Analyze with AI"}
          </button>
        </div>

        {analysis && (
          <>
            {/* Score + breakdown row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <ScoreRing score={analysis.score} />

              <div style={{ flex: 1, minWidth: 280 }}>
                {/* Missing sections */}
                {analysis.missing_sections?.length > 0 && (
                  <div style={{ background: "#1c0505", border: "1px solid #991b1b",
                    borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
                    <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
                      ❌ Missing Sections
                    </div>
                    {analysis.missing_sections.map((s, i) => (
                      <div key={i} style={{ color: "#fca5a5", fontSize: 12, marginBottom: 3 }}>
                        • {s}
                      </div>
                    ))}
                  </div>
                )}

                {/* Weak areas */}
                {analysis.weak_areas?.length > 0 && (
                  <div style={{ background: "#1c1400", border: "1px solid #a16207",
                    borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
                    <div style={{ color: "#facc15", fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
                      ⚠️ Weak Areas
                    </div>
                    {analysis.weak_areas.map((s, i) => (
                      <div key={i} style={{ color: "#fde68a", fontSize: 12, marginBottom: 3 }}>
                        • {s}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations?.length > 0 && (
                  <div style={{ background: "#052e16", border: "1px solid #166534",
                    borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: 6, fontSize: 13 }}>
                      💡 Recommendations
                    </div>
                    {analysis.recommendations.map((s, i) => (
                      <div key={i} style={{ color: "#86efac", fontSize: 12, marginBottom: 3 }}>
                        • {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Lesson plan content ───────────────────────────────────────────── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, color: C.text, marginBottom: 14, fontSize: 14 }}>
          📄 Lesson Plan Content
        </div>
        <pre style={{ color: C.text, fontSize: 12, lineHeight: 1.9,
          whiteSpace: "pre-wrap", fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0 }}>
          {plan.content}
        </pre>
      </div>

      {/* ── Admin decision panel (only for pending plans) ─────────────────── */}
      {isPending && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 24 }}>
          <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 16 }}>
            📋 Admin Decision
          </div>

          {/* Action selector */}
          {!action && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <button onClick={() => setAction("approve")} style={{
                flex: 1, padding: "14px", borderRadius: 10, fontWeight: 800,
                fontSize: 14, cursor: "pointer",
                background: "#052e16", border: "2px solid #166534", color: "#4ade80",
              }}>
                ✅ Approve Lesson Plan
              </button>
              <button onClick={() => { setAction("reject"); if (!feedback && analysis?.feedback_for_teacher) setFeedback(analysis.feedback_for_teacher); }} style={{
                flex: 1, padding: "14px", borderRadius: 10, fontWeight: 800,
                fontSize: 14, cursor: "pointer",
                background: "#1c0505", border: "2px solid #991b1b", color: "#f87171",
              }}>
                ❌ Reject & Send Feedback
              </button>
            </div>
          )}

          {/* Approve confirmation */}
          {action === "approve" && (
            <div>
              <div style={{ background: "#052e16", border: "1px solid #166534",
                borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: 4 }}>
                  Ready to approve this lesson plan?
                </div>
                {analysis && (
                  <div style={{ color: "#86efac", fontSize: 13 }}>
                    AI Compliance Score: <strong>{analysis.score}%</strong>
                    {analysis.score < 70 && " — consider requesting revisions first"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setAction(null)} style={{
                  background: C.card, border: `1px solid ${C.border}`, color: C.textSub,
                  borderRadius: 8, padding: "9px 20px", fontWeight: 700,
                  fontSize: 13, cursor: "pointer",
                }}>Cancel</button>
                <button onClick={submitDecision} disabled={submitting} style={{
                  background: "#16a34a", color: "#fff", border: "none",
                  borderRadius: 8, padding: "9px 28px", fontWeight: 800,
                  fontSize: 13, cursor: "pointer", opacity: submitting ? 0.7 : 1,
                }}>{submitting ? "Approving…" : "✅ Confirm Approval"}</button>
              </div>
            </div>
          )}

          {/* Reject with feedback */}
          {action === "reject" && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700,
                  color: C.textMuted, marginBottom: 6, textTransform: "uppercase",
                  letterSpacing: "0.06em" }}>
                  Feedback to Teacher *
                  {analysis?.feedback_for_teacher && (
                    <span style={{ color: C.accent, fontWeight: 600, marginLeft: 8,
                      textTransform: "none" }}>
                      (AI-suggested — edit as needed)
                    </span>
                  )}
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Explain what the teacher needs to improve before resubmitting…"
                  style={{ ...inp, height: 120, resize: "vertical", fontSize: 13, lineHeight: 1.7 }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setAction(null)} style={{
                  background: C.card, border: `1px solid ${C.border}`, color: C.textSub,
                  borderRadius: 8, padding: "9px 20px", fontWeight: 700,
                  fontSize: 13, cursor: "pointer",
                }}>Cancel</button>
                <button onClick={submitDecision} disabled={submitting || !feedback.trim()} style={{
                  background: "#dc2626", color: "#fff", border: "none",
                  borderRadius: 8, padding: "9px 28px", fontWeight: 800,
                  fontSize: 13, cursor: "pointer",
                  opacity: (submitting || !feedback.trim()) ? 0.6 : 1,
                }}>{submitting ? "Sending…" : "❌ Reject & Notify Teacher"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviewed plans — show outcome */}
      {!isPending && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 20 }}>
          {plan.status === "approved" ? (
            <div style={{ color: "#4ade80" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Approved</div>
              <div style={{ fontSize: 13 }}>
                By {plan.reviewer_name} · {plan.reviewed_at ? new Date(plan.reviewed_at).toLocaleString() : ""}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 6 }}>
                ❌ Rejected
              </div>
              <div style={{ color: "#fca5a5", fontSize: 13 }}>{plan.admin_feedback}</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>
                By {plan.reviewer_name} · {plan.reviewed_at ? new Date(plan.reviewed_at).toLocaleString() : ""}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
AdminPlanReview.propTypes = {
  auth: PropTypes.object, planSummary: PropTypes.object,
  toast: PropTypes.func, onBack: PropTypes.func, onDecision: PropTypes.func,
};

// ── Main PendingPlansPage ─────────────────────────────────────────────────────
export default function PendingPlansPage({ auth, toast }) {
  const [view, setView]         = useState("list");
  const [selected, setSelected] = useState(null);

  const openPlan   = (p) => { setSelected(p); setView("review"); };
  const goBack     = ()  => { setSelected(null); setView("list"); };
  const onDecision = ()  => { setSelected(null); setView("list"); };

  return (
    <div>
      {view === "list" && (
        <AdminPlanList auth={auth} onOpen={openPlan} />
      )}
      {view === "review" && selected && (
        <AdminPlanReview
          auth={auth}
          planSummary={selected}
          toast={toast}
          onBack={goBack}
          onDecision={onDecision}
        />
      )}
    </div>
  );
}
PendingPlansPage.propTypes = { auth: PropTypes.object, toast: PropTypes.func };
