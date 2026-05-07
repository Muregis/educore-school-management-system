import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";

// ─── Shared helpers ────────────────────────────────────────────────────────

const gradeInfo = (score) => {
  if (score >= 80) return { label: "EE", color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 15%, transparent)", text: "Exceeds Expectations" };
  if (score >= 60) return { label: "ME", color: "var(--color-info)", bg: "color-mix(in srgb, var(--color-info) 15%, transparent)", text: "Meets Expectations" };
  if (score >= 40) return { label: "AE", color: "var(--color-warning)", bg: "color-mix(in srgb, var(--color-warning) 15%, transparent)", text: "Approaching Expectations" };
  return              { label: "BE", color: "var(--color-danger)", bg: "color-mix(in srgb, var(--color-danger) 15%, transparent)", text: "Below Expectations" };
};

const ScoreBar = ({ score, color }) => (
  <div style={{ flex: 1, background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", height: "8px", overflow: "hidden" }}>
    <div style={{
      width: `${Math.min(score, 100)}%`,
      background: color || (score >= 70 ? "var(--color-success)" : score >= 50 ? "var(--color-warning)" : "var(--color-danger)"),
      height: "100%", borderRadius: "var(--radius-full)", transition: "width 0.5s ease",
    }} />
  </div>
);

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
          <div key={key++} style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-2)", paddingBottom: "var(--space-1)", borderBottom: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--color-primary)" }}>{line.replace("## ","")}</span>
          </div>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <div key={key++} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-1)", paddingLeft: "var(--space-2)" }}>
            <span style={{ color: "var(--color-primary)", flexShrink: 0 }}>•</span>
            <span style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{line.slice(2)}</span>
          </div>
        );
      } else if (line.match(/^\d+\. /)) {
        const num = line.match(/^(\d+)\.\s/)[1];
        elements.push(
          <div key={key++} style={{ display: "flex", gap: "10px", marginBottom: "var(--space-1)", paddingLeft: "var(--space-2)" }}>
            <span style={{ color: "var(--color-primary)", fontWeight: 700, flexShrink: 0, minWidth: 20 }}>{num}.</span>
            <span style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{line.replace(/^\d+\.\s/,"")}</span>
          </div>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={key++} style={{ height: "var(--space-2)" }} />);
      } else {
        elements.push(
          <p key={key++} style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "4px 0", lineHeight: 1.7 }}>{line}</p>
        );
      }
    });
    return elements;
  };

  const streamSorted = data ? [...data.streamAverages].sort((a,b) => b.avg_score - a.avg_score) : [];
  const byClass = {};
  streamSorted.forEach(s => {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  });
  
  const urgencyColor = { high:"var(--color-danger)", medium:"var(--color-warning)", maintain:"var(--color-success)" };
  const urgencyBg    = { high:"color-mix(in srgb, var(--color-danger) 10%, transparent)", medium:"color-mix(in srgb, var(--color-warning) 10%, transparent)", maintain:"color-mix(in srgb, var(--color-success) 10%, transparent)" };
  const urgencyLabel = { high:"🔴 High Priority", medium:"🟡 Medium Priority", maintain:"🟢 Maintain" };
  const interventions = data ? buildInterventions(data.subjectRankings, data.streamAverages) : [];

  if (!loading && data && data.streamAverages.length === 0) return (
    <Card style={{ textAlign: "center", padding: "60px var(--space-4)" }}>
      <EmptyState icon="📊" title="No results data yet" description="Enter results in the Grades page to see stream analysis." />
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>Academic Analysis</h1>
      </div>

      {/* ── Filters + mode toggle ── */}
      <Card style={{ padding: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ width: "150px" }}>
              <Select 
                label="Term"
                value={term} 
                onChange={e => setTerm(e.target.value)}
                options={availTerms.map(t => ({ value: t, label: t }))}
              />
            </div>
            <div style={{ width: "150px" }}>
              <Select 
                label="Class (optional)"
                value={className} 
                onChange={e => setClassName(e.target.value)}
                options={[
                  { value: "", label: "All Classes" },
                  ...availClasses.map(c => ({ value: c, label: c }))
                ]}
              />
            </div>
            <Button onClick={load}>
              Refresh
            </Button>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", background: "var(--color-bg-base)", padding: "var(--space-1)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
            {[["visual","📊 Visual Report"],["ai","🤖 AI Report"]].map(([mode, label]) => (
              <Button 
                key={mode} 
                variant={reportMode === mode ? "primary" : "ghost"} 
                size="sm"
                onClick={() => setReportMode(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {loading && <div style={{ color: "var(--color-text-muted)", padding: "32px", textAlign: "center" }}>Loading data…</div>}

      {/* ══════════ AI REPORT MODE ══════════ */}
      {!loading && data && reportMode === "ai" && (
        <div>
          {/* Generate button */}
          {!aiReport && !aiLoading && (
            <Card style={{ padding: "40px", textAlign: "center", marginBottom: "var(--space-4)" }}>
              <div style={{ fontSize: "48px", marginBottom: "var(--space-3)" }}>🤖</div>
              <h3 style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "20px", margin: "0 0 var(--space-2) 0" }}>
                AI Performance Report
              </h3>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginBottom: "var(--space-4)", maxWidth: "500px", margin: "0 auto var(--space-4)" }}>
                Claude AI will analyse your stream data and generate a full 7-section academic performance
                report with ranked subjects, stream comparisons, risk groups, and practical recommendations.
              </p>
              <Button onClick={generateAIReport} size="lg" style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-info))", border: "none" }}>
                Generate AI Report
              </Button>
              {aiError && (
                <div style={{ marginTop: "var(--space-3)", color: "var(--color-danger)", fontSize: "13px", fontWeight: 500 }}>{aiError}</div>
              )}
            </Card>
          )}

          {/* Loading */}
          {aiLoading && (
            <Card style={{ padding: "60px var(--space-4)", textAlign: "center", marginBottom: "var(--space-4)" }}>
              <div style={{ fontSize: "32px", marginBottom: "var(--space-3)", animation: "spin 1s linear infinite" }}>⚙️</div>
              <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>Generating Report…</div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>Claude is analysing your school data</div>
            </Card>
          )}

          {/* Report output */}
          {aiReport && !aiLoading && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "16px" }}>
                  AI Academic Performance Report — {data.meta.term}{data.meta.class_name ? " · "+data.meta.class_name : ""}
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button variant="secondary" size="sm" onClick={generateAIReport}>
                    ↺ Regenerate
                  </Button>
                  <Button size="sm" onClick={() => {
                    const el = document.createElement("a");
                    el.href = "data:text/plain;charset=utf-8," + encodeURIComponent(aiReport);
                    el.download = `performance-report-${data.meta.term.replace(" ","-")}.txt`;
                    el.click();
                  }}>
                    ⬇ Download
                  </Button>
                </div>
              </div>
              <Card style={{ padding: "var(--space-4)" }}>
                {renderReport(aiReport)}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ══════════ VISUAL REPORT MODE ══════════ */}
      {!loading && data && reportMode === "visual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

          {/* SECTION 1 — Class Performance by Stream */}
          <Card style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>1. Class Performance by Stream</h3>
            <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
              Average score per stream. Click a stream card to see subject breakdown.
            </p>
            {Object.entries(byClass).map(([cls, streams]) => (
              <div key={cls} style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "15px", marginBottom: "var(--space-2)", borderLeft: `3px solid var(--color-primary)`, paddingLeft: "var(--space-2)" }}>{cls}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
                  {streams.map(s => {
                    const g = gradeInfo(s.avg_score);
                    const isActive = activeStream === s.stream_label;
                    return (
                      <div key={s.stream_label}
                        onClick={() => setActiveStream(isActive ? null : s.stream_label)}
                        style={{ 
                          background: isActive ? g.bg : "var(--color-bg-surface)",
                          border: `2px solid ${isActive ? g.color : "var(--color-border)"}`,
                          borderRadius: "var(--radius-lg)", 
                          padding: "var(--space-3)", 
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: isActive ? `0 4px 12px color-mix(in srgb, ${g.color} 20%, transparent)` : "none",
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "16px" }}>Stream {s.stream}</div>
                          <Badge text={g.label} style={{ background: g.bg, color: g.color, borderColor: g.color }} />
                        </div>
                        <div style={{ fontSize: "32px", fontWeight: 800, color: g.color, marginBottom: "var(--space-1)", letterSpacing: "-0.02em" }}>{s.avg_score}%</div>
                        <ScoreBar score={s.avg_score} color={g.color} />
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "var(--space-2)", fontWeight: 500 }}>
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
                    <div style={{ background: "color-mix(in srgb, var(--color-primary) 5%, transparent)", border: `1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)`,
                      borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginTop: "var(--space-3)" }}>
                      <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-3)", fontSize: "15px" }}>
                        {activeStream} — Subject Breakdown
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-2)" }}>
                        {subjects.map(sub => {
                          const g = gradeInfo(sub.avg_score);
                          return (
                            <div key={sub.subject} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-bg-base)", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}>
                              <div style={{ width: 120, fontSize: "13px", color: "var(--color-text-primary)", fontWeight: 500 }}>{sub.subject}</div>
                              <ScoreBar score={sub.avg_score} color={g.color} />
                              <div style={{ width: 40, fontWeight: 700, color: g.color, fontSize: "14px", textAlign: "right" }}>{sub.avg_score}%</div>
                              <div style={{ width: 30, textAlign: "center" }}>
                                <Badge text={g.label} style={{ background: g.bg, color: g.color, borderColor: "transparent", padding: "2px 6px" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </Card>

          {/* SECTION 2 — Subject Ranking */}
          <Card style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>2. Subject Performance Ranking</h3>
            <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
              Subjects ranked highest to lowest. Identifies strong and weak curriculum areas.
            </p>
            <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <Table 
                headers={["Rank", "Subject", "Average", "Highest", "Lowest", "Entries", "Grade"]}
                data={data.subjectRankings.map((s, i) => {
                  const g = gradeInfo(s.avg_score);
                  return [
                    <span key="rank" style={{ color: "var(--color-text-secondary)", fontWeight: 700 }}>#{i+1}</span>,
                    <span key="subject" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{s.subject}</span>,
                    <div key="avg" style={{ display: "flex", alignItems: "center", gap: "10px", width: "120px" }}>
                      <ScoreBar score={s.avg_score} color={g.color} />
                      <span style={{ fontWeight: 800, color: g.color, fontSize: "14px", minWidth: "42px", textAlign: "right" }}>{s.avg_score}%</span>
                    </div>,
                    <span key="high" style={{ color: "var(--color-success)", fontWeight: 600 }}>{s.highest}%</span>,
                    <span key="low" style={{ color: "var(--color-danger)", fontWeight: 600 }}>{s.lowest}%</span>,
                    <span key="entries" style={{ color: "var(--color-text-secondary)" }}>{s.entries}</span>,
                    <Badge key="grade" text={g.label} style={{ background: g.bg, color: g.color, borderColor: g.color }} />
                  ];
                })}
              />
            </div>
          </Card>

          {/* SECTION 3 — Stream vs Subject */}
          {data.streamVsSubject.subjects.length > 0 && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>3. Stream vs Subject Comparison</h3>
              <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                How each stream performs per subject — highlights which stream needs targeted help.
              </p>
              <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                <Table 
                  headers={["Subject", ...data.streamVsSubject.streams]}
                  data={data.streamVsSubject.subjects.map(subj => {
                    const row = [
                      <span key="subject" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{subj}</span>
                    ];
                    
                    data.streamVsSubject.streams.forEach(sl => {
                      const score = data.streamVsSubject.data[sl]?.[subj];
                      if (score == null) {
                        row.push(<span key={sl} style={{ color: "var(--color-text-muted)" }}>—</span>);
                      } else {
                        const g = gradeInfo(score);
                        row.push(
                          <Badge key={sl} text={`${score}%`} style={{ background: g.bg, color: g.color, borderColor: "transparent", fontWeight: 800 }} />
                        );
                      }
                    });
                    
                    return row;
                  })}
                />
              </div>
            </Card>
          )}

          {/* SECTION 4 — Way Forward */}
          <Card style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>4. Proposed Way Forward</h3>
            <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
              Data-driven interventions based on current performance. Switch to 🤖 AI Report for a full narrative analysis.
            </p>
            
            {interventions.length === 0 ? (
              <EmptyState icon="💡" title="Need more data" description="Add more results to generate recommendations." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {interventions.map((iv, i) => (
                  <div key={i} style={{ 
                    background: urgencyBg[iv.urgency],
                    border: `1px solid color-mix(in srgb, ${urgencyColor[iv.urgency]} 30%, transparent)`,
                    borderLeft: `4px solid ${urgencyColor[iv.urgency]}`,
                    borderRadius: "var(--radius-md)", 
                    padding: "var(--space-3)" 
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                      <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "15px" }}>{iv.subject}</div>
                      <Badge text={urgencyLabel[iv.urgency]} style={{ background: "transparent", color: urgencyColor[iv.urgency], borderColor: urgencyColor[iv.urgency] }} />
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>
                      <strong style={{ color: "var(--color-text-primary)" }}>Finding:</strong> {iv.finding}
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--color-text-primary)" }}>
                      <strong style={{ color: urgencyColor[iv.urgency] }}>Action:</strong> {iv.action}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: "var(--space-4)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
              <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-3)", fontSize: "16px" }}>📋 Standard Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {[
                  ["📚 Remedial Classes", "Identify students scoring below 50% and enrol them in targeted after-school remedial programmes grouped by subject weakness."],
                  ["🔄 Teaching Methodology Review", "Compare approaches of high-performing and low-performing streams. Share effective techniques school-wide through peer observations."],
                  ["📈 Monthly Performance Tracking", "Set up monthly mini-tests and track progress. Share results with teachers, parents and administration each month."],
                  ["👨‍👩‍👧 Parent Engagement", "Hold a termly meeting with parents of struggling students. Share specific targets and actions parents can support at home."],
                  ["🏆 Celebrate Strengths", "Publicly recognise top-performing streams and subjects each term to build a culture of academic excellence."],
                ].map(([title, desc]) => (
                  <div key={title} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, color: "var(--color-primary)", whiteSpace: "nowrap", width: "230px", flexShrink: 0, fontSize: "14px" }}>{title}</div>
                    <div style={{ fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* SECTION 5 — Term Performance Trends */}
          {trends && trends.terms.length > 1 && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>5. Term Performance Trends</h3>
              <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                How overall and subject performance has changed across terms.
              </p>
              
              {/* Overall trend bar */}
              <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "15px" }}>📈 Overall Average by Term</div>
                <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end", height: "120px" }}>
                  {trends.overall.map((t, i) => {
                    const g = gradeInfo(t.avg_score);
                    const h = Math.max(20, (t.avg_score / 100) * 100);
                    return (
                      <div key={t.term} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: g.color }}>{t.avg_score}%</div>
                        <div style={{ width: "100%", height: `${h}px`, background: g.color, borderRadius: "6px 6px 0 0",
                          opacity: 0.8 + i * 0.1, transition: "height 0.3s",
                          boxShadow: `0 -4px 12px color-mix(in srgb, ${g.color} 30%, transparent)` }} />
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", textAlign: "center", fontWeight: 500 }}>{t.term}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Subject trend table */}
              <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                <Table 
                  headers={["Subject", ...trends.terms, "Trend"]}
                  data={trends.subjects.map(subj => {
                    const scores = trends.terms.map(t => trends.data[subj]?.[t] ?? null);
                    const valid  = scores.filter(s => s !== null);
                    const first  = valid[0] ?? 0;
                    const last   = valid[valid.length - 1] ?? 0;
                    const diff   = last - first;
                    const trendIcon = diff > 2 ? "📈" : diff < -2 ? "📉" : "➡️";
                    const trendColor = diff > 2 ? "var(--color-success)" : diff < -2 ? "var(--color-danger)" : "var(--color-text-secondary)";
                    
                    const row = [
                      <span key="subject" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{subj}</span>
                    ];
                    
                    trends.terms.forEach(t => {
                      const sc = trends.data[subj]?.[t];
                      if (sc == null) {
                        row.push(<span key={t} style={{ color: "var(--color-text-muted)", textAlign: "center" }}>—</span>);
                      } else {
                        const g = gradeInfo(sc);
                        row.push(<Badge key={t} text={`${sc}%`} style={{ background: g.bg, color: g.color, borderColor: "transparent", fontWeight: 700 }} />);
                      }
                    });
                    
                    row.push(
                      <span key="trend" style={{ color: trendColor, fontWeight: 700, fontSize: "14px" }}>
                        {trendIcon} {diff > 0 ? "+" : ""}{diff !== 0 ? diff.toFixed(1)+"%" : "Stable"}
                      </span>
                    );
                    
                    return row;
                  })}
                />
              </div>
            </Card>
          )}

          {/* SECTION 6 — Top Students */}
          {topStudents && topStudents.overall.length > 0 && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>6. Top Performing Students</h3>
              <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                Highest average scores across all subjects for the selected term.
              </p>

              {/* Class filter for top students */}
              <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)", flexWrap: "wrap", padding: "var(--space-2)", background: "var(--color-bg-base)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                {["", ...[...new Set(topStudents.byClass.map(s => s.class_name))]].map(cls => (
                  <Button 
                    key={cls} 
                    variant={topClass === cls ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => setTopClass(cls)}
                  >
                    {cls || "🏆 Overall Top 10"}
                  </Button>
                ))}
              </div>

              {/* Leaderboard */}
              <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                {(topClass
                  ? topStudents.byClass.filter(s => s.class_name === topClass)
                  : topStudents.overall
                ).map((s, i) => {
                  const g = gradeInfo(s.avg_score);
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <div key={s.student_id} style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)",
                      borderBottom: `1px solid var(--color-border)`,
                      background: i < 3 ? `color-mix(in srgb, ${g.color} 5%, transparent)` : "var(--color-bg-surface)",
                    }}>
                      {/* Rank */}
                      <div style={{ width: "36px", textAlign: "center", flexShrink: 0 }}>
                        {medal
                          ? <span style={{ fontSize: "20px" }}>{medal}</span>
                          : <span style={{ fontWeight: 800, color: "var(--color-text-muted)", fontSize: "14px" }}>#{s.rank ?? i+1}</span>
                        }
                      </div>
                      {/* Avatar */}
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                        background: g.bg, border: `1px solid color-mix(in srgb, ${g.color} 30%, transparent)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: "14px", color: g.color,
                      }}>
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "15px" }}>
                          {s.first_name} {s.last_name}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                          {s.stream_label} · <span style={{ fontFamily: "var(--font-mono)" }}>{s.admission_number}</span>
                        </div>
                      </div>
                      {/* Score bar */}
                      <div style={{ width: "120px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <ScoreBar score={s.avg_score} color={g.color} />
                      </div>
                      {/* Score */}
                      <div style={{ width: "60px", textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: "18px", color: g.color }}>{s.avg_score}%</div>
                        <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", marginTop: "2px", fontWeight: 500 }}>{s.subjects_sat} subjects</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}
AnalysisPageInner.propTypes = { auth: PropTypes.object };

AnalysisPage.propTypes = { auth: PropTypes.object };