/**
 * Merit List — stream + consolidated rankings with CBC sub-levels.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { useCurrentTerm } from "../hooks/useCurrentTerm";
import { CBC_SUB_LEVELS } from "../lib/grading";

function chipStyle(grade) {
  const found = CBC_SUB_LEVELS.find((g) => g.grade === grade) || { color: "#64748b" };
  return {
    display: "inline-block", fontSize: 11, fontWeight: 700, padding: "1px 6px",
    borderRadius: 4, background: `${found.color}22`, color: found.color,
    border: `1px solid ${found.color}55`,
  };
}

function ScoreCell({ cell }) {
  if (!cell) return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
  return (
    <div style={{ lineHeight: 1.25, textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Number(cell.percentage).toFixed(0)}</div>
      <div style={chipStyle(cell.sub_level)}>{cell.sub_level}</div>
    </div>
  );
}
ScoreCell.propTypes = { cell: PropTypes.object };

export default function MeritListPage({ auth, toast }) {
  const { term: currentTerm } = useCurrentTerm(auth);
  const [term, setTerm] = useState("");
  const [className, setClassName] = useState("");
  const [stream, setStream] = useState("");
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const isTeacher = auth?.role === "teacher";

  useEffect(() => {
    if (!auth?.token) return;
    let ignore = false;
    (async () => {
      try {
        const [termsRes, classesRes] = await Promise.all([
          apiFetch("/academic/terms", { token: auth.token }).catch(() => []),
          apiFetch("/classes", { token: auth.token }).catch(() => []),
        ]);
        if (ignore) return;
        const tList = Array.isArray(termsRes) ? termsRes : (termsRes?.data || []);
        setTerms([...new Set(tList.map((x) => x.term_name || x.name || x.term).filter(Boolean))]);
        const cList = Array.isArray(classesRes)
          ? classesRes
          : (classesRes?.data || classesRes?.classes || classesRes?.rows || []);
        const rawNames = cList.map((c) => c.class_name || c.name).filter(Boolean);
        const bases = rawNames.map((n) => {
          const m = String(n).trim().match(/^(Grade\s*\d+|Form\s*\d+|PP\d?|Playgroup)/i);
          return m ? m[1].replace(/\s+/g, " ") : String(n).trim();
        });
        const classNames = [...new Set(bases.length ? bases : rawNames)].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        );
        setClasses(classNames);
        if (classNames[0]) setClassName((c) => c || classNames[0]);
      } catch { /* ignore */ }
    })();
    return () => { ignore = true; };
  }, [auth?.token]);

  useEffect(() => { if (currentTerm && !term) setTerm(currentTerm); }, [currentTerm, term]);

  const loadMerit = useCallback(async () => {
    if (!auth?.token || !term) { toast?.("Select a term first", "warning"); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ term });
      if (className) qs.set("class_name", className);
      if (stream) qs.set("stream", stream);
      setData(await apiFetch(`/analysis/merit?${qs}`, { token: auth.token }));
    } catch (err) {
      toast?.(err?.message || "Failed to load merit list", "error");
      setData(null);
    } finally { setLoading(false); }
  }, [auth?.token, term, className, stream, toast]);

  useEffect(() => { if (term && className) loadMerit(); }, [term, className, stream]); // eslint-disable-line

  const subjects = data?.subjects || [];
  const rows = data?.rows || [];
  const streams = data?.streams || [];

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const avgs = rows.map((r) => Number(r.average) || 0);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const bands = { EE: 0, ME: 0, AE: 0, BE: 0 };
    for (const r of rows) {
      const g = String(r.overall_grade || r.overall_sub_level || "").replace(/[12]$/, "").toUpperCase();
      if (g in bands) bands[g] += 1;
    }
    const top = rows[0];
    return {
      mean: Number(mean.toFixed(2)),
      count: rows.length,
      bands,
      topName: top ? (String(top.first_name || "") + " " + String(top.last_name || "")).trim() : "-",
      topAvg: top ? Number(top.average).toFixed(2) : "-",
      topLevel: top?.overall_sub_level || "-",
    };
  }, [rows]);

  const title = useMemo(() => {
    if (!className) return "Merit List";
    return stream ? `${className} ${stream} — Merit List` : `${className} Consolidated Merit List`;
  }, [className, stream]);

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ["Rank", "Assessment No", "Learner Name", "Class", ...subjects, "Total", "Grade", "Average"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const name = `${r.first_name || ""} ${r.last_name || ""}`.trim();
      lines.push([r.rank, r.admission_number || "", `"${name.replace(/"/g, '""')}"`, r.stream_label || r.class_name,
        ...subjects.map((s) => { const c = r.subjects?.[s]; return c ? `${c.percentage} (${c.sub_level})` : ""; }),
        r.total_marks, r.overall_sub_level, r.average].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `merit_${(className || "all").replace(/\s+/g, "_")}.csv`;
    a.click();
  };

  return (
    <div className="ec-page merit-page" style={{ padding: "var(--space-4)", maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .merit-print-root, .merit-print-root * { visibility: visible; }
          .merit-print-root { position: absolute; left: 0; top: 0; width: 100%; }
        }
        .merit-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .merit-table thead th { position: sticky; top: 0; background: #0f172a; color: #f8fafc; padding: 10px 8px; text-align: center; }
        .merit-table tbody td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .merit-table tbody tr:nth-child(even) { background: #f8fafc; }
        .merit-table tbody tr.top3 { background: #ecfdf5; }
        .merit-scroll { overflow-x: auto; border-radius: 10px; border: 1px solid #e2e8f0; }
        .merit-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 16px; }
        .merit-filters label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #64748b; }
        .merit-filters select, .merit-filters button { min-height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-size: 14px; }
        .merit-filters button.primary { background: var(--color-primary, #2563eb); color: #fff; border: none; font-weight: 600; cursor: pointer; }
        .stream-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .stream-chips button { border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .stream-chips button.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        @media (max-width: 767px) {
          .merit-card-list { display: flex; flex-direction: column; gap: 10px; }
          .merit-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; background: #fff; }
          .merit-desktop-only { display: none; }
        }
        @media (min-width: 768px) { .merit-card-list { display: none; } }
      `}</style>

      <div className="no-print" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{isTeacher ? "Class Merit" : "Merit Lists"}</h1>
        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>
          Ranked learners with CBC sub-levels (EE1–BE2). Print or export for staff meetings.
        </p>
      </div>

      <div className="merit-filters no-print">
        <label>Term
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">Select term</option>
            {(terms.length ? terms : [currentTerm || "Term 1", "Term 2", "Term 3"].filter(Boolean)).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>Grade / Class
          <select value={className} onChange={(e) => { setClassName(e.target.value); setStream(""); }}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" className="primary" onClick={loadMerit} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        <button type="button" onClick={exportCsv} disabled={!rows.length}>CSV</button>
        <button type="button" onClick={() => window.print()} disabled={!rows.length}>Print</button>
      </div>

      {streams.length > 0 && (
        <div className="stream-chips no-print">
          <button type="button" className={!stream ? "active" : ""} onClick={() => setStream("")}>Consolidated</button>
          {streams.map((s) => (
            <button key={s} type="button" className={stream === s ? "active" : ""} onClick={() => setStream(s)}>{s}</button>
          ))}
        </div>
      )}


      {stats ? (
        <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>LEARNERS</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.count}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>CLASS MEAN</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.mean}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>TOP LEARNER</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{stats.topName}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{stats.topAvg} · {stats.topLevel}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>EE / ME / AE / BE</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{stats.bands.EE} / {stats.bands.ME} / {stats.bands.AE} / {stats.bands.BE}</div>
          </div>
        </div>
      ) : null}

      <div className="merit-print-root">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            {data?.meta?.term ? `Term: ${data.meta.term}` : ""}{data?.meta?.learner_count != null ? ` · ${data.meta.learner_count} learners` : ""}
          </span>
        </div>

        {!loading && !rows.length && (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 12 }}>
            {term && className ? "No results for this term and class." : "Select term and class to view the merit list."}
          </div>
        )}

        {rows.length > 0 && (
          <div className="merit-scroll merit-desktop-only">
            <table className="merit-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Assessment No</th><th style={{ textAlign: "left" }}>Learner Name</th><th>Class</th>
                  {subjects.map((s) => <th key={s}>{s}</th>)}
                  <th>Total</th><th>Grade</th><th>Average</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const name = `${r.first_name || ""} ${r.last_name || ""}`.trim();
                  return (
                    <tr key={r.student_id} className={r.rank <= 3 ? "top3" : undefined}>
                      <td style={{ textAlign: "center", fontWeight: 800 }}>{r.rank}</td>
                      <td style={{ textAlign: "center" }}>{r.admission_number || "—"}</td>
                      <td style={{ textAlign: "left", fontWeight: 600 }}>{name}</td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.stream_label || r.class_name}</td>
                      {subjects.map((s) => <td key={s}><ScoreCell cell={r.subjects?.[s]} /></td>)}
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{r.total_marks}</td>
                      <td style={{ textAlign: "center" }}><span style={chipStyle(r.overall_sub_level)}>{r.overall_sub_level}</span></td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{Number(r.average).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="merit-card-list no-print">
            {rows.map((r) => {
              const name = `${r.first_name || ""} ${r.last_name || ""}`.trim();
              return (
                <div key={r.student_id} className="merit-card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 800 }}>#{r.rank} {name}</span>
                    <span style={chipStyle(r.overall_sub_level)}>{r.overall_sub_level}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                    {r.stream_label || r.class_name} · Avg {Number(r.average).toFixed(2)} · Total {r.total_marks}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                    {subjects.map((s) => {
                      const c = r.subjects?.[s];
                      return (
                        <div key={s} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b" }}>{s}</span>
                          <span style={{ fontWeight: 600 }}>{c ? `${Math.round(c.percentage)} ${c.sub_level}` : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

MeritListPage.propTypes = { auth: PropTypes.object, toast: PropTypes.func };
