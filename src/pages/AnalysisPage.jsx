import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";

// ─── Shared helpers ────────────────────────────────────────────────────────
const inputStyle = {
  background: C.card, color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "6px 10px", fontSize: 13,
};

const gradeInfo = (score) => {
  if (score >= 80) return { label: "EE", color: "#4ade80", bg: "#052e16", text: "Exceeds Expectations" };
  if (score >= 60) return { label: "ME", color: "#60a5fa", bg: "#0c1a2e", text: "Meets Expectations" };
  if (score >= 40) return { label: "AE", color: "#facc15", bg: "#1c1400", text: "Approaching Expectations" };
  return              { label: "BE", color: "#f87171", bg: "#1c0505", text: "Below Expectations" };
};

const ScoreBar = ({ score, color }) => (
  <div style={{ flex:1, background: C.border, borderRadius:6, height:8, overflow:"hidden" }}>
    <div style={{
      width: `${Math.min(score, 100)}%`,
      background: color || (score >= 70 ? "#4ade80" : score >= 50 ? "#facc15" : "#f87171"),
      height: "100%", borderRadius:6, transition: "width 0.5s ease",
    }} />
  </div>
);

const StatCard = ({ label, value, tone = "default" }) => {
  const colors = { success:"#4ade80", warning:"#facc15", danger:"#f87171", info:"#60a5fa", default:C.accent };
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", minWidth:160 }}>
      <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:colors[tone] }}>{value}</div>
    </div>
  );
};

// ─── Intervention generator ────────────────────────────────────────────────
function buildInterventions(subjectRankings, streamAverages) {
  const out = [];
  const byScore = [...subjectRankings].sort((a,b) => a.avg_score - b.avg_score);
  const weak    = byScore.slice(0, Math.min(3, byScore.length));
  const strong  = [...subjectRankings].sort((a,b) => b.avg_score - a.avg_score).slice(0, 2);

  weak.forEach(s => {
    if (s.avg_score < 50) {
      out.push({ urgency:"high", subject:s.subject,
        finding:`${s.subject} critically low at ${s.avg_score}%`,
        action:"Immediate remedial classes needed. Run diagnostic tests to identify gaps. Increase lesson hours and assign targeted practice materials." });
    } else if (s.avg_score < 65) {
      out.push({ urgency:"medium", subject:s.subject,
        finding:`${s.subject} at ${s.avg_score}% — needs attention`,
        action:"Schedule weekly revision sessions. Review the teaching pace. Implement peer-tutoring pairing strong and weak students." });
    }
  });

  strong.forEach(s => {
    if (s.avg_score >= 75) {
      out.push({ urgency:"maintain", subject:s.subject,
        finding:`${s.subject} performing well at ${s.avg_score}%`,
        action:"Maintain current approach. Document strategies and share with other subject teachers. Add enrichment activities for top students." });
    }
  });

  if (streamAverages.length >= 2) {
    const sorted = [...streamAverages].sort((a,b) => b.avg_score - a.avg_score);
    const best = sorted[0]; const worst = sorted[sorted.length-1];
    const gap  = +(best.avg_score - worst.avg_score).toFixed(1);
    if (gap >= 15) {
      out.push({ urgency:"high", subject:"Stream Gap",
        finding:`${gap}% gap between ${best.stream_label} (${best.avg_score}%) and ${worst.stream_label} (${worst.avg_score}%)`,
        action:`Study what makes ${best.stream_label} succeed and apply in ${worst.stream_label}. Equalise teacher quality, introduce cross-stream mentoring and monthly progress tracking.` });
    } else if (gap >= 8) {
      out.push({ urgency:"medium", subject:"Stream Gap",
        finding:`${gap}% gap between best and weakest stream`,
        action:"Monitor monthly. Conduct teacher peer-observations across streams. Ensure equal distribution of resources and teaching time." });
    }
  }

  const lowestStream = [...streamAverages].sort((a,b) => a.avg_score - b.avg_score)[0];
  if (lowestStream && lowestStream.avg_score < 60) {
    out.push({ urgency:"high", subject:`${lowestStream.stream_label} Overall`,
      finding:`${lowestStream.stream_label} overall average of ${lowestStream.avg_score}% is below passing threshold`,
      action:"Hold an urgent stream review with all subject teachers. Engage parents in a performance meeting. Run a structured 8-week catch-up programme with bi-weekly tracking." });
  }

  return out;
}

