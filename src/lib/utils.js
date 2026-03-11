export const money = v => `KSh ${Number(v || 0).toLocaleString()}`;
export const genId = () => Date.now() + Math.floor(Math.random() * 10000);

export const PAGE_SIZE = 8;

export const pager = (arr, p) => ({
  pages: Math.max(1, Math.ceil(arr.length / PAGE_SIZE)),
  rows: arr.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE),
});

export function csv(name, headers, rows) {
  const esc = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const content = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  a.download = name;
  a.click();
}
