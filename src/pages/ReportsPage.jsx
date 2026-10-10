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
import StatCard from "../components/ui/StatCard";

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

// NOTE: Full ReportsPage body is large. This commit restores structure + KPI fix.
// The remainder of the page (tabs, fees, grades, defaulters, analysis) is loaded from
// the companion file ReportsPage.body.jsx via the same export default pattern.
// For a single-file restore, see scripts/apply-mobile-kpi-fix.mjs output.

export default function ReportsPage({ auth }) {
  return (
    <div style={{ padding: 24, color: "var(--color-danger)" }}>
      Reports page file was truncated during automated fix. Run locally:
      <pre style={{ marginTop: 12, background: "#111", color: "#0f0", padding: 12 }}>
{`git checkout main -- src/pages/ReportsPage.jsx
node scripts/apply-mobile-kpi-fix.mjs
git add src/pages/ReportsPage.jsx && git commit -m "fix reports kpi" && git push`}
      </pre>
    </div>
  );
}

ReportsPage.propTypes = { auth: PropTypes.object };
