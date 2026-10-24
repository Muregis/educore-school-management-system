import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";
import { useCurrentTerm } from "../hooks/useCurrentTerm";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";
import StatCard from "../components/ui/StatCard";

const EXPENSE_CATEGORIES = [
  "Teachers Salary",
  "Rent",
  "Utilities",
  "Daily Use",
  "Kitchen",
  "Transport",
  "Supplies",
  "Maintenance",
  "Security",
  "Repairs",
  "Technology",
  "Marketing",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "M-Pesa", "Cheque", "Card", "Payroll", "Other"];

const blankForm = (startDate = null) => ({
  expenseDate: startDate || new Date().toISOString().slice(0, 10),
  category: "Daily Use",
  itemName: "",
  description: "",
  amount: "",
  paymentMethod: "Cash",
  vendorName: "",
  paidToName: "",
  purpose: "",
  referenceNumber: "",
  notes: "",
});

function toneForCategory(category) {
  const key = String(category || "").toLowerCase();
  if (key.includes("salary")) return "warning";
  if (key.includes("rent")) return "danger";
  if (key.includes("daily")) return "info";
  if (key.includes("utility")) return "secondary";
  return "success";
}

export default function ExpendituresPage({ auth, canEdit, toast }) {
  const { term: currentTermName, startDate: currentTermStart, endDate: currentTermEnd } = useCurrentTerm(auth);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState("current");
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blankForm(currentTermStart));

  useEffect(() => {
    if (!auth?.token) return;
    apiFetch("/academic/terms", { token: auth.token })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data ?? [];
        setTerms(list);
      })
      .catch((err) => {
        console.warn("Failed to load academic terms:", err);
      });
  }, [auth?.token]);

  // Update default expense date when term changes (only when modal is closed)
  useEffect(() => {
    if (!showModal && !editingExpense) {
      setForm((prev) => ({ ...prev, expenseDate: currentTermStart || new Date().toISOString().slice(0, 10) }));
    }
  }, [currentTermStart, showModal, editingExpense]);

  const loadData = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const [manualExpenses, summaryResponse] = await Promise.all([
        apiFetch("/expenditures", { token: auth.token }),
        apiFetch("/expenditures/summary", { token: auth.token }),
      ]);
      setExpenses(manualExpenses || []);
      setSummary(summaryResponse || null);
    } catch (error) {
      toast(error.message || "Failed to load expenditures", "error");
    } finally {
      setLoading(false);
    }
  }, [auth?.token, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeTermInfo = useMemo(() => {
    if (selectedTerm === "all") {
      return { name: "All Terms", from: null, to: null };
    }
    if (selectedTerm === "current") {
      const active = terms.find((t) => t.status === "active" || t.is_current);
      return {
        name: currentTermName || active?.term_name || active?.name || "Current Term",
        from: currentTermStart || active?.start_date || null,
        to: currentTermEnd || active?.end_date || null,
      };
    }
    const found = terms.find((t) => String(t.term_id ?? t.id) === String(selectedTerm));
    if (found) {
      return {
        name: found.term_name || found.name || "Selected Term",
        from: found.start_date || null,
        to: found.end_date || null,
      };
    }
    return { name: "Term", from: null, to: null };
  }, [selectedTerm, terms, currentTermName, currentTermStart, currentTermEnd]);

  const termFilteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.expense_date;
      if (!d) return true;
      if (activeTermInfo.from && d < activeTermInfo.from) return false;
      if (activeTermInfo.to && d > activeTermInfo.to) return false;
      return true;
    });
  }, [expenses, activeTermInfo]);

  const filteredExpenses = useMemo(() => {
    return termFilteredExpenses.filter((expense) => {
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const haystack = [
        expense.item_name,
        expense.vendor_name,
        expense.paid_to_name,
        expense.released_by_name,
        expense.purpose,
        expense.reference_number,
        expense.description,
      ].join(" ").toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [termFilteredExpenses, categoryFilter, search]);

  const termManualTotal = useMemo(() => {
    return termFilteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [termFilteredExpenses]);

  const termPayrollTotal = useMemo(() => {
    const recent = summary?.recent || [];
    const payrollItems = recent.filter((r) => r.source_type === "payroll");
    if (selectedTerm === "all") {
      return summary?.totals?.payroll || 0;
    }
    return payrollItems
      .filter((item) => {
        const d = item.expense_date;
        if (!d) return true;
        if (activeTermInfo.from && d < activeTermInfo.from) return false;
        if (activeTermInfo.to && d > activeTermInfo.to) return false;
        return true;
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [summary, selectedTerm, activeTermInfo]);

  const totalTermExpenditures = useMemo(() => {
    if (selectedTerm === "all") {
      return summary?.totals?.total || (termManualTotal + termPayrollTotal);
    }
    return termManualTotal + termPayrollTotal;
  }, [selectedTerm, summary, termManualTotal, termPayrollTotal]);

  const termCategories = useMemo(() => {
    if (selectedTerm === "all" && summary?.byCategory) {
      return summary.byCategory;
    }
    const catMap = new Map();
    termFilteredExpenses.forEach((e) => {
      const k = e.category || "Other";
      catMap.set(k, (catMap.get(k) || 0) + Number(e.amount || 0));
    });
    return Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedTerm, summary, termFilteredExpenses]);

  const currentMonthTotal = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return (summary?.recent || [])
      .filter((item) => String(item.expense_date || "").startsWith(thisMonth))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [summary]);

  const openCreate = () => {
    setEditingExpense(null);
    setForm(blankForm(activeTermInfo.from));
    setShowModal(true);
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setForm({
      expenseDate: expense.expense_date || new Date().toISOString().slice(0, 10),
      category: expense.category || "Daily Use",
      itemName: expense.item_name || "",
      description: expense.description || "",
      amount: String(expense.amount || ""),
      paymentMethod: expense.payment_method || "Cash",
      vendorName: expense.vendor_name || "",
      paidToName: expense.paid_to_name || "",
      purpose: expense.purpose || "",
      referenceNumber: expense.reference_number || "",
      notes: expense.notes || "",
    });
    setShowModal(true);
  };

  const saveExpense = async () => {
    const amount = Number(form.amount || 0);
    if (!form.expenseDate || !form.category || !form.itemName.trim() || !amount) {
      toast("Date, category, item name and amount are required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        expenseDate: form.expenseDate,
        category: form.category,
        itemName: form.itemName.trim(),
        description: form.description.trim(),
        amount,
        paymentMethod: form.paymentMethod,
        vendorName: form.vendorName.trim(),
        paidToName: form.paidToName.trim(),
        purpose: form.purpose.trim(),
        referenceNumber: form.referenceNumber.trim(),
        notes: form.notes.trim(),
      };

      if (editingExpense) {
        await apiFetch(`/expenditures/${editingExpense.expenditure_id}`, {
          method: "PUT",
          token: auth.token,
          body: payload,
        });
        toast("Expense updated", "success");
      } else {
        await apiFetch("/expenditures", {
          method: "POST",
          token: auth.token,
          body: payload,
        });
        toast("Expense recorded", "success");
      }

      setShowModal(false);
      setEditingExpense(null);
      setForm(blankForm(activeTermInfo.from));
      await loadData();
    } catch (error) {
      toast(error.message || "Failed to save expense", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete expense "${expense.item_name}"?`)) return;
    try {
      await apiFetch(`/expenditures/${expense.expenditure_id}`, {
        method: "DELETE",
        token: auth.token,
      });
      toast("Expense deleted", "success");
      await loadData();
    } catch (error) {
      toast(error.message || "Failed to delete expense", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
            Expenditures
          </div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Track school running costs like rent, daily use, utilities, and view salary costs from paid payroll.
          </div>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            + Record Expense
          </Button>
        )}
      </div>

      <div className="ec-kpi-grid">
        <StatCard
          label={selectedTerm === "all" ? "Total Expenses" : `${activeTermInfo.name} Expenses`}
          value={money(totalTermExpenditures)}
          tone="danger"
          hint={selectedTerm === "all" ? "Manual expenses plus paid payroll" : `Operating costs for ${activeTermInfo.name}`}
        />
        <StatCard
          label="Payroll Costs"
          value={money(termPayrollTotal)}
          tone="warning"
          hint={selectedTerm === "all" ? `${summary?.totals?.payrollEntries || 0} paid payslips` : `Payroll in ${activeTermInfo.name}`}
        />
        <StatCard
          label="Manual Expenses"
          value={money(termManualTotal)}
          tone="info"
          hint={`${termFilteredExpenses.length} items recorded`}
        />
        <StatCard
          label="This Month"
          value={money(currentMonthTotal)}
          tone="success"
          hint="All expenses dated this month"
        />
      </div>

      <div className="ec-stack-grid" style={{ gap: "var(--space-4)" }}>
        <Card style={{ padding: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)" }}>Monthly Expense Trend</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>Payroll is included automatically once marked paid in HR.</div>
          </div>

          {!summary?.monthlyTrend?.length ? (
            <EmptyState title="No expenditure data" description="Monthly expense bars will appear once expenses or payroll payments exist." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {summary.monthlyTrend.map((month) => {
                const max = Math.max(...summary.monthlyTrend.map((item) => Number(item.total || 0)), 1);
                const width = (Number(month.total || 0) / max) * 100;
                return (
                  <div key={month.month} className="ec-preserve-grid" style={{ display: "grid", gridTemplateColumns: "minmax(60px, 80px) 1fr minmax(70px, 100px)", gap: "var(--space-2)", alignItems: "center" }}>
                    <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", fontWeight: 600 }}>
                      {month.label}
                    </div>
                    <div style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "999px", height: "16px", overflow: "hidden" }}>
                      <div style={{ width: `${width}%`, height: "100%", background: "linear-gradient(90deg, var(--color-danger), var(--color-warning))", borderRadius: "999px" }} />
                    </div>
                    <div style={{ textAlign: "right", color: "var(--color-text-primary)", fontWeight: 700, fontSize: "12px" }}>
                      {money(month.total)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: "var(--space-4)" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "var(--space-3)" }}>
            Top Categories {selectedTerm !== "all" && activeTermInfo.name ? `(${activeTermInfo.name})` : ""}
          </div>

          {!termCategories.length ? (
            <EmptyState title="No categories yet" description="Category totals will appear after recording expenses." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {termCategories.slice(0, 8).map((item) => (
                <div key={item.category} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                  <Badge text={item.category} tone={toneForCategory(item.category)} />
                  <div style={{ color: "var(--color-text-primary)", fontWeight: 700 }}>
                    {money(item.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card style={{ padding: "var(--space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)" }}>
            Manual Expense Records
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", flex: "1 1 420px" }}>
            <div style={{ flex: "1 1 150px", minWidth: 130 }}>
              <Select
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                options={[
                  { value: "current", label: currentTermName ? `${currentTermName} (Active)` : "Current Term" },
                  ...terms.map((t) => ({
                    value: String(t.term_id ?? t.id),
                    label: `${t.term_name || t.name}${t.academic_year ? ` · ${t.academic_year}` : ""}`,
                  })),
                  { value: "all", label: "All Terms (Full Year)" },
                ]}
              />
            </div>
            <div style={{ flex: "1 1 140px", minWidth: 120 }}>
              <Select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                options={[
                  { value: "all", label: "All categories" },
                  ...EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
                ]}
              />
            </div>
            <div style={{ flex: "1 1 160px", minWidth: 130 }}>
              <Input
                placeholder="Search item, payee, released by..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </div>

        <Table
          headers={["Date", "Category", "Paid To", "Purpose", "Released By", "Method", "Amount", "Reference", "Actions"]}
          loading={loading}
          data={filteredExpenses.map((expense) => [
            <span key="date" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{expense.expense_date}</span>,
            <Badge key="category" text={expense.category} tone={toneForCategory(expense.category)} />,
            <div key="payee">
              <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{expense.paid_to_name || expense.vendor_name || "-"}</div>
              {expense.vendor_name && expense.paid_to_name && expense.vendor_name !== expense.paid_to_name && (
                <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "2px" }}>{expense.vendor_name}</div>
              )}
            </div>,
            <div key="purpose">
              <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{expense.purpose || expense.item_name}</div>
              {expense.description && (
                <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "2px" }}>{expense.description}</div>
              )}
            </div>,
            <div key="releasedBy" style={{ color: "var(--color-text-secondary)" }}>
              <div>{expense.released_by_name || "System"}</div>
              {expense.source_type === "payroll" && (
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Payroll release</div>
              )}
            </div>,
            <span key="method" style={{ color: "var(--color-text-secondary)" }}>{expense.payment_method || "-"}</span>,
            <span key="amount" style={{ color: "var(--color-danger)", fontWeight: 800 }}>{money(expense.amount)}</span>,
            <span key="ref" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{expense.reference_number || "-"}</span>,
            canEdit ? (
              <div key="actions" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Button size="sm" variant="secondary" onClick={() => openEdit(expense)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => deleteExpense(expense)}>Delete</Button>
              </div>
            ) : (
              "View only"
            ),
          ])}
          renderMobileCard={(row, idx) => {
            const expense = filteredExpenses[idx];
            if (!expense) return null;
            return (
              <div key={expense.expenditure_id || idx} style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text-primary)" }}>
                      {expense.purpose || expense.item_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: 2 }}>
                      {expense.paid_to_name || expense.vendor_name || "—"} · {expense.expense_date}
                    </div>
                  </div>
                  <Badge text={expense.category} tone={toneForCategory(expense.category)} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-bg-base)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    {expense.payment_method || "Cash"}
                    {expense.reference_number ? ` · ${expense.reference_number}` : ""}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--color-danger)" }}>
                    {money(expense.amount)}
                  </div>
                </div>

                {expense.description && (
                  <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {expense.description}
                  </div>
                )}

                {canEdit && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--color-border)" }}>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(expense)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteExpense(expense)}>Delete</Button>
                  </div>
                )}
              </div>
            );
          }}
          emptyState={<EmptyState title="No manual expenses found" description="Record rent, utility bills, classroom supplies, and other school running costs here with clear accountability." />}
        />
      </Card>

      <Card style={{ padding: "var(--space-4)" }}>
        <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "var(--space-3)" }}>
          Recent Expense Activity
        </div>

        <Table
          headers={["Date", "Source", "Category", "Paid To", "Purpose", "Released By", "Amount", "Method"]}
          loading={loading}
          data={(summary?.recent || []).slice(0, 12).map((item) => [
            <span key="date" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.expense_date}</span>,
            <Badge key="source" text={item.source_label} tone={item.source_type === "payroll" ? "warning" : "info"} />,
            <Badge key="category" text={item.category} tone={toneForCategory(item.category)} />,
            <span key="paidTo" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.paid_to_name || item.vendor_name || "-"}</span>,
            <div key="item">
              <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.purpose || item.item_name}</div>
              {item.description && (
                <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "2px" }}>{item.description}</div>
              )}
            </div>,
            <span key="releasedBy" style={{ color: "var(--color-text-secondary)" }}>{item.released_by_name || "System"}</span>,
            <span key="amount" style={{ color: "var(--color-danger)", fontWeight: 800 }}>{money(item.amount)}</span>,
            <span key="method" style={{ color: "var(--color-text-secondary)" }}>{item.payment_method || "-"}</span>,
          ])}
          renderMobileCard={(row, idx) => {
            const item = (summary?.recent || [])[idx];
            if (!item) return null;
            return (
              <div key={item.id || idx} style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text-primary)" }}>
                      {item.purpose || item.item_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: 2 }}>
                      {item.paid_to_name || item.vendor_name || "—"} · {item.expense_date}
                    </div>
                  </div>
                  <Badge text={item.category} tone={toneForCategory(item.category)} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Badge text={item.source_label} tone={item.source_type === "payroll" ? "warning" : "info"} />
                  <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--color-danger)" }}>
                    {money(item.amount)}
                  </div>
                </div>
              </div>
            );
          }}
          emptyState={<EmptyState title="No expense activity yet" description="Paid payroll and recorded expenses will appear here." />}
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingExpense ? "Edit Expense" : "Record Expenditure"}
        maxWidth="760px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={saveExpense} loading={saving}>{editingExpense ? "Update Expense" : "Save Expense"}</Button>
          </>
        }
      >
        <div className="ec-form-grid ec-form-grid-2">
          <Input
            label="Expense Date"
            type="date"
            value={form.expenseDate}
            onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))}
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            options={EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category }))}
          />
          <Input
            label="Item Name"
            value={form.itemName}
            onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))}
            placeholder="e.g. May rent, Chalk supply, Generator fuel"
          />
          <Input
            label="Amount (KES)"
            type="number"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="0"
          />
          <Select
            label="Payment Method"
            value={form.paymentMethod}
            onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
            options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
          />
          <Input
            label="Vendor / Payee"
            value={form.vendorName}
            onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))}
            placeholder="e.g. Landlord, KPLC, Supplier name"
          />
          <Input
            label="Paid To"
            value={form.paidToName}
            onChange={(event) => setForm((current) => ({ ...current, paidToName: event.target.value }))}
            placeholder="Person or organisation receiving funds"
          />
          <Input
            label="Purpose"
            value={form.purpose}
            onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
            placeholder="What the money was released for"
          />
          <Input
            label="Reference Number"
            value={form.referenceNumber}
            onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))}
            placeholder="Receipt, transaction, or cheque number"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Short explanation of the expense"
          />
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: "var(--space-2)" }}>
            <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional internal notes"
              style={{
                width: "100%",
                minHeight: "96px",
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3)",
                color: "var(--color-text-primary)",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

ExpendituresPage.propTypes = {
  auth: PropTypes.object,
  canEdit: PropTypes.bool,
  toast: PropTypes.func.isRequired,
};
