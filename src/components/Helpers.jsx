import PropTypes from "prop-types";
import { C } from "../lib/theme";
import Btn from "./Btn";



// component used for page navigation
export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
      <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Prev
      </Btn>
      <div style={{ color: C.textSub, alignSelf: "center", fontSize: 12 }}>
        {page}/{pages}
      </div>
      <Btn variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        Next
      </Btn>
    </div>
  );
}
Pager.propTypes = { page: PropTypes.number.isRequired, pages: PropTypes.number.isRequired, setPage: PropTypes.func.isRequired };

export function Msg({ text, tone = "muted" }) {
  return (
    <div
      style={{
        color: tone === "error" ? C.rose : C.textMuted,
        fontSize: 12,
        padding: "10px 0",
      }}
    >
      {text}
    </div>
  );
}
Msg.propTypes = { text: PropTypes.string.isRequired, tone: PropTypes.string };

export function Toasts({ items, remove }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 3000,
        display: "grid",
        gap: 8,
      }}
    >
      {items.map(t => (
        <div
          key={t.id}
          style={{
            background: C.card,
            border: `1px solid ${t.type === "error" ? C.rose : C.green}66`,
            borderRadius: 10,
            padding: "10px 12px",
            minWidth: 230,
          }}
        >
          <div style={{ color: C.text, fontSize: 13 }}>{t.text}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <Btn variant="ghost" onClick={() => remove(t.id)}>
              Close
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
}
Toasts.propTypes = { items: PropTypes.array.isRequired, remove: PropTypes.func.isRequired };

export const Forbidden = () => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
    <div style={{ color: C.rose, fontWeight: 800 }}>403 Forbidden</div>
    <div style={{ color: C.textSub }}>You do not have permission to access this page.</div>
  </div>
);

export const NotFound = () => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
    <div style={{ color: C.amber, fontWeight: 800 }}>404 Not Found</div>
    <div style={{ color: C.textSub }}>Page not found.</div>
  </div>
);

const PAGE_SIZE = 20;

/**
 * Returns { pages, rows } for the given array and current page (1-indexed).
 */
export function pager(items, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const rows  = items.slice((page - 1) * size, page * size);
  return { pages, rows };
}

/**
 * Triggers a CSV file download in the browser.
 * @param {string}   filename  e.g. "results.csv"
 * @param {string[]} headers   Column header labels
 * @param {Array[]}  rowData   Array of row arrays (values are auto-escaped)
 */
export function csv(filename, headers, rowData) {
  const escape = v => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers, ...rowData].map(row => row.map(escape).join(","));
  const blob  = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href      = url;
  a.download  = filename;
  a.click();
  URL.revokeObjectURL(url);
}