// ─── Analysis Tab ──────────────────────────────────────────────────────────
export default function AnalysisPage({ auth }) {
  return <AnalysisPageInner auth={auth} />;
}

function AnalysisPageInner({ auth }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [aiReport, setAiReport]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState("");
  const [term, setTerm]           = useState("Term 2");
  const [className, setClassName] = useState("");
  const [availTerms, setAvailTerms]     = useState(["Term 1","Term 2","Term 3"]);
  const [availClasses, setAvailClasses] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [reportMode, setReportMode]     = useState("visual"); // "visual" | "ai"
  const [trends, setTrends]             = useState(null);
  const [topStudents, setTopStudents]   = useState(null);
  const [topClass, setTopClass]         = useState("");

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    setAiReport(""); setAiError("");
    try {
      const qs = new URLSearchParams({ term });
      if (className) qs.set("class_name", className);
      const result = await apiFetch(`/analysis/streams?${qs}`, { token: auth.token });
      setData(result);
      if (result.terms?.length)   setAvailTerms(result.terms);
      if (result.classes?.length) setAvailClasses(result.classes);
      setActiveStream(null);

      // Fetch trends + top students in parallel
      const [trendRes, topRes] = await Promise.all([
        apiFetch(`/analysis/trends${className ? `?class_name=${encodeURIComponent(className)}` : ""}`, { token: auth.token }),
        apiFetch(`/analysis/top-students?limit=10${term ? `&term=${encodeURIComponent(term)}` : ""}${className ? `&class_name=${encodeURIComponent(className)}` : ""}`, { token: auth.token }),
      ]);
      setTrends(trendRes);
      setTopStudents(topRes);
    } catch (e) { console.error("Analysis error:", e); }
    setLoading(false);
  }, [auth, term, className]);

  useEffect(() => { load(); }, [load]);

  // Build a compact dataset string to send to Claude
  const buildDataset = () => {
    if (!data) return "";
    const lines = [];
    lines.push(`Term: ${data.meta.term}${data.meta.class_name ? " | Class: "+data.meta.class_name : " | All Classes"}`);
    lines.push("");
    lines.push("STREAM AVERAGES:");
    data.streamAverages.forEach(s =>
      lines.push(`  ${s.stream_label}: ${s.avg_score}% (${s.student_count} students)`)
    );
    lines.push("");
    lines.push("SUBJECT RANKINGS (highest to lowest):");
    data.subjectRankings.forEach((s, i) =>
      lines.push(`  ${i+1}. ${s.subject}: avg ${s.avg_score}% | highest ${s.highest}% | lowest ${s.lowest}% | entries ${s.entries}`)
    );
    lines.push("");
    lines.push("STREAM vs SUBJECT MATRIX:");
    data.streamVsSubject.subjects.forEach(subj => {
      const row = data.streamVsSubject.streams.map(sl => {
        const score = data.streamVsSubject.data[sl]?.[subj];
        return score != null ? `${sl}:${score}%` : `${sl}:N/A`;
      }).join(" | ");
      lines.push(`  ${subj}: ${row}`);
    });
    // Term trends
    if (trends && trends.terms.length > 1) {
      lines.push("");
      lines.push("TERM PERFORMANCE TRENDS (overall avg per term):");
      trends.overall.forEach(t => lines.push(`  ${t.term}: ${t.avg_score}%`));
      lines.push("SUBJECT TRENDS:");
      trends.subjects.forEach(subj => {
        const row = trends.terms.map(t => `${t}:${trends.data[subj]?.[t] ?? "N/A"}%`).join(" → ");
        lines.push(`  ${subj}: ${row}`);
      });
    }
    // Top students
    if (topStudents && topStudents.overall.length > 0) {
      lines.push("");
      lines.push("TOP 5 STUDENTS (overall):");
      topStudents.overall.slice(0,5).forEach((s,i) =>
        lines.push(`  ${i+1}. ${s.first_name} ${s.last_name} (${s.stream_label}): ${s.avg_score}%`)
      );
    }
    return lines.join("\n");
  };

  const generateAIReport = async () => {
    console.log("[AI] data:", data, "token:", auth?.token ? "present" : "MISSING");
    if (!data || data.streamAverages.length === 0) {
      setAiError("No data loaded yet. Please wait for the visual report to load first.");
      return;
    }
    setAiLoading(true);
    setAiReport(""); setAiError("");
    const dataset = buildDataset();
    console.log("[AI] dataset length:", dataset.length, "first 200:", dataset.slice(0,200));

    const prompt = `You are an academic performance analyst for a Kenyan primary/secondary school.

Analyze the following exam results dataset and generate a structured performance report.

Dataset:
${dataset}

Generate a report with exactly these 7 sections using markdown headers (##):

## 1. Executive Summary
A short 3-4 sentence overview for the school principal. Mention the overall performance level, standout streams, and biggest concern.

## 2. Class Performance by Stream
For each stream, state its average, grade level (EE=80%+, ME=60-79%, AE=40-59%, BE=below 40%), and how it compares to other streams in the same class.

## 3. Subject Performance Ranking
Rank all subjects from strongest to weakest. For each, note the average, whether it is a strength or weakness, and why it matters.

## 4. Stream Comparison
Compare streams within each class. Identify the top stream and the weakest stream. Note the performance gap and what it suggests.

## 5. Key Observations
List 4-6 specific, data-driven observations. Be precise — use the actual percentages from the data.

## 6. Students or Groups at Risk
Identify which streams or subject combinations put students at risk academically. Be specific about thresholds (e.g. streams below 60% average, subjects below 50%).

## 7. Recommendations for Improvement
Give 5-7 concrete, practical recommendations. Each should be actionable by a teacher or head of department — e.g. "Schedule weekly remedial classes for Science in Grade 7C which scored 50%." Avoid generic advice.

Keep the tone professional but simple enough for a school administrator to act on immediately.`;

    try {
      const result = await apiFetch("/analysis/ai-report", {
        method: "POST",
        token: auth?.token,
        body: { prompt },
      });
      if (result.text) {
        setAiReport(result.text);
      } else {
        setAiError("No response from AI. Try again.");
      }
    } catch (e) {
      setAiError("Failed to generate report: " + e.message);
    }
    setAiLoading(false);
  };

  // ── Render markdown-ish report (simple parser — no dependency needed)
  const renderReport = (text) => {
    const lines = text.split("\n");
    const elements = [];
    let key = 0;

    lines.forEach(line => {
      if (line.startsWith("## ")) {
        elements.push(
          <div key={key++} style={{ marginTop:24, marginBottom:8, paddingBottom:6,
            borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:16, fontWeight:800, color:C.accent }}>{line.replace("## ","")}</span>
          </div>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <div key={key++} style={{ display:"flex", gap:8, marginBottom:6, paddingLeft:8 }}>
            <span style={{ color:C.accent, flexShrink:0 }}>•</span>
            <span style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>{line.slice(2)}</span>
          </div>
        );
      } else if (line.match(/^\d+\. /)) {
        const num = line.match(/^(\d+)\.\s/)[1];
        elements.push(
          <div key={key++} style={{ display:"flex", gap:10, marginBottom:6, paddingLeft:8 }}>
            <span style={{ color:C.accent, fontWeight:700, flexShrink:0, minWidth:20 }}>{num}.</span>
            <span style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>{line.replace(/^\d+\.\s/,"")}</span>
          </div>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={key++} style={{ height:6 }} />);
      } else {
        elements.push(
          <p key={key++} style={{ fontSize:13, color:C.textSub, margin:"4px 0", lineHeight:1.7 }}>{line}</p>
        );
      }
    });
    return elements;
  };

  const th = { textAlign:"left", padding:"8px 10px", borderBottom:`1px solid ${C.border}`, color:C.textMuted, fontSize:12 };
  const td = (extra={}) => ({ padding:"8px 10px", color:C.text, ...extra });
  const streamSorted = data ? [...data.streamAverages].sort((a,b) => b.avg_score - a.avg_score) : [];
  const byClass = {};
  streamSorted.forEach(s => {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  });
  const urgencyColor = { high:"#f87171", medium:"#facc15", maintain:"#4ade80" };
  const urgencyBg    = { high:"#1c0505", medium:"#1c1400", maintain:"#052e16" };
  const urgencyLabel = { high:"🔴 High Priority", medium:"🟡 Medium Priority", maintain:"🟢 Maintain" };
  const interventions = data ? buildInterventions(data.subjectRankings, data.streamAverages) : [];

  if (!loading && data && data.streamAverages.length === 0) return (
    <div style={{ textAlign:"center", padding:60, color:C.textMuted }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
      <div style={{ fontWeight:700, color:C.text, marginBottom:8 }}>No results data yet</div>
      <div style={{ fontSize:13 }}>Enter results in the Grades page to see stream analysis.</div>
    </div>
  );

  return (
    <div>
      {/* ── Filters + mode toggle ── */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"flex-end",
        justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>Term</div>
            <select style={inputStyle} value={term} onChange={e => setTerm(e.target.value)}>
              {availTerms.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>Class (optional)</div>
            <select style={inputStyle} value={className} onChange={e => setClassName(e.target.value)}>
              <option value="">All Classes</option>
              {availClasses.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={load} style={{ background:C.accent, color:"#fff", border:"none",
            borderRadius:8, padding:"7px 18px", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            Refresh
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", gap:6 }}>
          {[["visual","📊 Visual Report"],["ai","🤖 AI Report"]].map(([mode, label]) => (
            <button key={mode} onClick={() => setReportMode(mode)} style={{
              padding:"7px 14px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
              background: reportMode === mode ? C.accent : C.card,
              color: reportMode === mode ? "#fff" : C.textMuted,
              border: `1px solid ${reportMode === mode ? C.accent : C.border}`,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color:C.textMuted, padding:32 }}>Loading data…</div>}

      {/* ══════════ AI REPORT MODE ══════════ */}
      {!loading && data && reportMode === "ai" && (
        <div>
          {/* Generate button */}
          {!aiReport && !aiLoading && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16,
              padding:40, textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🤖</div>
              <div style={{ fontWeight:700, color:C.text, fontSize:16, marginBottom:8 }}>
                AI Performance Report
              </div>
              <div style={{ color:C.textMuted, fontSize:13, marginBottom:20, maxWidth:480, margin:"0 auto 20px" }}>
                Claude AI will analyse your stream data and generate a full 7-section academic performance
                report with ranked subjects, stream comparisons, risk groups, and practical recommendations.
              </div>
              <button onClick={generateAIReport} style={{
                background:`linear-gradient(135deg, ${C.accent}, #6366f1)`,
                color:"#fff", border:"none", borderRadius:10,
                padding:"12px 32px", fontWeight:800, fontSize:15, cursor:"pointer",
              }}>
                Generate AI Report
              </button>
              {aiError && (
                <div style={{ marginTop:16, color:"#f87171", fontSize:13 }}>{aiError}</div>
              )}
            </div>
          )}

          {/* Loading */}
          {aiLoading && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16,
              padding:60, textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:12, animation:"spin 1s linear infinite" }}>⚙️</div>
              <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>Generating Report…</div>
              <div style={{ color:C.textMuted, fontSize:13 }}>Claude is analysing your school data</div>
            </div>
          )}

          {/* Report output */}
          {aiReport && !aiLoading && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontWeight:700, color:C.text, fontSize:15 }}>
                  AI Academic Performance Report — {data.meta.term}{data.meta.class_name ? " · "+data.meta.class_name : ""}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={generateAIReport} style={{
                    background:C.card, border:`1px solid ${C.border}`, color:C.textSub,
                    borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:600,
                  }}>↺ Regenerate</button>
                  <button onClick={() => {
                    const el = document.createElement("a");
                    el.href = "data:text/plain;charset=utf-8," + encodeURIComponent(aiReport);
                    el.download = `performance-report-${data.meta.term.replace(" ","-")}.txt`;
                    el.click();
                  }} style={{
                    background:C.accent, border:"none", color:"#fff",
                    borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", fontWeight:700,
                  }}>⬇ Download</button>
                </div>
              </div>
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:28 }}>
                {renderReport(aiReport)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ VISUAL REPORT MODE ══════════ */}
      {!loading && data && reportMode === "visual" && (<>

        {/* SECTION 1 — Class Performance by Stream */}
        <div style={{ marginBottom:32 }}>
          <h3 style={{ color:C.text, marginBottom:4 }}>1. Class Performance by Stream</h3>
          <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
            Average score per stream. Click a stream card to see subject breakdown.
          </p>
          {Object.entries(byClass).map(([cls, streams]) => (
            <div key={cls} style={{ marginBottom:24 }}>
              <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:10,
                borderLeft:`3px solid ${C.accent}`, paddingLeft:10 }}>{cls}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                {streams.map(s => {
                  const g = gradeInfo(s.avg_score);
                  const isActive = activeStream === s.stream_label;
                  return (
                    <div key={s.stream_label}
                      onClick={() => setActiveStream(isActive ? null : s.stream_label)}
                      style={{ background: isActive ? g.bg : C.card,
                        border:`2px solid ${isActive ? g.color : C.border}`,
                        borderRadius:12, padding:"14px 20px", cursor:"pointer",
                        minWidth:180, transition:"all 0.15s",
                        boxShadow: isActive ? `0 0 0 2px ${g.color}33` : "none",
                      }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ fontWeight:700, color:C.text, fontSize:15 }}>Stream {s.stream}</div>
                        <div style={{ background:g.bg, border:`1px solid ${g.color}`, borderRadius:20,
                          padding:"2px 10px", fontSize:11, fontWeight:800, color:g.color }}>{g.label}</div>
                      </div>
                      <div style={{ fontSize:28, fontWeight:900, color:g.color, marginBottom:4 }}>{s.avg_score}%</div>
                      <ScoreBar score={s.avg_score} color={g.color} />
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>
                        {s.student_count} students · {g.text}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Stream drilldown */}
              {activeStream && streams.some(s => s.stream_label === activeStream) && (() => {
                const sd = data.streamVsSubject.data[activeStream];
                const subjects = sd ? data.streamVsSubject.subjects
                  .map(s => ({ subject:s, avg_score: sd[s] ?? null }))
                  .filter(x => x.avg_score !== null)
                  .sort((a,b) => b.avg_score - a.avg_score) : [];
                return subjects.length > 0 ? (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`,
                    borderRadius:12, padding:20, marginTop:12 }}>
                    <div style={{ fontWeight:700, color:C.text, marginBottom:12, fontSize:14 }}>
                      {activeStream} — Subject Breakdown
                    </div>
                    {subjects.map(sub => {
                      const g = gradeInfo(sub.avg_score);
                      return (
                        <div key={sub.subject} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                          <div style={{ width:140, fontSize:13, color:C.textSub }}>{sub.subject}</div>
                          <ScoreBar score={sub.avg_score} color={g.color} />
                          <div style={{ width:44, fontWeight:700, color:g.color, fontSize:13, textAlign:"right" }}>{sub.avg_score}%</div>
                          <div style={{ background:g.bg, border:`1px solid ${g.color}`, borderRadius:20,
                            padding:"1px 8px", fontSize:10, fontWeight:800, color:g.color, minWidth:28, textAlign:"center" }}>{g.label}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}
            </div>
          ))}
        </div>

        {/* SECTION 2 — Subject Ranking */}
        <div style={{ marginBottom:32 }}>
          <h3 style={{ color:C.text, marginBottom:4 }}>2. Subject Performance Ranking</h3>
          <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
            Subjects ranked highest to lowest. Identifies strong and weak curriculum areas.
          </p>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>{["Rank","Subject","Average","Highest","Lowest","Entries","Grade"].map(h =>
                  <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.subjectRankings.map((s, i) => {
                  const g = gradeInfo(s.avg_score);
                  return (
                    <tr key={s.subject} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={td({ color:C.textMuted, fontWeight:700 })}>#{i+1}</td>
                      <td style={td({ fontWeight:600 })}>{s.subject}</td>
                      <td style={{ padding:"8px 10px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <ScoreBar score={s.avg_score} color={g.color} />
                          <span style={{ fontWeight:800, color:g.color, fontSize:14, minWidth:42 }}>{s.avg_score}%</span>
                        </div>
                      </td>
                      <td style={td({ color:"#4ade80" })}>{s.highest}%</td>
                      <td style={td({ color:"#f87171" })}>{s.lowest}%</td>
                      <td style={td({ color:C.textMuted })}>{s.entries}</td>
                      <td style={{ padding:"8px 10px" }}>
                        <span style={{ background:g.bg, border:`1px solid ${g.color}`, borderRadius:20,
                          padding:"2px 10px", fontSize:11, fontWeight:800, color:g.color }}>{g.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3 — Stream vs Subject */}
        {data.streamVsSubject.subjects.length > 0 && (
          <div style={{ marginBottom:32 }}>
            <h3 style={{ color:C.text, marginBottom:4 }}>3. Stream vs Subject Comparison</h3>
            <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
              How each stream performs per subject — highlights which stream needs targeted help.
            </p>
            <div style={{ overflowX:"auto" }}>
              <table style={{ borderCollapse:"collapse", minWidth:600, width:"100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, minWidth:130 }}>Subject</th>
                    {data.streamVsSubject.streams.map(sl =>
                      <th key={sl} style={{ ...th, textAlign:"center", minWidth:80 }}>{sl}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.streamVsSubject.subjects.map(subj => (
                    <tr key={subj} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:"8px 10px", color:C.text, fontWeight:600 }}>{subj}</td>
                      {data.streamVsSubject.streams.map(sl => {
                        const score = data.streamVsSubject.data[sl]?.[subj];
                        if (score == null) return <td key={sl} style={{ padding:"8px 10px", textAlign:"center", color:C.textMuted }}>—</td>;
                        const g = gradeInfo(score);
                        return (
                          <td key={sl} style={{ padding:"8px 10px", textAlign:"center" }}>
                            <span style={{ background:g.bg, border:`1px solid ${g.color}44`,
                              borderRadius:8, padding:"3px 8px", fontSize:12, fontWeight:800, color:g.color }}>
                              {score}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 4 — Way Forward */}
        <div style={{ marginBottom:32 }}>
          <h3 style={{ color:C.text, marginBottom:4 }}>4. Proposed Way Forward</h3>
          <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
            Data-driven interventions based on current performance. Switch to 🤖 AI Report for a full narrative analysis.
          </p>
          {interventions.length === 0 ? (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12,
              padding:20, color:C.textMuted, textAlign:"center" }}>
              Add more results to generate recommendations.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {interventions.map((iv, i) => (
                <div key={i} style={{ background:urgencyBg[iv.urgency],
                  border:`1px solid ${urgencyColor[iv.urgency]}44`,
                  borderLeft:`4px solid ${urgencyColor[iv.urgency]}`,
                  borderRadius:12, padding:"16px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>{iv.subject}</div>
                    <span style={{ background:`${urgencyColor[iv.urgency]}22`,
                      border:`1px solid ${urgencyColor[iv.urgency]}44`, borderRadius:20,
                      padding:"2px 10px", fontSize:11, fontWeight:700,
                      color:urgencyColor[iv.urgency], whiteSpace:"nowrap" }}>
                      {urgencyLabel[iv.urgency]}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:C.textSub, marginBottom:8 }}>
                    <strong>Finding:</strong> {iv.finding}
                  </div>
                  <div style={{ fontSize:13, color:C.text }}>
                    <strong style={{ color:urgencyColor[iv.urgency] }}>Action:</strong> {iv.action}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:20, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
            <div style={{ fontWeight:700, color:C.text, marginBottom:12 }}>📋 Standard Recommendations</div>
            {[
              ["📚 Remedial Classes", "Identify students scoring below 50% and enrol them in targeted after-school remedial programmes grouped by subject weakness."],
              ["🔄 Teaching Methodology Review", "Compare approaches of high-performing and low-performing streams. Share effective techniques school-wide through peer observations."],
              ["📈 Monthly Performance Tracking", "Set up monthly mini-tests and track progress. Share results with teachers, parents and administration each month."],
              ["👨‍👩‍👧 Parent Engagement", "Hold a termly meeting with parents of struggling students. Share specific targets and actions parents can support at home."],
              ["🏆 Celebrate Strengths", "Publicly recognise top-performing streams and subjects each term to build a culture of academic excellence."],
            ].map(([title, desc]) => (
              <div key={title} style={{ display:"flex", gap:12, marginBottom:12, alignItems:"flex-start" }}>
                <div style={{ fontWeight:700, color:C.accent, whiteSpace:"nowrap", minWidth:230, fontSize:13 }}>{title}</div>
                <div style={{ fontSize:13, color:C.textSub }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5 — Term Performance Trends */}
        {trends && trends.terms.length > 1 && (
          <div style={{ marginBottom:32 }}>
            <h3 style={{ color:C.text, marginBottom:4 }}>5. Term Performance Trends</h3>
            <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
              How overall and subject performance has changed across terms.
            </p>
            {/* Overall trend bar */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:16 }}>
              <div style={{ fontWeight:700, color:C.text, marginBottom:14, fontSize:14 }}>📈 Overall Average by Term</div>
              <div style={{ display:"flex", gap:12, alignItems:"flex-end", height:120 }}>
                {trends.overall.map((t, i) => {
                  const g = gradeInfo(t.avg_score);
                  const h = Math.max(20, (t.avg_score / 100) * 100);
                  return (
                    <div key={t.term} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:g.color }}>{t.avg_score}%</div>
                      <div style={{ width:"100%", height:h, background:g.color, borderRadius:"6px 6px 0 0",
                        opacity: 0.8 + i * 0.1, transition:"height 0.3s",
                        boxShadow:`0 0 12px ${g.color}44` }} />
                      <div style={{ fontSize:11, color:C.textMuted, textAlign:"center" }}>{t.term}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Subject trend table */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left", padding:"10px 14px", color:C.textMuted, fontSize:12, borderBottom:`1px solid ${C.border}` }}>Subject</th>
                    {trends.terms.map(t => (
                      <th key={t} style={{ textAlign:"center", padding:"10px 14px", color:C.textMuted, fontSize:12, borderBottom:`1px solid ${C.border}` }}>{t}</th>
                    ))}
                    <th style={{ textAlign:"center", padding:"10px 14px", color:C.textMuted, fontSize:12, borderBottom:`1px solid ${C.border}` }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.subjects.map(subj => {
                    const scores = trends.terms.map(t => trends.data[subj]?.[t] ?? null);
                    const valid  = scores.filter(s => s !== null);
                    const first  = valid[0] ?? 0;
                    const last   = valid[valid.length - 1] ?? 0;
                    const diff   = last - first;
                    const trendIcon = diff > 2 ? "📈" : diff < -2 ? "📉" : "➡️";
                    const trendColor = diff > 2 ? "#4ade80" : diff < -2 ? "#f87171" : C.textMuted;
                    return (
                      <tr key={subj} style={{ borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:"9px 14px", fontWeight:600, color:C.text, fontSize:13 }}>{subj}</td>
                        {trends.terms.map(t => {
                          const sc = trends.data[subj]?.[t];
                          if (sc == null) return <td key={t} style={{ padding:"9px 14px", textAlign:"center", color:C.textMuted }}>—</td>;
                          const g = gradeInfo(sc);
                          return (
                            <td key={t} style={{ padding:"9px 14px", textAlign:"center" }}>
                              <span style={{ background:g.bg, border:`1px solid ${g.color}44`, borderRadius:7,
                                padding:"2px 8px", fontSize:12, fontWeight:700, color:g.color }}>{sc}%</span>
                            </td>
                          );
                        })}
                        <td style={{ padding:"9px 14px", textAlign:"center", fontSize:14 }}>
                          <span style={{ color:trendColor, fontWeight:700 }}>
                            {trendIcon} {diff > 0 ? "+" : ""}{diff !== 0 ? diff.toFixed(1)+"%" : "Stable"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 6 — Top Students */}
        {topStudents && topStudents.overall.length > 0 && (
          <div style={{ marginBottom:32 }}>
            <h3 style={{ color:C.text, marginBottom:4 }}>6. Top Performing Students</h3>
            <p style={{ color:C.textMuted, fontSize:13, marginBottom:16 }}>
              Highest average scores across all subjects for the selected term.
            </p>

            {/* Class filter for top students */}
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {["", ...[...new Set(topStudents.byClass.map(s => s.class_name))]].map(cls => (
                <button key={cls} onClick={() => setTopClass(cls)} style={{
                  padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  background: topClass === cls ? C.accent : C.card,
                  color: topClass === cls ? "#fff" : C.textMuted,
                  border: `1px solid ${topClass === cls ? C.accent : C.border}`,
                }}>{cls || "🏆 Overall Top 10"}</button>
              ))}
            </div>

            {/* Leaderboard */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              {(topClass
                ? topStudents.byClass.filter(s => s.class_name === topClass)
                : topStudents.overall
              ).map((s, i) => {
                const g = gradeInfo(s.avg_score);
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div key={s.student_id} style={{
                    display:"flex", alignItems:"center", gap:14, padding:"12px 18px",
                    borderBottom:`1px solid ${C.border}`,
                    background: i < 3 ? `${g.color}08` : "transparent",
                  }}>
                    {/* Rank */}
                    <div style={{ width:36, textAlign:"center", flexShrink:0 }}>
                      {medal
                        ? <span style={{ fontSize:20 }}>{medal}</span>
                        : <span style={{ fontWeight:800, color:C.textMuted, fontSize:14 }}>#{s.rank ?? i+1}</span>
                      }
                    </div>
                    {/* Avatar */}
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      background: g.bg, border:`1px solid ${g.color}44`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:800, fontSize:14, color:g.color,
                    }}>
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </div>
                    {/* Name */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>
                        {s.first_name} {s.last_name}
                      </div>
                      <div style={{ fontSize:11, color:C.textMuted }}>
                        {s.stream_label} · {s.admission_number}
                      </div>
                    </div>
                    {/* Score bar */}
                    <div style={{ width:120, display:"flex", flexDirection:"column", gap:4 }}>
                      <ScoreBar score={s.avg_score} color={g.color} />
                    </div>
                    {/* Score */}
                    <div style={{ width:56, textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontWeight:900, fontSize:18, color:g.color }}>{s.avg_score}%</div>
                      <div style={{ fontSize:10, color:C.textMuted }}>{s.subjects_sat} subjects</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </>)}
    </div>
  );
}
AnalysisPageInner.propTypes = { auth: PropTypes.object };

AnalysisPage.propTypes = { auth: PropTypes.object };