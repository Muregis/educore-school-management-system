/**
 * Printable merit / results sheet — Class vs Overall, CBC EE1–BE2 (CBE-style).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { useCurrentTerm } from "../hooks/useCurrentTerm";
import { CBC_SUB_LEVELS, calculateCbcSubLevel } from "../lib/grading";

const chip = (grade) => {
  const f = CBC_SUB_LEVELS.find((g) => g.grade === grade) || { color: "#64748b" };
  return {
    display: "inline-block", fontSize: 10, fontWeight: 700, padding: "1px 5px",
    borderRadius: 4, background: `${f.color}22`, color: f.color, border: `1px solid ${f.color}55`,
  };
};
const shortSub = (n) =>
  ({ Mathematics: "Math", English: "Eng", Kiswahili: "Kisw", Science: "Sci", "Social Studies": "S/S", CRE: "CRE" }[n] || n);

function ScoreCell({ cell }) {
  if (!cell) return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
  const sub = cell.sub_level || cell.grade || calculateCbcSubLevel(cell.percentage)?.grade;
  return (
    <div style={{ textAlign: "center", lineHeight: 1.2 }}>
      <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Number(cell.percentage).toFixed(0)}</div>
      {sub ? <div style={chip(sub)}>{sub}</div> : null}
    </div>
  );
}
ScoreCell.propTypes = { cell: PropTypes.object };

export default function MeritListPage({ auth, toast }) {
  const { term: currentTerm } = useCurrentTerm(auth);
  const [term, setTerm] = useState("");
  const [scope, setScope] = useState("class");
  const [className, setClassName] = useState("");
  const [stream, setStream] = useState("");
  const [classes, setClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!auth?.token) return;
    let cancel = false;
    (async () => {
      try {
        const [termsRes, classesRes] = await Promise.all([
          apiFetch("/academic/terms", { token: auth.token }).catch(() => []),
          apiFetch("/classes", { token: auth.token }).catch(() => []),
        ]);
        if (cancel) return;
        const tList = Array.isArray(termsRes) ? termsRes : termsRes?.data || [];
        const names = [...new Set(tList.map((x) => x.term_name || x.name || x.term).filter(Boolean))];
        if (!names.length) names.push("Term 1", "Term 2", "Term 3");
        setTerms(names);
        setTerm((p) => p || currentTerm || names[0]);
        const cList = Array.isArray(classesRes) ? classesRes : classesRes?.data || classesRes?.classes || [];
        const bases = [
          ...new Set(
            cList
              .map((c) => c.class_name || c.name)
              .filter(Boolean)
              .map((n) => {
                const m = String(n).match(/^(Grade\s*\d+|Form\s*\d+|PP\d?|Playgroup)/i);
                return m ? m[0].replace(/\s+/g, " ") : String(n).trim();
              })
          ),
        ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        setClasses(bases);
        setClassName((p) => p || bases.find((c) => /Grade\s*2/i.test(c)) || bases[0] || "");
      } catch (e) {
        toast?.(e.message || "Filter load failed", "error");
      }
    })();
    return () => { cancel = true; };
  }, [auth?.token, currentTerm, toast]);

  const load = useCallback(async () => {
    if (!auth?.token || !term) return;
    if (scope === "class" && !className) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ term });
      if (scope === "class" && className) qs.set("class_name", className);
      if (stream) qs.set("stream", stream);
      setData((await apiFetch(`/analysis/merit?${qs}`, { token: auth.token })) || { rows: [], subjects: [], streams: [] });
    } catch (e) {
      toast?.(e.message || "Load failed", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, term, scope, className, stream, toast]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || [];
  const subjects = data?.subjects || [];
  const streams = data?.streams || [];

  const ranked = useMemo(() => {
    let list = rows;
    if (stream) {
      const s = stream.toLowerCase();
      list = rows.filter(
        (r) =>
          String(r.stream || "").toLowerCase() === s ||
          String(r.stream_label || "").toLowerCase().includes(s)
      );
    }
    const sorted = [...list].sort((a, b) => (b.average || 0) - (a.average || 0));
    let rank = 1, prev = null;
    return sorted.map((r, i) => {
      if (prev !== null && Math.abs((r.average || 0) - prev) > 0.001) rank = i + 1;
      prev = r.average || 0;
      return { ...r, position: rank };
    });
  }, [rows, stream]);

  const subjectMeans = useMemo(() => {
    const b = {};
    for (const r of ranked) {
      for (const s of subjects) {
        const c = r.subjects?.[s];
        if (!c) continue;
        (b[s] ||= []).push(Number(c.percentage) || 0);
      }
    }
    const o = {};
    for (const [s, v] of Object.entries(b)) o[s] = +(v.reduce((a, x) => a + x, 0) / v.length).toFixed(1);
    return o;
  }, [ranked, subjects]);

  const classMean = useMemo(() => {
    if (!ranked.length) return null;
    return +(ranked.reduce((a, r) => a + (Number(r.average) || 0), 0) / ranked.length).toFixed(1);
  }, [ranked]);

  const subDist = useMemo(() => {
    const d = { EE1: 0, EE2: 0, ME1: 0, ME2: 0, AE1: 0, AE2: 0, BE1: 0, BE2: 0 };
    for (const r of ranked) {
      let g = String(r.overall_sub_level || "").toUpperCase();
      if (!(g in d)) g = calculateCbcSubLevel(r.average)?.grade;
      if (g && d[g] !== undefined) d[g] += 1;
    }
    return d;
  }, [ranked]);

  const title =
    scope === "overall"
      ? `School Merit List — ${term}`
      : `Merit List — ${className}${stream ? ` (${stream})` : ""} — ${term}`;

  const streamOpts = [
    ...new Set(
      streams.map((s) => (typeof s === "string" ? s : s.stream || s.stream_label)).filter(Boolean)
    ),
  ];

  return (
    <div className="ec-merit-page" style={{ maxWidth: "100%", overflowX: "hidden" }}>
      <style>{`
        .merit-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-bottom:12px}
        .merit-bar label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700;color:var(--color-text-muted);text-transform:uppercase}
        .merit-bar select,.merit-bar button{min-height:40px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg-card);color:var(--color-text-primary);padding:0 12px;font-weight:600;font-size:13px}
        .merit-bar button.p{background:var(--color-primary);border-color:transparent;color:#fff;cursor:pointer}
        .merit-scope{display:inline-flex;border:1px solid var(--color-border);border-radius:8px;overflow:hidden}
        .merit-scope button{border:0;background:transparent;min-height:40px;padding:0 14px;font-weight:700;cursor:pointer;color:var(--color-text-secondary)}
        .merit-scope button.on{background:var(--color-primary);color:#fff}
        .merit-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-bottom:12px}
        .merit-kpi{border:1px solid var(--color-border);border-radius:10px;padding:10px 12px;background:var(--color-bg-card)}
        .merit-kpi .v{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
        .merit-kpi .l{font-size:11px;color:var(--color-text-muted)}
        .merit-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--color-border);border-radius:12px;max-width:100%;background:var(--color-bg-card)}
        .merit-table{width:100%;border-collapse:collapse;font-size:12px;min-width:620px}
        .merit-table th,.merit-table td{border-bottom:1px solid var(--color-border);padding:7px 5px;text-align:center}
        .merit-table th{font-size:10px;text-transform:uppercase;color:var(--color-text-muted)}
        .merit-table .name{text-align:left;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}
        .merit-table tfoot td{font-weight:700;background:color-mix(in srgb,var(--color-primary) 8%,transparent)}
        .merit-cards{display:none;gap:10px;margin-top:12px}
        @media(max-width:640px){.merit-cards{display:grid}.merit-card{border:1px solid var(--color-border);border-radius:12px;padding:12px;background:var(--color-bg-card)}}
        @media print{
          .no-print{display:none!important}
          body *{visibility:hidden}
          .merit-print-root,.merit-print-root *{visibility:visible}
          .merit-print-root{position:absolute;left:0;top:0;width:100%;color:#000;background:#fff}
          .merit-wrap{overflow:visible;border-color:#ccc}
          .merit-table{min-width:0;font-size:10px}
          .merit-cards{display:none!important}
        }
      `}</style>

      <div className="no-print merit-bar">
        <div>
          <label>Scope</label>
          <div className="merit-scope">
            <button type="button" className={scope === "class" ? "on" : ""} onClick={() => setScope("class")}>Class</button>
            <button type="button" className={scope === "overall" ? "on" : ""} onClick={() => { setScope("overall"); setStream(""); }}>Overall</button>
          </div>
        </div>
        <label>Term
          <select value={term} onChange={(e) => setTerm(e.target.value)}>
            {terms.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {scope === "class" && (
          <label>Class
            <select value={className} onChange={(e) => { setClassName(e.target.value); setStream(""); }}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        {scope === "class" && streamOpts.length > 0 && (
          <label>Stream
            <select value={stream} onChange={(e) => setStream(e.target.value)}>
              <option value="">All streams</option>
              {streamOpts.map((s) => (
                <option key={s} value={String(s).replace(/^Grade\s*\d+\s*/i, "")}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="p" onClick={load} disabled={loading}>{loading ? "…" : "Refresh"}</button>
        <button type="button" className="p" onClick={() => window.print()} disabled={!ranked.length}>Print</button>
      </div>

      <div className="merit-print-root">
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>{title}</h1>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {ranked.length} learners
          {classMean != null ? ` · mean ${classMean}% (${calculateCbcSubLevel(classMean)?.grade || "—"})` : ""}
          {" · EE1–BE2"}
        </div>

        <div className="merit-kpis">
          <div className="merit-kpi"><div className="v">{ranked.length}</div><div className="l">Learners</div></div>
          <div className="merit-kpi"><div className="v">{classMean ?? "—"}</div><div className="l">Mean %</div></div>
          <div className="merit-kpi"><div className="v">{classMean != null ? calculateCbcSubLevel(classMean)?.grade : "—"}</div><div className="l">Mean band</div></div>
          <div className="merit-kpi"><div className="v">{subDist.EE1 + subDist.EE2}</div><div className="l">EE count</div></div>
        </div>

        <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {Object.entries(subDist).map(([g, n]) => (n > 0 ? <span key={g} style={chip(g)}>{g}: {n}</span> : null))}
        </div>

        {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--color-text-muted)" }}>Loading…</div>}
        {!loading && !ranked.length && (
          <div style={{ padding: 28, textAlign: "center", color: "var(--color-text-muted)" }}>
            No results for this selection. Enter grades for the term first.
          </div>
        )}

        {!loading && ranked.length > 0 && (
          <>
            <div className="merit-wrap">
              <table className="merit-table">
                <thead>
                  <tr>
                    <th>#</th><th>Adm</th><th className="name">Name</th>
                    {scope === "overall" && <th>Class</th>}
                    <th>Stream</th>
                    {subjects.map((s) => <th key={s} title={s}>{shortSub(s)}</th>)}
                    <th>Mean</th><th>Band</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <tr key={r.student_id}>
                      <td style={{ fontWeight: 800 }}>{r.position}</td>
                      <td>{r.admission_number || "—"}</td>
                      <td className="name" style={{ fontWeight: 600 }}>
                        {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.name || "—"}
                      </td>
                      {scope === "overall" && <td>{r.class_name || "—"}</td>}
                      <td style={{ fontSize: 11 }}>
                        {r.stream || String(r.stream_label || "").replace(r.class_name || "", "").trim() || "—"}
                      </td>
                      {subjects.map((s) => <td key={s}><ScoreCell cell={r.subjects?.[s]} /></td>)}
                      <td style={{ fontWeight: 800 }}>{Number(r.average).toFixed(1)}</td>
                      <td><span style={chip(r.overall_sub_level || r.overall_grade)}>{r.overall_sub_level || r.overall_grade || "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={scope === "overall" ? 5 : 4} style={{ textAlign: "left", paddingLeft: 8 }}>Mean</td>
                    {subjects.map((s) => (
                      <td key={s}>
                        {subjectMeans[s] != null ? (
                          <>
                            <div>{subjectMeans[s]}</div>
                            <div style={chip(calculateCbcSubLevel(subjectMeans[s])?.grade)}>{calculateCbcSubLevel(subjectMeans[s])?.grade}</div>
                          </>
                        ) : "—"}
                      </td>
                    ))}
                    <td>{classMean ?? "—"}</td>
                    <td>{classMean != null ? <span style={chip(calculateCbcSubLevel(classMean)?.grade)}>{calculateCbcSubLevel(classMean)?.grade}</span> : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="merit-cards no-print">
              {ranked.map((r) => (
                <div key={r.student_id} className="merit-card">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <strong>#{r.position} {[r.first_name, r.last_name].filter(Boolean).join(" ")}</strong>
                    <span style={chip(r.overall_sub_level || r.overall_grade)}>
                      {Number(r.average).toFixed(1)}% {r.overall_sub_level || r.overall_grade}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>
                    {r.admission_number} · {r.class_name}{r.stream ? ` · ${r.stream}` : ""}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                    {subjects.map((s) => {
                      const c = r.subjects?.[s];
                      return (
                        <div key={s} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--color-text-muted)" }}>{shortSub(s)}</span>
                          <span style={{ fontWeight: 600 }}>{c ? `${Math.round(c.percentage)} ${c.sub_level || ""}` : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

MeritListPage.propTypes = { auth: PropTypes.object, toast: PropTypes.func };
