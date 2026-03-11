import PropTypes from "prop-types";
import { C } from "../lib/theme";
import Btn from "./Btn";

// ── Pager ─────────────────────────────────────────────────────────────────────
export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:14 }}>
      <button
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        style={{ padding:"5px 13px", borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color: page<=1 ? C.textMuted : C.textSub, cursor: page<=1 ? "default" : "pointer", fontSize:13 }}>
        ‹
      </button>
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        const p = pages <= 7 ? i+1 : i+1; // simple for now
        const active = p === page;
        return (
          <button key={p} onClick={() => setPage(p)} style={{
            padding:"5px 11px", borderRadius:8, fontSize:13, cursor:"pointer",
            border:`1px solid ${active ? C.accent : C.border}`,
            background: active ? C.accentGlow : C.card,
            color: active ? C.accent : C.textSub,
            fontWeight: active ? 700 : 400,
          }}>{p}</button>
        );
      })}
      <button
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
        style={{ padding:"5px 13px", borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color: page>=pages ? C.textMuted : C.textSub, cursor: page>=pages ? "default" : "pointer", fontSize:13 }}>
        ›
      </button>
    </div>
  );
}
Pager.propTypes = { page:PropTypes.number.isRequired, pages:PropTypes.number.isRequired, setPage:PropTypes.func.isRequired };

// ── Msg ───────────────────────────────────────────────────────────────────────
export function Msg({ text, tone = "muted" }) {
  const color = tone === "error" ? C.rose : tone === "success" ? C.green : tone === "warn" ? C.amber : C.textMuted;
  return (
    <div style={{ color, fontSize:13, padding:"10px 0", display:"flex", alignItems:"center", gap:6 }}>
      {tone === "error" && <span>✕</span>}
      {tone === "success" && <span>✓</span>}
      {tone === "warn" && <span>⚠</span>}
      {text}
    </div>
  );
}
Msg.propTypes = { text:PropTypes.string.isRequired, tone:PropTypes.string };

// ── Toasts ────────────────────────────────────────────────────────────────────
export function Toasts({ items, remove }) {
  return (
    <div style={{ position:"fixed", right:18, bottom:18, zIndex:3000, display:"grid", gap:8, minWidth:260 }}>
      {items.map(t => {
        const isErr = t.type === "error";
        const color = isErr ? C.rose : C.green;
        return (
          <div key={t.id} style={{
            background: C.card,
            border:`1px solid ${color}55`,
            borderLeft:`3px solid ${color}`,
            borderRadius:11,
            padding:"11px 14px",
            boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
            display:"flex", alignItems:"flex-start", gap:10,
          }}>
            <span style={{ fontSize:15, marginTop:1 }}>{isErr ? "✕" : "✓"}</span>
            <div style={{ flex:1 }}>
              <div style={{ color:C.text, fontSize:13, fontWeight:500 }}>{t.text}</div>
            </div>
            <button onClick={() => remove(t.id)} style={{
              background:"transparent", border:"none", color:C.textMuted,
              cursor:"pointer", fontSize:16, lineHeight:1, padding:0, marginTop:-1,
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
Toasts.propTypes = { items:PropTypes.array.isRequired, remove:PropTypes.func.isRequired };

// ── Forbidden ─────────────────────────────────────────────────────────────────
export const Forbidden = () => (
  <div style={{
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    minHeight:320, gap:16,
  }}>
    <div style={{
      width:72, height:72, borderRadius:20, background:C.roseDim,
      border:`1px solid ${C.rose}44`, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:32,
    }}>🔒</div>
    <div style={{ textAlign:"center" }}>
      <div style={{ fontWeight:800, fontSize:20, color:C.rose, marginBottom:6 }}>Access Denied</div>
      <div style={{ color:C.textSub, fontSize:14 }}>You don't have permission to view this page.</div>
    </div>
  </div>
);

// ── NotFound ──────────────────────────────────────────────────────────────────
export const NotFound = () => (
  <div style={{
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    minHeight:320, gap:16,
  }}>
    <div style={{
      width:72, height:72, borderRadius:20, background:C.amberDim,
      border:`1px solid ${C.amber}44`, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:32,
    }}>🔍</div>
    <div style={{ textAlign:"center" }}>
      <div style={{ fontWeight:800, fontSize:20, color:C.amber, marginBottom:6 }}>Page Not Found</div>
      <div style={{ color:C.textSub, fontSize:14 }}>This page doesn't exist.</div>
    </div>
  </div>
);

// ── pager helper (fn) ─────────────────────────────────────────────────────────
const PAGE_SIZE = 20;
export function pager(items, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const rows  = items.slice((page - 1) * size, page * size);
  return { pages, rows };
}

// ── csv export helper ─────────────────────────────────────────────────────────
export function csv(filename, headers, rowData) {
  const escape = v => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rowData].map(row => row.map(escape).join(","));
  const blob  = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}