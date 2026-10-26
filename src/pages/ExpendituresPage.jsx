import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";
import { useCurrentTerm } from "../hooks/useCurrentTerm";
import { printDocument } from "../utils/printDocument";
import { csv } from "../components/Helpers";

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
  "Daily Use",
  "Petty Cash",
  "Petty Cash Top-up",
  "Kitchen",
  "Supplies",
  "Transport",
  "Maintenance",
  "Repairs",
  "Utilities",
  "Teachers Salary",
  "Rent",
  "Security",
  "Technology",
  "Marketing",
  "Other",
];

const PAYMENT_METHODS = [
  "Cash",
  "Petty Cash",
  "M-Pesa",
  "Bank Transfer",
  "Cheque",
  "Card",
  "Payroll",
  "Other",
];

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
  if (key.includes("top-up") || key.includes("topup") || key.includes("float")) return "primary";
  if (key.includes("petty")) return "info";
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
  const [activeTab, setActiveTab] = useState("expenses"); // 'expenses' | 'petty-cash'
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [topUpSaving, setTopUpSaving] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blankForm(currentTermStart));
  const [topUpForm, setTopUpForm] = useState({
    amount: "",
    date: currentTermStart || new Date().toISOString().slice(0, 10),
    custodianName: "",
    paymentMethod: "Cash",
    referenceNumber: "",
    notes: "",
  });

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
    if (!showTopUpModal) {
      setTopUpForm((prev) => ({ ...prev, date: currentTermStart || new Date().toISOString().slice(0, 10) }));
    }
  }, [currentTermStart, showModal, showTopUpModal, editingExpense]);

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
    const currentYear = new Date().getFullYear();
    const getTermRangeFallback = (termName, year = currentYear) => {
      const name = String(termName || "").toLowerCase();
      if (name.includes("semester 1")) return { from: `${year}-01-12`, to: `${year}-05-22` };
      if (name.includes("semester 2")) return { from: `${year}-06-08`, to: `${year}-10-23` };
      if (name.includes("trimester 3")) return { from: `${year}-11-02`, to: `${year}-12-18` };
      if (name.includes("autumn")) return { from: `${year}-09-01`, to: `${year}-12-15` };
      if (name.includes("spring")) return { from: `${year + 1}-01-08`, to: `${year + 1}-03-28` };
      if (name.includes("summer")) return { from: `${year + 1}-04-15`, to: `${year + 1}-07-05` };
      if (name.includes("term 2")) return { from: `${year}-05-05`, to: `${year}-08-01` };
      if (name.includes("term 3")) return { from: `${year}-09-01`, to: `${year}-11-28` };
      return { from: `${year}-01-06`, to: `${year}-04-04` };
    };

    if (selectedTerm === "current") {
      const active = terms.find((t) => t.status === "active" || t.is_current);
      const name = currentTermName || active?.term_name || active?.name || "Term 1";
      const y = Number(active?.academic_year) || currentYear;
      const fallback = getTermRangeFallback(name, y);
      return {
        name: currentTermName || active?.term_name || active?.name || "Current Term",
        from: currentTermStart || active?.start_date || fallback.from,
        to: currentTermEnd || active?.end_date || fallback.to,
      };
    }

    const found = terms.find((t) => String(t.term_id ?? t.id) === String(selectedTerm) || (t.term_name || t.name) === selectedTerm);
    if (found) {
      const name = found.term_name || found.name || selectedTerm;
      const y = Number(found.academic_year) || currentYear;
      const fallback = getTermRangeFallback(name, y);
      return {
        name,
        from: found.start_date || fallback.from,
        to: found.end_date || fallback.to,
      };
    }

    const fallback = getTermRangeFallback(selectedTerm, currentYear);
    return { name: selectedTerm, from: fallback.from, to: fallback.to };
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

  // Operational manual expenses exclude float top-ups so internal transfers aren't double-counted
  const termManualTotal = useMemo(() => {
    return termFilteredExpenses
      .filter((e) => e.category !== "Petty Cash Top-up")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
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
    termFilteredExpenses
      .filter((e) => e.category !== "Petty Cash Top-up")
      .forEach((e) => {
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

  // =====================================================
  // Petty Cash Computations & Metrics
  // =====================================================
  const floatTopUps = useMemo(() => {
    return expenses.filter(
      (e) => e.category === "Petty Cash Top-up" || e.category === "Petty Cash Float"
    );
  }, [expenses]);

  const pettyCashVouchers = useMemo(() => {
    return expenses.filter((e) => {
      const m = String(e.payment_method || "").toLowerCase();
      return m === "petty cash" || m === "petty_cash" || (e.category === "Petty Cash" && e.category !== "Petty Cash Top-up");
    });
  }, [expenses]);

  const totalFloat = useMemo(() => {
    return floatTopUps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [floatTopUps]);

  const totalPettyCashSpent = useMemo(() => {
    return pettyCashVouchers.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [pettyCashVouchers]);

  const pettyCashBalance = totalFloat - totalPettyCashSpent;

  // Filtered petty cash records (top-ups + vouchers) for the Petty Cash Book tab
  const filteredPettyCashRecords = useMemo(() => {
    return termFilteredExpenses
      .filter((e) => {
        const isTopUp = e.category === "Petty Cash Top-up" || e.category === "Petty Cash Float";
        const m = String(e.payment_method || "").toLowerCase();
        const isVoucher = m === "petty cash" || m === "petty_cash" || (e.category === "Petty Cash" && !isTopUp);
        if (!isTopUp && !isVoucher) return false;

        const haystack = [
          e.item_name,
          e.vendor_name,
          e.paid_to_name,
          e.released_by_name,
          e.purpose,
          e.reference_number,
          e.description,
          e.category,
        ].join(" ").toLowerCase();
        return !search.trim() || haystack.includes(search.trim().toLowerCase());
      })
      .map((item) => {
        const isTopUp = item.category === "Petty Cash Top-up" || item.category === "Petty Cash Float";
        return {
          ...item,
          isTopUp,
          inflow: isTopUp ? Number(item.amount || 0) : 0,
          outflow: isTopUp ? 0 : Number(item.amount || 0),
        };
      });
  }, [termFilteredExpenses, search]);

  const openCreate = () => {
    setEditingExpense(null);
    setForm(blankForm(activeTermInfo.from));
    setShowModal(true);
  };

  const openPettyCashVoucherModal = () => {
    setEditingExpense(null);
    setForm({
      ...blankForm(activeTermInfo.from),
      category: "Petty Cash",
      paymentMethod: "Petty Cash",
      referenceNumber: `PCV-${String(pettyCashVouchers.length + 1).padStart(3, "0")}`,
    });
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
      return toast("Please fill in Date, Category, Item Name and a valid Amount", "error");
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

  const saveTopUp = async () => {
    const num = Number(topUpForm.amount || 0);
    if (!num || num <= 0) return toast("Please enter a valid top-up amount", "error");
    setTopUpSaving(true);
    try {
      await apiFetch("/expenditures/petty-cash/topup", {
        method: "POST",
        body: topUpForm,
        token: auth?.token,
      });
      toast(`Petty cash float topped up with ${money(num)}`, "success");
      setShowTopUpModal(false);
      setTopUpForm({
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        custodianName: "",
        paymentMethod: "Cash",
        referenceNumber: "",
        notes: "",
      });
      await loadData();
    } catch (err) {
      toast(err.message || "Failed to top up petty cash float", "error");
    } finally {
      setTopUpSaving(false);
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete record "${expense.item_name}"?`)) return;
    try {
      await apiFetch(`/expenditures/${expense.expenditure_id}`, {
        method: "DELETE",
        token: auth.token,
      });
      toast("Record deleted", "success");
      await loadData();
    } catch (error) {
      toast(error.message || "Failed to delete record", "error");
    }
  };

  const handlePrintVoucher = async (expense) => {
    try {
      await printDocument({
        type: "petty-cash-voucher",
        data: expense,
        authToken: auth?.token,
        title: "PETTY CASH VOUCHER",
      });
    } catch (err) {
      toast(err.message || "Failed to print voucher", "error");
    }
  };

  const exportPettyCashCSV = () => {
    const rows = filteredPettyCashRecords.map((r) => [
      r.expense_date,
      r.isTopUp ? "Float Top-up (Inflow)" : "Voucher (Outflow)",
      r.reference_number || (r.isTopUp ? "TOPUP" : "PCV"),
      r.paid_to_name || r.vendor_name || "-",
      r.purpose || r.item_name || "-",
      r.category,
      r.inflow ? r.inflow : 0,
      r.outflow ? r.outflow : 0,
      r.payment_method || "-",
      r.released_by_name || "System",
    ]);
    csv(
      "petty_cash_book.csv",
      ["Date", "Type", "Voucher/Ref", "Payee/Custodian", "Purpose", "Category", "Inflow (+)", "Outflow (-)", "Method", "Released By"],
      rows
    );
    toast("Petty Cash Book exported as CSV", "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
            Expenditures & Petty Cash
          </div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Track school operational costs, manage petty cash float and vouchers, and review salary costs from paid payroll.
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => setShowTopUpModal(true)}>
              + Top-up Petty Cash
            </Button>
            <Button variant="secondary" onClick={openPettyCashVoucherModal}>
              + Petty Cash Voucher
            </Button>
            <Button onClick={openCreate}>
              + Record Expense
            </Button>
          </div>
        )}
      </div>

      {/* Tab Selector */}
      <div style={{ display: "flex", gap: "var(--space-2)", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-2)" }}>
        <Button
          variant={activeTab === "expenses" ? "primary" : "ghost"}
          onClick={() => setActiveTab("expenses")}
        >
          All Expenditures ({filteredExpenses.length})
        </Button>
        <Button
          variant={activeTab === "petty-cash" ? "primary" : "ghost"}
          onClick={() => setActiveTab("petty-cash")}
        >
          Petty Cash Book ({filteredPettyCashRecords.length})
        </Button>
      </div>

      {/* KPI Grid */}
      {activeTab === "expenses" ? (
        <div className="ec-kpi-grid">
          <StatCard
            label={selectedTerm === "all" ? "Total Operating Expenses" : `${activeTermInfo.name} Expenses`}
            value={money(totalTermExpenditures)}
            tone="danger"
            hint={selectedTerm === "all" ? `Operating costs + paid payroll · This month: ${money(currentMonthTotal)}` : `Operating costs for ${activeTermInfo.name} · This month: ${money(currentMonthTotal)}`}
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
            hint={`${termFilteredExpenses.filter((e) => e.category !== "Petty Cash Top-up").length} operational items recorded`}
          />
          <StatCard
            label="Petty Cash Float Balance"
            value={money(pettyCashBalance)}
            tone={pettyCashBalance < 0 ? "danger" : pettyCashBalance < 2000 ? "warning" : "success"}
            hint={`Float: ${money(totalFloat)} · Spent: ${money(totalPettyCashSpent)}`}
          />
        </div>
      ) : (
        <div className="ec-kpi-grid">
          <StatCard
            label="Petty Cash Float Balance"
            value={money(pettyCashBalance)}
            tone={pettyCashBalance < 0 ? "danger" : pettyCashBalance < 2000 ? "warning" : "success"}
            hint={totalFloat > 0 ? `${((pettyCashBalance / totalFloat) * 100).toFixed(0)}% float available in cash box` : "Record float top-up to track %"}
          />
          <StatCard
            label="Total Float Disbursed"
            value={money(totalFloat)}
            tone="info"
            hint={`${floatTopUps.length} float top-up replenishment(s)`}
          />
          <StatCard
            label="Total Petty Cash Spent"
            value={money(totalPettyCashSpent)}
            tone="danger"
            hint={`${pettyCashVouchers.length} petty cash voucher(s) drawn`}
          />
          <StatCard
            label="Float Health"
            value={pettyCashBalance <= 0 && totalFloat > 0 ? "Exhausted" : pettyCashBalance < (totalFloat * 0.25) && totalFloat > 0 ? "Low Float" : "Healthy"}
            tone={pettyCashBalance <= 0 && totalFloat > 0 ? "danger" : pettyCashBalance < (totalFloat * 0.25) && totalFloat > 0 ? "warning" : "success"}
            hint={pettyCashBalance < (totalFloat * 0.25) && totalFloat > 0 ? "Replenish float soon" : "Operating within float"}
          />
        </div>
      )}

      {/* Analytics Stack (Shown in Expenses tab) */}
      {activeTab === "expenses" && (
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
                        {month.label || month.month}
                      </div>
                      <div style={{ height: "10px", background: "var(--color-border)", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${width}%`, background: "var(--color-primary)", borderRadius: "999px" }} />
                      </div>
                      <div style={{ textAlign: "right", fontWeight: 700, color: "var(--color-text-primary)", fontSize: "12px" }}>
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
      )}

      {/* Main Table Card */}
      <Card style={{ padding: "var(--space-4)" }}>
        {/* Term quick filters */}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-muted)", marginRight: "var(--space-1)" }}>Term Filter:</span>
          <Button
            variant={selectedTerm === "current" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSelectedTerm("current")}
          >
            Current Term{currentTermName ? ` (${currentTermName})` : ""}
          </Button>
          {(terms.length ? terms : [{ term_name: "Term 1" }, { term_name: "Term 2" }, { term_name: "Term 3" }]).map((t) => {
            const val = String(t.term_id ?? t.id ?? t.term_name);
            const label = t.term_name || t.name;
            const isSelected = selectedTerm === val || selectedTerm === label;
            return (
              <Button
                key={val}
                variant={isSelected ? "primary" : "secondary"}
                size="sm"
                onClick={() => setSelectedTerm(val)}
              >
                {label}
              </Button>
            );
          })}
          <Button
            variant={selectedTerm === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSelectedTerm("all")}
          >
            All Terms
          </Button>
        </div>

        {/* Filter Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-text-primary)" }}>
            {activeTab === "expenses" ? "Manual Expense Records" : "Petty Cash Book & Imprest Ledger"}
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
            {activeTab === "expenses" && (
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
            )}
            <div style={{ flex: "1 1 160px", minWidth: 130 }}>
              <Input
                placeholder={activeTab === "expenses" ? "Search item, payee, released by..." : "Search voucher, payee, purpose..."}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {activeTab === "petty-cash" && (
              <Button variant="ghost" size="sm" onClick={exportPettyCashCSV}>
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {activeTab === "expenses" ? (
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
              <span key="method" style={{ color: "var(--color-text-secondary)", fontWeight: expense.payment_method === "Petty Cash" ? 700 : 400 }}>
                {expense.payment_method || "-"}
              </span>,
              <span key="amount" style={{ color: expense.category === "Petty Cash Top-up" ? "var(--color-primary)" : "var(--color-danger)", fontWeight: 800 }}>
                {money(expense.amount)}
              </span>,
              <span key="ref" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{expense.reference_number || "-"}</span>,
              canEdit ? (
                <div key="actions" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {expense.payment_method === "Petty Cash" && (
                    <Button size="sm" variant="ghost" onClick={() => handlePrintVoucher(expense)}>Print</Button>
                  )}
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
                    <div style={{ fontWeight: 800, fontSize: "15px", color: expense.category === "Petty Cash Top-up" ? "var(--color-primary)" : "var(--color-danger)" }}>
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
                      {expense.payment_method === "Petty Cash" && (
                        <Button size="sm" variant="ghost" onClick={() => handlePrintVoucher(expense)}>Print</Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => openEdit(expense)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteExpense(expense)}>Delete</Button>
                    </div>
                  )}
                </div>
              );
            }}
            emptyState={<EmptyState title="No manual expenses found" description="Record rent, utility bills, classroom supplies, and other school running costs here with clear accountability." />}
          />
        ) : (
          <Table
            headers={["Date", "Type", "Voucher/Ref", "Payee / Custodian", "Category & Purpose", "Released By", "Inflow (+)", "Outflow (-)", "Actions"]}
            loading={loading}
            data={filteredPettyCashRecords.map((item) => [
              <span key="date" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.expense_date}</span>,
              <Badge
                key="type"
                text={item.isTopUp ? "Float Top-up" : "Voucher"}
                tone={item.isTopUp ? "primary" : "danger"}
              />,
              <span key="ref" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                {item.reference_number || (item.isTopUp ? "TOP-UP" : "PCV")}
              </span>,
              <span key="payee" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                {item.paid_to_name || item.vendor_name || "-"}
              </span>,
              <div key="purpose">
                <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.purpose || item.item_name}</div>
                <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{item.category}</div>
              </div>,
              <span key="released" style={{ color: "var(--color-text-secondary)" }}>{item.released_by_name || "Bursar"}</span>,
              <span key="inflow" style={{ color: "var(--color-primary)", fontWeight: 800 }}>
                {item.inflow > 0 ? `+${money(item.inflow)}` : "—"}
              </span>,
              <span key="outflow" style={{ color: "var(--color-danger)", fontWeight: 800 }}>
                {item.outflow > 0 ? `-${money(item.outflow)}` : "—"}
              </span>,
              canEdit ? (
                <div key="actions" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {!item.isTopUp && (
                    <Button size="sm" variant="ghost" onClick={() => handlePrintVoucher(item)}>Print</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteExpense(item)}>Delete</Button>
                </div>
              ) : (
                "View only"
              ),
            ])}
            renderMobileCard={(row, idx) => {
              const item = filteredPettyCashRecords[idx];
              if (!item) return null;
              return (
                <div key={item.expenditure_id || idx} style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text-primary)" }}>
                        {item.purpose || item.item_name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: 2 }}>
                        {item.paid_to_name || item.vendor_name || "—"} · {item.expense_date}
                      </div>
                    </div>
                    <Badge
                      text={item.isTopUp ? "Float Top-up" : "Voucher"}
                      tone={item.isTopUp ? "primary" : "danger"}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--color-bg-base)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      {item.reference_number || (item.isTopUp ? "Top-up" : "Voucher")}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "15px", color: item.isTopUp ? "var(--color-primary)" : "var(--color-danger)" }}>
                      {item.isTopUp ? `+${money(item.inflow)}` : `-${money(item.outflow)}`}
                    </div>
                  </div>

                  {canEdit && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--color-border)" }}>
                      {!item.isTopUp && (
                        <Button size="sm" variant="ghost" onClick={() => handlePrintVoucher(item)}>Print</Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => deleteExpense(item)}>Delete</Button>
                    </div>
                  )}
                </div>
              );
            }}
            emptyState={<EmptyState title="No petty cash entries yet" description="Top up your petty cash float or record vouchers paid via Petty Cash to track your live cash box balance." />}
          />
        )}
      </Card>

      {/* Recent Expense Activity Card */}
      {activeTab === "expenses" && (
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
              <span key="amount" style={{ color: item.category === "Petty Cash Top-up" ? "var(--color-primary)" : "var(--color-danger)", fontWeight: 800 }}>
                {money(item.amount)}
              </span>,
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
                    <div style={{ fontWeight: 800, fontSize: "15px", color: item.category === "Petty Cash Top-up" ? "var(--color-primary)" : "var(--color-danger)" }}>
                      {money(item.amount)}
                    </div>
                  </div>
                </div>
              );
            }}
            emptyState={<EmptyState title="No expense activity yet" description="Paid payroll and recorded expenses will appear here." />}
          />
        </Card>
      )}

      {/* Record / Edit Expense Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingExpense ? "Edit Record" : form.paymentMethod === "Petty Cash" ? "Record Petty Cash Voucher" : "Record Expenditure"}
        maxWidth="760px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={saveExpense} loading={saving}>{editingExpense ? "Update Record" : "Save Record"}</Button>
          </>
        }
      >
        <div className="ec-form-grid ec-form-grid-2">
          {form.paymentMethod === "Petty Cash" && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: pettyCashBalance < Number(form.amount || 0)
                  ? "color-mix(in srgb, var(--color-danger) 12%, transparent)"
                  : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                border: `1px solid ${pettyCashBalance < Number(form.amount || 0) ? "var(--color-danger)" : "var(--color-primary)"}`,
                fontSize: "13px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>Payment Source: Petty Cash Box</strong>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                  Current Available Float: <strong>{money(pettyCashBalance)}</strong>
                  {pettyCashBalance < Number(form.amount || 0) && (
                    <span style={{ color: "var(--color-danger)", marginLeft: "8px", fontWeight: 700 }}>
                      (Warning: Amount exceeds current petty cash float)
                    </span>
                  )}
                </div>
              </div>
              <Badge
                text={pettyCashBalance < Number(form.amount || 0) ? "Insufficient Float" : "Float Available"}
                tone={pettyCashBalance < Number(form.amount || 0) ? "danger" : "success"}
              />
            </div>
          )}

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
            label="Item Name / Particulars"
            value={form.itemName}
            onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))}
            placeholder="e.g. Postage stamps, Emergency plumbing, Staff tea/bread"
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
            label="Paid To / Recipient"
            value={form.paidToName}
            onChange={(event) => setForm((current) => ({ ...current, paidToName: event.target.value }))}
            placeholder="Person or supplier receiving funds"
          />
          <Input
            label="Vendor Name (Optional)"
            value={form.vendorName}
            onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))}
            placeholder="e.g. Local Chemist, Posta Kenya"
          />
          <Input
            label="Purpose / Justification"
            value={form.purpose}
            onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
            placeholder="What the money was released for"
          />
          <Input
            label={form.paymentMethod === "Petty Cash" ? "Voucher Number (PCV)" : "Reference Number"}
            value={form.referenceNumber}
            onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))}
            placeholder={form.paymentMethod === "Petty Cash" ? "e.g. PCV-042" : "Receipt or transaction ref"}
          />
          <Input
            label="Description / Details"
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
                minHeight: "80px",
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

      {/* Top-up Petty Cash Float Modal */}
      <Modal
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        title="Top-up Petty Cash Float (Disbursement / Imprest)"
        maxWidth="620px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowTopUpModal(false)}>Cancel</Button>
            <Button onClick={saveTopUp} loading={topUpSaving}>Top-up Float</Button>
          </>
        }
      >
        <div className="ec-form-grid ec-form-grid-2">
          <Input
            label="Top-up Date"
            type="date"
            value={topUpForm.date}
            onChange={(e) => setTopUpForm((prev) => ({ ...prev, date: e.target.value }))}
          />
          <Input
            label="Amount (KES)"
            type="number"
            value={topUpForm.amount}
            onChange={(e) => setTopUpForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="e.g. 10000"
          />
          <Input
            label="Custodian / Received By"
            value={topUpForm.custodianName}
            onChange={(e) => setTopUpForm((prev) => ({ ...prev, custodianName: e.target.value }))}
            placeholder="e.g. School Secretary, Petty Cash Handler"
          />
          <Select
            label="Disbursement Source"
            value={topUpForm.paymentMethod}
            onChange={(e) => setTopUpForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            options={[
              { value: "Cash", label: "Cash (from Main Safe)" },
              { value: "Bank Transfer", label: "Bank Transfer / Withdrawal" },
              { value: "M-Pesa", label: "M-Pesa Business / Float" },
              { value: "Cheque", label: "Cheque Encashment" },
            ]}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <Input
              label="Reference / Cheque Number"
              value={topUpForm.referenceNumber}
              onChange={(e) => setTopUpForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
              placeholder="e.g. CHQ-00452, MPESA-REF-908"
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: "var(--space-2)" }}>
            <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Notes / Reason for Replenishment
            </label>
            <textarea
              value={topUpForm.notes}
              onChange={(e) => setTopUpForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Monthly imprest replenishment for administration office"
              style={{
                width: "100%",
                minHeight: "80px",
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
