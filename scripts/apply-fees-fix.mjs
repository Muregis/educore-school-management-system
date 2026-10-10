#!/usr/bin/env node
import fs from "fs";

const path = "src/pages/FeesPage.jsx";
let t = fs.readFileSync(path, "utf8");
let n = 0;

function once(label, oldStr, newStr) {
  if (!t.includes(oldStr)) {
    console.warn("SKIP", label);
    return;
  }
  t = t.replace(oldStr, newStr);
  n++;
  console.log("OK", label);
}

once(
  "term-field",
  `paidBy:      p.paid_by          ?? p.paidBy    ?? "",
    admissionNumber:`,
  `paidBy:      p.paid_by          ?? p.paidBy    ?? "",
    term:        p.term             ?? "",
    admissionNumber:`
);

once(
  "page-reset",
  `  const [availableClasses, setAvailableClasses] = useState([]);

  useEffect(() => {
    if (!auth?.token) return;
    apiFetch("/classes", { token: auth.token })`,
  `  const [availableClasses, setAvailableClasses] = useState([]);

  useEffect(() => { setPage(1); }, [selectedTerm, filterClass, filterDate, recordSearch]);

  useEffect(() => {
    if (!auth?.token) return;
    apiFetch("/classes", { token: auth.token })`
);

once(
  "reload-sync",
  `  const reloadPayments = useCallback(async () => {
    if (!auth?.token || !term) return;
    const data = await apiFetch(\`/payments?term=\${encodeURIComponent(term)}\`, { token: auth.token });
    setPayments((data || []).map(normalisePayment));
  }, [auth, setPayments, term]);

  useEntitySync({ url: \`/payments?term=\${encodeURIComponent(term)}\`, token: auth?.token, setter: setPayments, transform: (data) => (data || []).map(normalisePayment), dependencies: [term], enabled: !!term });`,
  `  const paymentsTermParam = selectedTerm === "all"
    ? null
    : (selectedTerm === "current" ? (term || null) : selectedTerm);

  const reloadPayments = useCallback(async () => {
    if (!auth?.token) return;
    if (selectedTerm === "current" && !term) return;
    const qs = paymentsTermParam
      ? \`?term=\${encodeURIComponent(paymentsTermParam)}\`
      : "";
    const data = await apiFetch(\`/payments\${qs}\`, { token: auth.token });
    setPayments((data || []).map(normalisePayment));
  }, [auth, setPayments, term, selectedTerm, paymentsTermParam]);

  const paymentsSyncUrl = paymentsTermParam
    ? \`/payments?term=\${encodeURIComponent(paymentsTermParam)}\`
    : "/payments";
  useEntitySync({
    url: paymentsSyncUrl,
    token: auth?.token,
    setter: setPayments,
    transform: (data) => (data || []).map(normalisePayment),
    dependencies: [paymentsTermParam, selectedTerm],
    enabled: selectedTerm !== "current" || !!term,
  });`
);

const filterStart = t.indexOf("const filteredPayments = normalisedPayments.filter");
const filterEnd = t.indexOf("const { pages, rows }", filterStart);
if (filterStart >= 0 && filterEnd > filterStart) {
  const newFilter = `const filteredPayments = normalisedPayments.filter(p => {
    const matchClass = filterClass === "all" || p.className === filterClass;
    const matchDate = filterDate === "all" || (filterDate === "today" && isTodayPayment(p));
    const matchTerm = selectedTerm === "all" || !p.term || p.term === displayTerm;
    const q = (recordSearch || "").trim().toLowerCase();
    const matchSearch = !q || [
      p.studentName, p.className, p.reference, p.method, p.paidBy,
      p.admissionNumber, p.parentPhone, p.term, String(p.studentId || "")
    ].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    return matchClass && matchDate && matchTerm && matchSearch;
  });
  `;
  t = t.slice(0, filterStart) + newFilter + t.slice(filterEnd);
  n++;
  console.log("OK filter");
} else {
  console.warn("SKIP filter");
}

once(
  "buttons",
  `{canEdit && tab==="payments" && <Button onClick={() => setShowPayment(true)}>+ Record Payment</Button>}
            {canEdit && tab==="payments" && <Button variant="secondary" onClick={() => setShowRecordPaymentModal(true)}>📝 Manual Payment</Button>}`,
  `{canEdit && tab==="payments" && <Button onClick={() => setShowRecordPaymentModal(true)}>+ Manual Payment</Button>}`
);

once(
  "actions",
  `                  <div key="actions" style={{ display: "flex", gap: "var(--space-2)" }}>
                    {["admin", "director", "superadmin"].includes(auth?.role) && (
                      <Button size="sm" variant="secondary" onClick={() => setEditingPayment({
                        id: p.id,
                        studentId: p.studentId,
                        studentName: p.studentName,
                        className: p.className,
                        amount: p.amount,
                        feeType: p.feeType,
                        method: p.method,
                        date: p.date,
                        status: p.status,
                        reference: p.reference,
                        paidBy: p.paidBy
                      })}>Edit</Button>
                    )}
                    {canDeletePayments && (
                      <Button size="sm" variant="danger" onClick={() => delPayment(p.id)}>Delete</Button>
                    )}
                    {!["admin", "director", "superadmin"].includes(auth?.role) && !canDeletePayments && "—"}
                  </div>`,
  `                  <div key="actions" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setReceipt({
                        studentName: p.studentName,
                        amount: p.amount,
                        reference: p.reference || p.id,
                        method: p.method,
                        date: p.date,
                        receivedBy: p.paidBy || auth?.name || auth?.email || "—",
                        term: p.term || displayTerm,
                      });
                      setShowReceipt(true);
                    }}>🖨️ Receipt</Button>
                    {["admin", "director", "superadmin"].includes(auth?.role) && (
                      <Button size="sm" variant="secondary" onClick={() => setEditingPayment({
                        id: p.id,
                        studentId: p.studentId,
                        studentName: p.studentName,
                        className: p.className,
                        amount: p.amount,
                        feeType: p.feeType,
                        method: p.method,
                        date: p.date,
                        status: p.status,
                        reference: p.reference,
                        paidBy: p.paidBy
                      })}>Edit</Button>
                    )}
                    {canDeletePayments && (
                      <Button size="sm" variant="danger" onClick={() => delPayment(p.id)}>Delete</Button>
                    )}
                  </div>`
);

if (n < 4) {
  console.error("Too few patches applied:", n);
  process.exit(1);
}
if (!t.includes("paymentsTermParam") || t.includes("+ Record Payment") || !t.includes("🖨️ Receipt")) {
  console.error("Marker check failed");
  process.exit(1);
}
fs.writeFileSync(path, t);
console.log("Wrote", path, "patches=", n);
