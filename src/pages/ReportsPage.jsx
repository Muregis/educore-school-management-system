import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { calculateGrade } from "../lib/grading";
import { useCurrentTerm } from "../hooks/useCurrentTerm";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";

// Use shared grading utility instead of local definition
const gradeInfo = (score) => {
  const grade = calculateGrade(score, 'CBC');
  return {
    label: grade.grade,
    color: grade.color,
    bg: grade.bgColor,
    text: grade.label
  };
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

const StatCard = ({ label, value, tone = "default" }) => {
  const colors = { 
    success: "var(--color-success)", 
    warning: "var(--color-warning)", 
    danger: "var(--color-danger)", 
    info: "var(--color-info)", 
    default: "var(--color-primary)" 
  };
  return (
    <Card style={{ padding: "var(--space-3)", flex: 1, minWidth: "160px" }}>
      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 800, color: colors[tone] }}>{value}</div>
    </Card>
  );
};

// ─── Intervention generator ────────────────────────────────────────────────
function buildInterventions(subjectRankings, streamAverages) {
  const out = [];
  const rankings = subjectRankings || [];
  const streams = streamAverages || [];
  const byScore = [...rankings].sort((a,b) => a.avg_score - b.avg_score);
  const weak    = byScore.slice(0, Math.min(3, byScore.length));
  const strong  = [...rankings].sort((a,b) => b.avg_score - a.avg_score).slice(0, 2);

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

  if (streams.length >= 2) {
    const sorted = [...streams].sort((a,b) => b.avg_score - a.avg_score);
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

  const lowestStream = [...streams].sort((a,b) => a.avg_score - b.avg_score)[0];
  if (lowestStream && lowestStream.avg_score < 60) {
    out.push({ urgency:"high", subject:`${lowestStream.stream_label} Overall`,
      finding:`${lowestStream.stream_label} overall average of ${lowestStream.avg_score}% is below passing threshold`,
      action:"Hold an urgent stream review with all subject teachers. Engage parents in a performance meeting. Run a structured 8-week catch-up programme with bi-weekly tracking." });
  }

  return out;
}

// ─── Analysis Tab ──────────────────────────────────────────────────────────
function AnalysisTab({ auth }) {
  const { term: currentTerm } = useCurrentTerm(auth);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [aiReport, setAiReport]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState("");
  const [term, setTerm]           = useState(currentTerm || "Term 1");
  const [className, setClassName] = useState("");
  const [availTerms, setAvailTerms]     = useState([]);
  const [availClasses, setAvailClasses] = useState([]);
  const [activeStream, setActiveStream] = useState(null);
  const [reportMode, setReportMode]     = useState("visual"); // "visual" | "ai"
  const [trends, setTrends]             = useState(null);
  const [topStudents, setTopStudents]   = useState(null);
  const [topClass, setTopClass]         = useState("");
  const [studentRankings, setStudentRankings] = useState(null);
  const [classStats, setClassStats]     = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Computed values - use useMemo to ensure proper initialization
  const { streamSorted, byClass, interventions } = useMemo(() => {
    const sorted = (data && data.streamAverages) ? [...data.streamAverages].sort((a,b) => b.avg_score - a.avg_score) : [];
    
    const classMap = {};
    sorted.forEach(s => {
      if (!classMap[s.class_name]) classMap[s.class_name] = [];
      classMap[s.class_name].push(s);
    });
    
    const ints = (data && data.subjectRankings && data.streamAverages) 
      ? buildInterventions(data.subjectRankings || [], data.streamAverages || []) 
      : [];
    
    return { streamSorted: sorted, byClass: classMap, interventions: ints };
  }, [data]);

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

      // Fetch trends + top students + rankings + class stats in parallel
      const [trendRes, topRes, rankRes, statsRes] = await Promise.all([
        apiFetch(`/analysis/trends${className ? `?class_name=${encodeURIComponent(className)}` : ""}`, { token: auth.token }),
        apiFetch(`/analysis/top-students?limit=10${term ? `&term=${encodeURIComponent(term)}` : ""}${className ? `&class_name=${encodeURIComponent(className)}` : ""}`, { token: auth.token }),
        apiFetch(`/analysis/student-rankings?term=${encodeURIComponent(term)}${className ? `&class_name=${encodeURIComponent(className)}` : ""}`, { token: auth.token }),
        apiFetch(`/analysis/class-stats?term=${encodeURIComponent(term)}${className ? `&class_name=${encodeURIComponent(className)}` : ""}`, { token: auth.token }),
      ]);
      setTrends(trendRes);
      setTopStudents(topRes);
      setStudentRankings(rankRes);
      setClassStats(statsRes);
      setIsInitialized(true);
    } catch (e) { console.error("Analysis error:", e); }
    setLoading(false);
  }, [auth, term, className]);

  useEffect(() => { load(); }, [load]);

  // Update term when currentTerm changes
  useEffect(() => {
    if (currentTerm && currentTerm !== term) {
      setTerm(currentTerm);
    }
  }, [currentTerm, term]);

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

  const urgencyColor = { high:"var(--color-danger)", medium:"var(--color-warning)", maintain:"var(--color-success)" };
  const urgencyBg    = { high:"color-mix(in srgb, var(--color-danger) 10%, transparent)", medium:"color-mix(in srgb, var(--color-warning) 10%, transparent)", maintain:"color-mix(in srgb, var(--color-success) 10%, transparent)" };
  const urgencyLabel = { high:"🔴 High Priority", medium:"🟡 Medium Priority", maintain:"🟢 Maintain" };

  // Prevent rendering until data is loaded to avoid temporal dead zone errors
  if (loading || !data || !isInitialized) return (
    <Card style={{ textAlign: "center", padding: "60px var(--space-4)" }}>
      <EmptyState icon="📊" title="Loading analysis..." description="Please wait while we fetch the data." />
    </Card>
  );

  if (data.streamAverages.length === 0) return (
    <Card style={{ textAlign: "center", padding: "60px var(--space-4)" }}>
      <EmptyState icon="📊" title="No results data yet" description="Enter results in the Grades page to see stream analysis." />
    </Card>
  );

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", fontWeight: 800 }}>Academic Insights</div>
          <h1 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 800, color: "var(--color-text-primary)", fontFamily: "var(--font-heading)" }}>Academic Analysis</h1>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Badge text="Live data" variant="primary" />
          <Badge text="Brand aware" variant="success" />
        </div>
      </div>

      {/* ── Filters + mode toggle ── */}
      <Card style={{ padding: "var(--space-4)", background: "linear-gradient(145deg, color-mix(in srgb, var(--color-bg-card) 96%, transparent) 0%, var(--color-bg-card) 100%)", boxShadow: "var(--shadow-sm)" }}>
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

          {/* SECTION 5 — Student Rankings */}
          {studentRankings && studentRankings.all_students && studentRankings.all_students.length > 0 && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>5. Student Rankings</h3>
              <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                Students ranked by average score with position, total marks, and subject breakdown.
              </p>
              
              <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                <Table 
                  headers={["Position", "Student", "Admission No.", "Class", "Average", "Total Marks", "Subjects"]}
                  data={studentRankings.all_students.slice(0, 50).map((s, i) => {
                    const g = gradeInfo(s.avg_score);
                    return [
                      <span key="pos" style={{ fontWeight: 800, color: s.position <= 3 ? "var(--color-primary)" : "var(--color-text-secondary)" }}>#{s.position}</span>,
                      <span key="name" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{s.first_name} {s.last_name}</span>,
                      <span key="adm" style={{ color: "var(--color-text-secondary)" }}>{s.admission_number || "—"}</span>,
                      <span key="cls" style={{ color: "var(--color-text-secondary)" }}>{s.stream_label || s.class_name || "—"}</span>,
                      <div key="avg" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <ScoreBar score={s.avg_score} color={g.color} />
                        <span style={{ fontWeight: 800, color: g.color, minWidth: "42px", textAlign: "right" }}>{s.avg_score}%</span>
                      </div>,
                      <span key="total" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{s.total_marks}</span>,
                      <span key="subjs" style={{ color: "var(--color-text-secondary)" }}>{s.subjects_sat}</span>,
                    ];
                  })}
                />
              </div>
              
              {studentRankings.all_students.length > 50 && (
                <div style={{ marginTop: "var(--space-3)", fontSize: "13px", color: "var(--color-text-secondary)", textAlign: "center" }}>
                  Showing top 50 of {studentRankings.all_students.length} students
                </div>
              )}
            </Card>
          )}

          {/* SECTION 6 — Class Statistics */}
          {classStats && classStats.overall && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>6. Class Statistics</h3>
              <p style={{ margin: "0 0 var(--space-4) 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                Comprehensive class performance metrics including mean, median, and subject breakdowns.
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                {[
                  ["Mean", `${classStats.overall.mean}%`, "Average score across all students"],
                  ["Median", `${classStats.overall.median}%`, "Middle score when ranked"],
                  ["Highest", `${classStats.overall.highest}%`, "Best student average"],
                  ["Lowest", `${classStats.overall.lowest}%`, "Lowest student average"],
                  ["Students", classStats.overall.student_count, "Total number of students"],
                ].map(([label, value, desc]) => (
                  <div key={label} style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <div style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-primary)", marginBottom: "2px" }}>{value}</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* Grade Distribution */}
              {Object.keys(classStats.overall.grade_distribution || {}).length > 0 && (
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-2)", fontSize: "15px" }}>Grade Distribution</div>
                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    {Object.entries(classStats.overall.grade_distribution).map(([grade, count]) => {
                      const g = gradeInfo(grade === "EE" ? 85 : grade === "ME" ? 65 : grade === "AE" ? 45 : 25);
                      return (
                        <div key={grade} style={{ background: g.bg, border: `1px solid ${g.color}`, borderRadius: "var(--radius-md)", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Badge text={grade} style={{ background: g.color, color: "#fff", borderColor: "transparent" }} />
                          <span style={{ fontWeight: 700, color: g.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subject Breakdown by Class */}
              {Object.keys(classStats.by_class || {}).length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-2)", fontSize: "15px" }}>Subject Performance by Class</div>
                  <div style={{ display: "grid", gap: "var(--space-3)" }}>
                    {Object.entries(classStats.by_class).map(([clsName, subjects]) => (
                      <div key={clsName} style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                        <div style={{ fontWeight: 700, color: "var(--color-primary)", marginBottom: "var(--space-2)" }}>{clsName}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-2)" }}>
                          {Object.entries(subjects).map(([subj, stats]) => {
                            const g = gradeInfo(stats.mean);
                            return (
                              <div key={subj} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--color-bg-surface)", borderRadius: "var(--radius-sm)" }}>
                                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)" }}>{subj}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <ScoreBar score={stats.mean} color={g.color} />
                                  <span style={{ fontWeight: 700, color: g.color, fontSize: "13px", minWidth: "40px", textAlign: "right" }}>{stats.mean}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* SECTION 7 — Term Performance Trends */}
          {trends && trends.terms.length > 1 && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>7. Term Performance Trends</h3>
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
              {!trends || !trends.subjects || !trends.terms ? (
                <p style={{ padding: "var(--space-3)", color: "var(--color-text-muted)" }}>No trend data yet.</p>
              ) : (
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
              )}
            </Card>
          )}

          {/* SECTION 8 — Top Students */}
          {topStudents && topStudents.overall.length > 0 && (
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-1) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>8. Top Performing Students</h3>
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
                {!topStudents || (!topStudents.overall && !topStudents.byClass) ? (
                  <p style={{ padding: "var(--space-3)", color: "var(--color-text-muted)" }}>No student data yet.</p>
                ) : (
                  <>
                    {(topClass
                      ? (topStudents.byClass || []).filter(s => s.class_name === topClass)
                      : (topStudents.overall || [])
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
                  </>
                )}
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}

AnalysisTab.propTypes = { auth: PropTypes.object };

// ─── Main ReportsPage ──────────────────────────────────────────────────────
export default function ReportsPage({ auth }) {
  const { term: currentTerm } = useCurrentTerm(auth);
  const [summary, setSummary]       = useState(null);
  const [monthly, setMonthly]       = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [defaulters, setDefaulters] = useState([]);
  const [grades, setGrades]         = useState([]);
  const [classFeeSummary, setClassFeeSummary] = useState([]);
  const [expenditureSummary, setExpenditureSummary] = useState(null);
  const [tab, setTab]               = useState("overview");
  const [filterClass, setFilterClass] = useState("all");
  const [loading, setLoading]       = useState(true);
  const [classOptions, setClassOptions] = useState([]);

  useEffect(() => {
    const token = auth?.token || sessionStorage.getItem("token");
    if (token) {
      let ignore = false;
      apiFetch('/classes', { token })
        .then(res => {
          if (!ignore) setClassOptions(res.data || res || []);
        })
        .catch((e) => {
          if (e?.code !== "EABORT") {
            console.error("Classes load error:", e);
          }
        });
      return () => {
        ignore = true;
      };
    }
    return undefined;
  }, [auth?.token]);

  useEffect(() => {
    const token = auth?.token || sessionStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    let ignore = false;
    setLoading(true);
    Promise.all([
      apiFetch("/reports/summary",                { token }),
      apiFetch("/reports/monthly-fee-collection", { token }),
      apiFetch("/reports/attendance-rate",        { token }),
      apiFetch(`/reports/fee-defaulters${currentTerm ? `?term=${encodeURIComponent(currentTerm)}` : ""}`, { token }),
      apiFetch(`/reports/grade-distribution${filterClass !== "all" ? `?class_name=${encodeURIComponent(filterClass)}` : ""}`, { token }),
      apiFetch("/reports/class-fee-summary",      { token }), // New endpoint for class-wise fees
      apiFetch("/reports/expenditure-summary",    { token }),
    ]).then(([s, m, a, d, g, cfs, es]) => {
      if (ignore) return;
      const normSummary = s ? {
        students:       s.totalStudents  ?? s.students       ?? 0,
        teachers:       s.totalTeachers  ?? s.teachers       ?? 0,
        feesCollected:  s.totalCollected ?? s.feesCollected  ?? 0,
        feesPending:    s.totalPending   ?? s.feesPending    ?? 0,
        totalExpenses:  s.totalExpenses  ?? 0,
        payrollExpenses:s.payrollExpenses ?? 0,
        manualExpenses: s.manualExpenses ?? 0,
        netCashflow:    s.netCashflow ?? 0,
        openDiscipline: s.openDiscipline ?? 0,
      } : null;
      setSummary(normSummary);
      setMonthly((m || []).map(row => ({ ...row, total: row.total ?? row.collected ?? 0 })));
      setAttendance(a);
      setDefaulters(d);
      setClassFeeSummary(cfs || []);
      setExpenditureSummary(es || null);
      setGrades((g || []).map(row => ({
        ...row,
        avg_score:  row.avg_score  ?? row.avgScore  ?? 0,
        class_name: row.class_name ?? "",
      })));
    }).catch(e => {
      if (!ignore && e?.code !== "EABORT") {
        console.error("Reports load error:", e);
      }
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [auth?.token, filterClass]);

  const tabBtn = id => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: "10px 16px", border: "none",
      borderBottom: `2px solid ${tab === id ? "var(--color-primary)" : "transparent"}`,
      background: "transparent", color: tab === id ? "var(--color-primary)" : "var(--color-text-secondary)",
      cursor: "pointer", fontWeight: tab === id ? 600 : 500, fontSize: "14px",
      transition: "all 0.2s ease"
    }}>
      {id === "analysis" ? "📊 Analysis" : id.charAt(0).toUpperCase() + id.slice(1)}
    </button>
  );

  // Grades are now filtered server-side, defaulters are still filtered locally
  const filteredDefaulters = (!defaulters || defaulters.length === 0) ? [] : 
    (filterClass === "all" ? defaulters : defaulters.filter(d => d.class_name === filterClass));

  // Defaulters pagination state
  const [defaultersPage, setDefaultersPage] = useState(1);
  const [defaultersPageSize, setDefaultersPageSize] = useState(20);

  // Calculate paginated defaulters
  const totalDefaulters = filteredDefaulters.length;
  const totalDefaulterPages = defaultersPageSize === 'all' ? 1 : Math.ceil(totalDefaulters / defaultersPageSize);
  const paginatedDefaulters = defaultersPageSize === 'all'
    ? filteredDefaulters
    : filteredDefaulters.slice((defaultersPage - 1) * defaultersPageSize, defaultersPage * defaultersPageSize);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setDefaultersPage(1);
  }, [filterClass, defaultersPageSize]);

  if (loading) return <div style={{ color: "var(--color-text-muted)", padding: "32px", textAlign: "center" }}>Loading reports…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Summary cards */}
      {summary && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <StatCard label="Active Students"  value={summary.students}               tone="info" />
          <StatCard label="Active Teachers"  value={summary.teachers}               tone="info" />
          <StatCard label="Fees Collected"   value={money(summary.feesCollected)}   tone="success" />
          <StatCard label="Fees Pending"     value={money(summary.feesPending)}     tone="warning" />
          <StatCard label="Total Expenses"   value={money(summary.totalExpenses)}   tone="danger" />
          <StatCard label="Net Cashflow"     value={money(summary.netCashflow)}     tone={summary.netCashflow >= 0 ? "success" : "danger"} />
          <StatCard label="Open Discipline"  value={summary.openDiscipline}         tone="danger" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
        {["overview","fees","expenditures","attendance","grades","defaulters","analysis"].map(tabBtn)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Class filter (grades / defaulters tabs) */}
        {["grades","defaulters"].includes(tab) && (
          <div style={{ width: "250px" }}>
            <Select 
              value={filterClass} 
              onChange={e => setFilterClass(e.target.value)}
              options={[
                { value: "all", label: "All classes" },
                ...classOptions.map(c => ({ value: c.class_name, label: c.class_name }))
              ]}
            />
          </div>
        )}

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Monthly Fee Collection</h3>
              {monthly.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No payment data yet.</p> : (
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  <Table 
                    headers={["Month", "Transactions", "Total"]}
                    data={monthly.map((m, i) => [
                      <span key="month" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{m.month}</span>,
                      <span key="tx" style={{ color: "var(--color-text-secondary)" }}>{m.transactions}</span>,
                      <span key="total" style={{ color: "var(--color-success)", fontWeight: 700 }}>{money(m.total)}</span>
                    ])}
                  />
                </div>
              )}
            </Card>

            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Income vs Expenses</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
                <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Fee Income</div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-success)" }}>{money(summary?.feesCollected || 0)}</div>
                </div>
                <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Operating Expenses</div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-danger)" }}>{money(summary?.totalExpenses || 0)}</div>
                </div>
                <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Net Cashflow</div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: (summary?.netCashflow || 0) >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{money(summary?.netCashflow || 0)}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── Fees ── */}
        {tab === "fees" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Class-wise Outstanding Balance */}
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Outstanding Balance by Class</h3>
              {classFeeSummary.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)" }}>Loading class fee data...</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
                  {classFeeSummary.map(cls => (
                    <div key={cls.class_name} style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                      <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)", fontWeight: 600 }}>{cls.class_name}</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: cls.total_outstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {money(cls.total_outstanding)}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "var(--space-2)" }}>
                        <span style={{ fontWeight: 600 }}>{cls.student_count}</span> students · <span style={{ color: "var(--color-success)", fontWeight: 500 }}>{money(cls.total_paid)} paid</span>
                      </div>
                      {cls.total_expected > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                          Expected: {money(cls.total_expected)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Monthly Fee Collection</h3>
              {monthly.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No payment data yet.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {monthly.map((m, i) => {
                    const max = Math.max(...monthly.map(x => Number(x.total)));
                    const pct = max > 0 ? (Number(m.total) / max) * 100 : 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
                        <div style={{ width: "80px", fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>{m.month}</div>
                        <div style={{ flex: 1, background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", height: "24px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--color-primary), var(--color-info))", height: "100%", borderRadius: "var(--radius-full)", transition: "width 0.4s" }} />
                        </div>
                        <div style={{ width: "120px", fontSize: "14px", color: "var(--color-text-primary)", textAlign: "right", fontWeight: 700 }}>{money(m.total)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === "expenditures" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Expense Breakdown</h3>
              {!expenditureSummary?.byCategory?.length ? (
                <p style={{ color: "var(--color-text-muted)" }}>No expenditure data yet.</p>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  <Table
                    headers={["Category", "Amount"]}
                    data={expenditureSummary.byCategory.map((item) => [
                      <span key="category" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.category}</span>,
                      <span key="amount" style={{ color: "var(--color-danger)", fontWeight: 700 }}>{money(item.amount)}</span>
                    ])}
                  />
                </div>
              )}
            </Card>

            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Monthly Expense Trend</h3>
              {!expenditureSummary?.monthlyTrend?.length ? (
                <p style={{ color: "var(--color-text-muted)" }}>No expenditure trend available yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {expenditureSummary.monthlyTrend.map((month) => {
                    const max = Math.max(...expenditureSummary.monthlyTrend.map(x => Number(x.total)), 1);
                    const pct = (Number(month.total) / max) * 100;
                    return (
                      <div key={month.month} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0" }}>
                        <div style={{ width: "90px", fontSize: "13px", color: "var(--color-text-secondary)", fontWeight: 500 }}>{month.label}</div>
                        <div style={{ flex: 1, background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-full)", height: "24px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--color-danger), var(--color-warning))", height: "100%", borderRadius: "var(--radius-full)", transition: "width 0.4s" }} />
                        </div>
                        <div style={{ width: "130px", fontSize: "14px", color: "var(--color-text-primary)", textAlign: "right", fontWeight: 700 }}>{money(month.total)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Attendance ── */}
        {tab === "attendance" && (
          <Card style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Attendance Rate by Class</h3>
            {attendance.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No attendance data yet.</p> : (
              <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                <Table 
                  headers={["Class", "Total Records", "Present", "Rate"]}
                  data={attendance.map((a, i) => [
                    <span key="class" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{a.class_name}</span>,
                    <span key="total" style={{ color: "var(--color-text-secondary)" }}>{a.total}</span>,
                    <span key="present" style={{ color: "var(--color-text-secondary)" }}>{a.present}</span>,
                    <span key="rate" style={{ color: Number(a.rate) >= 80 ? "var(--color-success)" : Number(a.rate) >= 60 ? "var(--color-warning)" : "var(--color-danger)", fontWeight: 700 }}>{a.rate}%</span>
                  ])}
                />
              </div>
            )}
          </Card>
        )}

        {/* ── Grades ── */}
        {tab === "grades" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Grade Averages by Subject */}
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Grade Averages by Subject</h3>
              {!grades || grades.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No grade data yet.</p> : (
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  <Table 
                    headers={["Class", "Subject", "Average", "Highest", "Lowest", "Entries"]}
                    data={grades.map((g, i) => {
                      const gInfo = gradeInfo(g.avg_score);
                      return [
                        <span key="class" style={{ color: "var(--color-text-primary)" }}>{g.class_name}</span>,
                        <span key="subject" style={{ color: "var(--color-text-secondary)" }}>{g.subject}</span>,
                        <span key="avg" style={{ fontWeight: 700, color: gInfo.color }}>{g.avg_score}</span>,
                        <span key="high" style={{ color: "var(--color-success)", fontWeight: 600 }}>{g.highest}</span>,
                        <span key="low" style={{ color: "var(--color-danger)", fontWeight: 600 }}>{g.lowest}</span>,
                        <span key="entries" style={{ color: "var(--color-text-muted)" }}>{g.entries}</span>
                      ];
                    })}
                  />
                </div>
              )}
            </Card>

            {/* Grade Distribution by Class */}
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Grade Distribution by Class</h3>
              {!grades || grades.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No grade data yet.</p> : (
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                  {[...new Set(grades.map(g => g.class_name))].map(clsName => {
                    const classGrades = grades.filter(g => g.class_name === clsName);
                    const totalStudents = classGrades.reduce((sum, g) => sum + (g.entries || 0), 0);
                    
                    // Use grade_counts from backend if available, otherwise calculate from avg_score
                    const gradeCounts = { EE: 0, ME: 0, AE: 0, BE: 0 };
                    classGrades.forEach(g => {
                      if (g.grade_counts) {
                        gradeCounts.EE += g.grade_counts.EE || 0;
                        gradeCounts.ME += g.grade_counts.ME || 0;
                        gradeCounts.AE += g.grade_counts.AE || 0;
                        gradeCounts.BE += g.grade_counts.BE || 0;
                      } else {
                        // Fallback to avg_score calculation
                        if (g.avg_score >= 80) gradeCounts.EE += g.entries || 0;
                        else if (g.avg_score >= 60) gradeCounts.ME += g.entries || 0;
                        else if (g.avg_score >= 40) gradeCounts.AE += g.entries || 0;
                        else gradeCounts.BE += g.entries || 0;
                      }
                    });

                    return (
                      <div key={clsName} style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", fontSize: "16px" }}>{clsName}</div>
                          <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>{totalStudents} total entries</div>
                        </div>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-2)" }}>
                          {[
                            { grade: "EE", label: "Exceeds Expectations", color: "var(--color-success)", count: gradeCounts.EE },
                            { grade: "ME", label: "Meets Expectations", color: "var(--color-info)", count: gradeCounts.ME },
                            { grade: "AE", label: "Approaching Expectations", color: "var(--color-warning)", count: gradeCounts.AE },
                            { grade: "BE", label: "Below Expectations", color: "var(--color-danger)", count: gradeCounts.BE },
                          ].map(({ grade, label, color, count }) => {
                            const pct = totalStudents > 0 ? (count / totalStudents * 100).toFixed(1) : 0;
                            return (
                              <div key={grade} style={{ background: "var(--color-bg-surface)", border: `1px solid ${color}`, borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <Badge text={grade} style={{ background: color, color: "#fff", borderColor: "transparent" }} />
                                  <span style={{ fontWeight: 700, color, fontSize: "14px" }}>{count}</span>
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{pct}%</div>
                                <div style={{ height: "4px", background: "var(--color-bg-base)", borderRadius: "var(--radius-full)", marginTop: "6px", overflow: "hidden" }}>
                                  <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: "var(--radius-full)" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Grade Distribution by Subject */}
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Grade Distribution by Subject</h3>
              {!grades || grades.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No grade data yet.</p> : (
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  <Table 
                    headers={["Subject", "Exam Type", "EE Count", "EE %", "ME Count", "ME %", "AE Count", "AE %", "BE Count", "BE %"]}
                    data={(() => {
                      const pct = (count, total) => total > 0 ? (count / total * 100).toFixed(1) + "%" : "0%";
                      return [...new Set(grades.map(g => `${g.subject}|${g.exam_type || "All Exams"}`))].map(key => {
                        const [subject, examType] = key.split("|");
                        const subjectData = grades.filter(g => g.subject === subject && (g.exam_type || "All Exams") === examType);
                        const totalEntries = subjectData.reduce((sum, g) => sum + (g.entries || 0), 0);
                        
                        // Use grade_counts from backend if available, otherwise calculate from avg_score
                        const gradeCounts = { EE: 0, ME: 0, AE: 0, BE: 0 };
                        subjectData.forEach(g => {
                          if (g.grade_counts) {
                            gradeCounts.EE += g.grade_counts.EE || 0;
                            gradeCounts.ME += g.grade_counts.ME || 0;
                            gradeCounts.AE += g.grade_counts.AE || 0;
                            gradeCounts.BE += g.grade_counts.BE || 0;
                          } else {
                            // Fallback to avg_score calculation
                            if (g.avg_score >= 80) gradeCounts.EE += g.entries || 0;
                            else if (g.avg_score >= 60) gradeCounts.ME += g.entries || 0;
                            else if (g.avg_score >= 40) gradeCounts.AE += g.entries || 0;
                            else gradeCounts.BE += g.entries || 0;
                          }
                        });

                        return [
                          <span key="subject" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{subject}</span>,
                          <span key="exam_type" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{examType}</span>,
                          <span key="ee_count" style={{ color: "var(--color-success)", fontWeight: 600 }}>{gradeCounts.EE}</span>,
                          <span key="ee_pct" style={{ color: "var(--color-text-secondary)" }}>{pct(gradeCounts.EE, totalEntries)}</span>,
                          <span key="me_count" style={{ color: "var(--color-info)", fontWeight: 600 }}>{gradeCounts.ME}</span>,
                          <span key="me_pct" style={{ color: "var(--color-text-secondary)" }}>{pct(gradeCounts.ME, totalEntries)}</span>,
                          <span key="ae_count" style={{ color: "var(--color-warning)", fontWeight: 600 }}>{gradeCounts.AE}</span>,
                          <span key="ae_pct" style={{ color: "var(--color-text-secondary)" }}>{pct(gradeCounts.AE, totalEntries)}</span>,
                          <span key="be_count" style={{ color: "var(--color-danger)", fontWeight: 600 }}>{gradeCounts.BE}</span>,
                          <span key="be_pct" style={{ color: "var(--color-text-secondary)" }}>{pct(gradeCounts.BE, totalEntries)}</span>,
                        ];
                      });
                    })()}
                  />
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Defaulters ── */}
        {tab === "defaulters" && (
          <Card style={{ padding: "var(--space-4)" }}>
            <h3 style={{ margin: "0 0 var(--space-3) 0", color: "var(--color-text-primary)", fontSize: "18px" }}>Fee Defaulters (Highest Balance First)</h3>
            {filteredDefaulters.length === 0 ? <EmptyState icon="🎉" title="No Defaulters" description="All fees have been cleared!" /> : (
              <>
                {/* Summary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                  <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Total Defaulters</div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-danger)" }}>{filteredDefaulters.length}</div>
                  </div>
                  <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Total Outstanding</div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-danger)" }}>
                      {money(filteredDefaulters.reduce((sum, d) => sum + (d.balance || 0), 0))}
                    </div>
                  </div>
                  <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>Highest Balance</div>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-danger)" }}>
                      {money(filteredDefaulters[0]?.balance || 0)}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-3)", fontSize: "13px", padding: "var(--space-2)", background: "var(--color-bg-base)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: 14, height: 14, background: "var(--color-danger)", borderRadius: 3 }}></div>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>Critical (&gt;50% balance)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: 14, height: 14, background: "var(--color-warning)", borderRadius: 3 }}></div>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>Warning (10-50% balance)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: 14, height: 14, background: "var(--color-info)", borderRadius: 3 }}></div>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>Info (&lt;10% balance)</span>
                  </div>
                </div>

                {/* Enhanced table with color coding */}
                <div style={{ overflowX: "auto", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                  <Table 
                    headers={["Student", "Class", "Admission", "Phone", "Carry Fwd", "Term Charge", "Expected", "Paid", "Balance", "% Owed", "Status", "Last Payment", "Actions"]}
                    data={paginatedDefaulters.map((d, i) => {
                      const balancePercentage = d.balance_percentage || (d.expected_amount > 0 ? (d.balance / d.expected_amount) * 100 : 0);
                      let severityColor, severityBg, severityLabel;
                      
                      if (balancePercentage > 50) {
                        severityColor = "var(--color-danger)"; severityBg = "color-mix(in srgb, var(--color-danger) 15%, transparent)"; severityLabel = "Critical";
                      } else if (balancePercentage >= 10) {
                        severityColor = "var(--color-warning)"; severityBg = "color-mix(in srgb, var(--color-warning) 15%, transparent)"; severityLabel = "Warning";
                      } else {
                        severityColor = "var(--color-info)"; severityBg = "color-mix(in srgb, var(--color-info) 15%, transparent)"; severityLabel = "Low";
                      }

                      return [
                        <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{d.student_name || `${d.first_name || ''} ${d.last_name || ''}`}</span>,
                        <span key="class" style={{ color: "var(--color-text-secondary)" }}>{d.class_name}</span>,
                        <span key="admin" style={{ color: "var(--color-text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>{d.admission_number}</span>,
                        <span key="phone" style={{ color: "var(--color-text-muted)", fontSize: "12px", fontFamily: "var(--font-mono)" }}>{d.parent_phone}</span>,
                        <span key="carry" style={{ color: (d.carry_forward_amount || 0) >= 0 ? "var(--color-warning)" : "var(--color-success)", fontWeight: 500 }}>
                          {money(d.carry_forward_amount || 0)}
                        </span>,
                        <span key="term" style={{ color: "var(--color-text-secondary)" }}>
                          {money(d.current_term_charge || 0)}
                        </span>,
                        <span key="expected" style={{ color: "var(--color-text-secondary)" }}>{money(d.expected_amount || d.expected || 0)}</span>,
                        <span key="paid" style={{ color: "var(--color-success)", fontWeight: 500 }}>{money(d.paid_amount || d.paid || 0)}</span>,
                        <Badge key="balance" text={money(d.balance)} style={{ background: severityBg, color: severityColor, borderColor: "transparent", fontWeight: 700 }} />,
                        <span key="pct" style={{ color: severityColor, fontWeight: 600 }}>{balancePercentage.toFixed(1)}%</span>,
                        <Badge key="status" text={severityLabel} style={{ background: severityBg, color: severityColor, borderColor: severityColor }} />,
                        <span key="date" style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{d.last_payment_date ? new Date(d.last_payment_date).toLocaleDateString() : "Never"}</span>,
                        <Button
                          key="action"
                          size="sm"
                          onClick={() => {
                            const phone = d.parent_phone;
                            const studentName = d.student_name || `${d.first_name || ''} ${d.last_name || ''}`;
                            const balance = money(d.balance);
                            const message = encodeURIComponent(
                              `🏫 *FEE REMINDER*\n\n` +
                              `📚 *Student:* ${studentName}\n` +
                              `📝 *Class:* ${d.class_name}\n` +
                              `💰 *Outstanding Balance:* ${balance}\n\n` +
                              `Dear Parent,\n` +
                              `Please settle the outstanding fee balance at your earliest convenience.\n` +
                              `Payment options available via the school portal.\n\n` +
                              `Thank you for your cooperation.\n` +
                              `_EduCore School Management_`
                            );
                            
                            const cleanPhone = phone ? phone.replace(/[^\d]/g, '') : '';
                            if (cleanPhone) {
                              const waMeLink = `https://wa.me/254${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone.startsWith('254') ? cleanPhone.slice(3) : cleanPhone}?text=${message}`;
                              window.open(waMeLink, '_blank');
                            } else {
                              alert('No phone number available for this student');
                            }
                          }}
                          style={{ background: "#25D366", color: "#fff", borderColor: "#25D366", padding: "4px 8px" }}
                        >
                          📱 Send
                        </Button>
                      ];
                    })}
                  />
                </div>

                {/* Pagination controls */}
                {totalDefaulters > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-3)" }}>
                    {/* Page size selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "13px", color: "var(--color-text-secondary)" }}>
                      <span style={{ fontWeight: 500 }}>Show:</span>
                      <select
                        style={{ background: "var(--color-bg-surface)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", padding: "4px 8px", fontSize: "13px", cursor: "pointer" }}
                        value={defaultersPageSize}
                        onChange={(e) => setDefaultersPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value="all">All</option>
                      </select>
                      <span>of <strong style={{ color: "var(--color-text-primary)" }}>{totalDefaulters}</strong> defaulters</span>
                    </div>

                    {/* Page navigation */}
                    {defaultersPageSize !== 'all' && totalDefaulterPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDefaultersPage(p => Math.max(1, p - 1))}
                          disabled={defaultersPage === 1}
                        >
                          ‹ Prev
                        </Button>
                        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", padding: "0 var(--space-2)", fontWeight: 500 }}>
                          Page {defaultersPage} of {totalDefaulterPages}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDefaultersPage(p => Math.min(totalDefaulterPages, p + 1))}
                          disabled={defaultersPage === totalDefaulterPages}
                        >
                          Next ›
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* ── Analysis ── */}
        {tab === "analysis" && <AnalysisTab auth={auth} />}
      </div>
    </div>
  );
}

ReportsPage.propTypes = { auth: PropTypes.object };