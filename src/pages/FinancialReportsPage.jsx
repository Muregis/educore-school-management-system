import React, { useState, useEffect, useCallback } from "react";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { exportCsv } from "../utils/reportExport";
import { printHTML } from "../lib/print";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";

const TABS = [
  { id: "balance-sheet", label: "Balance Sheet", icon: "⚖️" },
  { id: "income-statement", label: "Profit & Loss", icon: "📊" },
  { id: "trial-balance", label: "Trial Balance", icon: "📋" },
  { id: "chart-of-accounts", label: "Chart of Accounts", icon: "📒" },
  { id: "journal-entries", label: "Journal Entries", icon: "📝" },
  { id: "general-ledger", label: "General Ledger", icon: "📚" },
];

const ACCOUNT_TYPES = {
  asset: { color: "var(--color-success)", label: "Asset" },
  liability: { color: "var(--color-danger)", label: "Liability" },
  equity: { color: "var(--color-info)", label: "Equity" },
  revenue: { color: "var(--color-primary)", label: "Revenue" },
  expense: { color: "var(--color-warning)", label: "Expense" },
};

// Balance Sheet Component
function BalanceSheet({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const result = await apiFetch(`/finance/reports/balance-sheet?as_of_date=${asOfDate}`, { token: auth.token });
      setData(result);
    } catch (e) {
      console.error("Balance sheet error:", e);
    }
    setLoading(false);
  }, [auth, asOfDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="⚖️" title="Loading..." description="Fetching balance sheet data" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="⚖️" title="No data" description="Unable to load balance sheet" /></Card>;

  const totalAssets = data.total_assets || 0;
  const totalLiabilities = data.total_liabilities || 0;
  const totalEquity = data.total_equity || 0;
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const handleExport = () => {
    const headers = ["Account", "Code", "Type", "Balance"];
    const rows = [
      ...(data.assets || []).map(acc => [acc.account_name, acc.account_code, "Asset", String(acc.balance || 0)]),
      ...(data.liabilities || []).map(acc => [acc.account_name, acc.account_code, "Liability", String(acc.balance || 0)]),
      ...(data.equity || []).map(acc => [acc.account_name, acc.account_code, "Equity", String(acc.balance || 0)]),
    ];
    exportCsv(`balance-sheet-${asOfDate}.csv`, headers, rows);
  };

  const handlePrint = () => {
    const html = `
      <div class="print-document">
        <div class="print-header">
          <h1>Balance Sheet</h1>
          <p>As of ${new Date(asOfDate).toLocaleDateString()}</p>
        </div>
        <table class="print-table">
          <thead><tr><th>Account</th><th>Code</th><th>Type</th><th style="text-align: right">Balance (KES)</th></tr></thead>
          <tbody>
            ${(data.assets || []).map(acc => `<tr><td>${acc.account_name}</td><td>${acc.account_code}</td><td>Asset</td><td style="text-align: right">${money(acc.balance)}</td></tr>`).join('')}
            ${(data.liabilities || []).map(acc => `<tr><td>${acc.account_name}</td><td>${acc.account_code}</td><td>Liability</td><td style="text-align: right">${money(acc.balance)}</td></tr>`).join('')}
            ${(data.equity || []).map(acc => `<tr><td>${acc.account_name}</td><td>${acc.account_code}</td><td>Equity</td><td style="text-align: right">${money(acc.balance)}</td></tr>`).join('')}
            <tr><td><strong>Retained Earnings</strong></td><td>—</td><td>Equity</td><td style="text-align: right"><strong>${money(data.retained_earnings)}</strong></td></tr>
          </tbody>
        </table>
        <div class="summary">
          <p><strong>Total Assets:</strong> ${money(totalAssets)}</p>
          <p><strong>Total Liabilities:</strong> ${money(totalLiabilities)}</p>
          <p><strong>Total Equity & Retained Earnings:</strong> ${money(totalEquity)}</p>
          <p><strong>Status:</strong> ${isBalanced ? "Balanced" : "Not Balanced"}</p>
        </div>
      </div>
    `;
    printHTML(html, { title: `Balance Sheet - ${asOfDate}` });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Balance Sheet</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>As of {new Date(asOfDate).toLocaleDateString()}</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
            <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
            <Button onClick={load}>Refresh</Button>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-4)" }}>
        {/* Assets */}
        <Card style={{ padding: "var(--space-4)" }}>
          <h4 style={{ margin: "0 0 var(--space-3) 0", color: ACCOUNT_TYPES.asset.color, fontSize: "16px", fontWeight: 700 }}>Assets</h4>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <Table
              headers={["Account", "Code", "Balance"]}
              data={data.assets.map(acc => [
                <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
                <span key="code" style={{ color: "var(--color-text-secondary)" }}>{acc.account_code}</span>,
                <span key="balance" style={{ fontWeight: 700, color: ACCOUNT_TYPES.asset.color }}>{money(acc.balance)}</span>,
              ])}
            />
          </div>
          <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "2px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>Total Assets</span>
            <span style={{ color: ACCOUNT_TYPES.asset.color }}>{money(data.total_assets)}</span>
          </div>
        </Card>

        {/* Liabilities */}
        <Card style={{ padding: "var(--space-4)" }}>
          <h4 style={{ margin: "0 0 var(--space-3) 0", color: ACCOUNT_TYPES.liability.color, fontSize: "16px", fontWeight: 700 }}>Liabilities</h4>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <Table
              headers={["Account", "Code", "Balance"]}
              data={data.liabilities.map(acc => [
                <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
                <span key="code" style={{ color: "var(--color-text-secondary)" }}>{acc.account_code}</span>,
                <span key="balance" style={{ fontWeight: 700, color: ACCOUNT_TYPES.liability.color }}>{money(acc.balance)}</span>,
              ])}
            />
          </div>
          <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "2px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total Liabilities</span>
            <span style={{ color: ACCOUNT_TYPES.liability.color }}>{money(data.total_liabilities)}</span>
          </div>
        </Card>

        {/* Equity */}
        <Card style={{ padding: "var(--space-4)" }}>
          <h4 style={{ margin: "0 0 var(--space-3) 0", color: ACCOUNT_TYPES.equity.color, fontSize: "16px", fontWeight: 700 }}>Equity</h4>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <Table
              headers={["Account", "Code", "Balance"]}
              data={data.equity.map(acc => [
                <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
                <span key="code" style={{ color: "var(--color-text-secondary)" }}>{acc.account_code}</span>,
                <span key="balance" style={{ fontWeight: 700, color: ACCOUNT_TYPES.equity.color }}>{money(acc.balance)}</span>,
              ])}
            />
          </div>
          <div style={{ marginTop: "var(--space-2)", display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
            <span>Retained Earnings</span>
            <span style={{ fontWeight: 600 }}>{money(data.retained_earnings)}</span>
          </div>
          <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "2px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>Total Equity</span>
            <span style={{ color: ACCOUNT_TYPES.equity.color }}>{money(data.total_equity)}</span>
          </div>
        </Card>
      </div>

      <Card style={{ padding: "var(--space-4)", background: data.is_balanced ? "color-mix(in srgb, var(--color-success) 10%, transparent)" : "color-mix(in srgb, var(--color-danger) 10%, transparent)", border: `1px solid ${data.is_balanced ? "var(--color-success)" : "var(--color-danger)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: "18px" }}>
          <span>Balance Check</span>
          <Badge text={data.is_balanced ? "✓ Balanced" : "✗ Unbalanced"} style={{ background: data.is_balanced ? "var(--color-success)" : "var(--color-danger)", color: "white", borderColor: "transparent" }} />
        </div>
        <div style={{ marginTop: "var(--space-2)", fontSize: "14px", color: "var(--color-text-secondary)" }}>
          Assets ({money(data.total_assets)}) = Liabilities ({money(data.total_liabilities)}) + Equity ({money(data.total_equity)})
        </div>
      </Card>
    </div>
  );
}

// Income Statement Component
function IncomeStatement({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const result = await apiFetch(`/finance/reports/income-statement?start_date=${startDate}&end_date=${endDate}`, { token: auth.token });
      setData(result);
    } catch (e) {
      console.error("Income statement error:", e);
    }
    setLoading(false);
  }, [auth, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📊" title="Loading..." description="Fetching income statement data" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📊" title="No data" description="Unable to load income statement" /></Card>;

  const totalRevenue = data.total_revenue || 0;
  const totalExpenses = data.total_expenses || 0;
  const netIncome = totalRevenue - totalExpenses;

  const handleExport = () => {
    const headers = ["Account", "Code", "Type", "Amount"];
    const rows = [
      ...(data.revenue || []).map(acc => [acc.account_name, acc.account_code, "Revenue", String(acc.balance || 0)]),
      ...(data.expenses || []).map(acc => [acc.account_name, acc.account_code, "Expense", String(acc.balance || 0)]),
    ];
    exportCsv(`income-statement-${startDate}-to-${endDate}.csv`, headers, rows);
  };

  const handlePrint = () => {
    const html = `
      <div class="print-document">
        <div class="print-header">
          <h1>Income Statement (Profit & Loss)</h1>
          <p>${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
        </div>
        <table class="print-table">
          <thead><tr><th>Account</th><th>Code</th><th style="text-align: right">Amount (KES)</th></tr></thead>
          <tbody>
            ${(data.revenue || []).map(acc => `<tr><td>${acc.account_name}</td><td>${acc.account_code}</td><td style="text-align: right">${money(acc.balance)}</td></tr>`).join('')}
            ${(data.expenses || []).map(acc => `<tr><td>${acc.account_name}</td><td>${acc.account_code}</td><td style="text-align: right">${money(acc.balance)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="summary">
          <p><strong>Total Revenue:</strong> ${money(totalRevenue)}</p>
          <p><strong>Total Expenses:</strong> ${money(totalExpenses)}</p>
          <p><strong>Net Income:</strong> ${money(netIncome)}</p>
        </div>
      </div>
    `;
    printHTML(html, { title: "Income Statement" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Profit & Loss Statement</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
            <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
            <Button onClick={load}>Refresh</Button>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-4)" }}>
        {/* Revenue */}
        <Card style={{ padding: "var(--space-4)" }}>
          <h4 style={{ margin: "0 0 var(--space-3) 0", color: ACCOUNT_TYPES.revenue.color, fontSize: "16px", fontWeight: 700 }}>Revenue</h4>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <Table
              headers={["Account", "Code", "Amount"]}
              data={data.revenue.map(acc => [
                <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
                <span key="code" style={{ color: "var(--color-text-secondary)" }}>{acc.account_code}</span>,
                <span key="balance" style={{ fontWeight: 700, color: ACCOUNT_TYPES.revenue.color }}>{money(acc.balance)}</span>,
              ])}
            />
          </div>
          <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "2px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>Total Revenue</span>
            <span style={{ color: ACCOUNT_TYPES.revenue.color }}>{money(data.total_revenue)}</span>
          </div>
        </Card>

        {/* Expenses */}
        <Card style={{ padding: "var(--space-4)" }}>
          <h4 style={{ margin: "0 0 var(--space-3) 0", color: ACCOUNT_TYPES.expense.color, fontSize: "16px", fontWeight: 700 }}>Expenses</h4>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <Table
              headers={["Account", "Code", "Amount"]}
              data={data.expenses.map(acc => [
                <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
                <span key="code" style={{ color: "var(--color-text-secondary)" }}>{acc.account_code}</span>,
                <span key="balance" style={{ fontWeight: 700, color: ACCOUNT_TYPES.expense.color }}>{money(acc.balance)}</span>,
              ])}
            />
          </div>
          <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "2px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>Total Expenses</span>
            <span style={{ color: ACCOUNT_TYPES.expense.color }}>{money(data.total_expenses)}</span>
          </div>
        </Card>
      </div>

      <Card style={{ padding: "var(--space-4)", background: data.net_income >= 0 ? "color-mix(in srgb, var(--color-success) 10%, transparent)" : "color-mix(in srgb, var(--color-danger) 10%, transparent)", border: `1px solid ${data.net_income >= 0 ? "var(--color-success)" : "var(--color-danger)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, fontSize: "20px" }}>
          <span>Net Income</span>
          <span style={{ color: data.net_income >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{money(data.net_income)}</span>
        </div>
      </Card>
    </div>
  );
}

// Trial Balance Component
function TrialBalance({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const result = await apiFetch(`/finance/reports/trial-balance?as_of_date=${asOfDate}`, { token: auth.token });
      setData(result);
    } catch (e) {
      console.error("Trial balance error:", e);
    }
    setLoading(false);
  }, [auth, asOfDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📋" title="Loading..." description="Fetching trial balance data" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📋" title="No data" description="Unable to load trial balance" /></Card>;

  const totalDebits = data.total_debits || 0;
  const totalCredits = data.total_credits || 0;
  const isBalanced = data.is_balanced !== false;

  const handleExport = () => {
    const headers = ["Account", "Code", "Type", "Debit", "Credit"];
    const rows = (data.accounts || []).map(acc => [
      acc.account_name,
      acc.account_code,
      acc.account_type,
      String(acc.debit_balance || acc.debit || 0),
      String(acc.credit_balance || acc.credit || 0)
    ]);
    exportCsv(`trial-balance-${asOfDate}.csv`, headers, rows);
  };

  const handlePrint = () => {
    const html = `
      <div class="print-document">
        <div class="print-header">
          <h1>Trial Balance</h1>
          <p>As of ${new Date(asOfDate).toLocaleDateString()}</p>
        </div>
        <table class="print-table">
          <thead><tr><th>Account</th><th>Code</th><th>Type</th><th style="text-align: right">Debit (KES)</th><th style="text-align: right">Credit (KES)</th></tr></thead>
          <tbody>
            ${(data.accounts || []).map(acc => `<tr><td>${acc.account_name}</td><td>${acc.account_code}</td><td>${acc.account_type}</td><td style="text-align: right">${money(acc.debit_balance || acc.debit || 0)}</td><td style="text-align: right">${money(acc.credit_balance || acc.credit || 0)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="summary">
          <p><strong>Total Debits:</strong> ${money(totalDebits)}</p>
          <p><strong>Total Credits:</strong> ${money(totalCredits)}</p>
          <p><strong>Status:</strong> ${isBalanced ? "Balanced" : "Not Balanced"}</p>
        </div>
      </div>
    `;
    printHTML(html, { title: "Trial Balance" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Trial Balance</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>As of {new Date(asOfDate).toLocaleDateString()}</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
            <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
            <Button onClick={load}>Refresh</Button>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "var(--space-4)" }}>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <Table
            headers={["Account", "Code", "Type", "Debit", "Credit"]}
            data={data.accounts.map(acc => [
              <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
              <span key="code" style={{ color: "var(--color-text-secondary)" }}>{acc.account_code}</span>,
              <Badge key="type" text={ACCOUNT_TYPES[acc.account_type]?.label || acc.account_type} style={{ background: ACCOUNT_TYPES[acc.account_type]?.color + "20", color: ACCOUNT_TYPES[acc.account_type]?.color, borderColor: "transparent" }} />,
              <span key="debit" style={{ fontWeight: 700, color: acc.debit > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>{acc.debit > 0 ? money(acc.debit) : "-"}</span>,
              <span key="credit" style={{ fontWeight: 700, color: acc.credit > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>{acc.credit > 0 ? money(acc.credit) : "-"}</span>,
            ])}
          />
        </div>
        <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "2px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
          <span>Totals</span>
          <div style={{ display: "flex", gap: "var(--space-6)" }}>
            <span style={{ color: "var(--color-success)" }}>Debit: {money(data.total_debits)}</span>
            <span style={{ color: "var(--color-danger)" }}>Credit: {money(data.total_credits)}</span>
          </div>
        </div>
        <Card style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", background: data.is_balanced ? "color-mix(in srgb, var(--color-success) 10%, transparent)" : "color-mix(in srgb, var(--color-danger) 10%, transparent)", border: `1px solid ${data.is_balanced ? "var(--color-success)" : "var(--color-danger)"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
            <span>Balanced</span>
            <Badge text={data.is_balanced ? "✓ Yes" : "✗ No"} style={{ background: data.is_balanced ? "var(--color-success)" : "var(--color-danger)", color: "white", borderColor: "transparent" }} />
          </div>
        </Card>
      </Card>
    </div>
  );
}

// Chart of Accounts Component
function ChartOfAccounts({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const url = filterType ? `/finance/accounts?type=${filterType}` : "/finance/accounts";
      const result = await apiFetch(url, { token: auth.token });
      setData(result);
    } catch (e) {
      console.error("Chart of accounts error:", e);
    }
    setLoading(false);
  }, [auth, filterType]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    if (!data) return;
    const accounts = Array.isArray(data) ? data : data.data || [];
    const rows = accounts.map(acc => `
      <tr>
        <td style="font-family: monospace">${acc.account_code || "—"}</td>
        <td>${acc.account_name}</td>
        <td style="text-transform: capitalize">${ACCOUNT_TYPES[acc.account_type]?.label || acc.account_type}</td>
        <td>${acc.is_active ? "Active" : "Inactive"}</td>
      </tr>
    `).join("");
    const html = `
      <html>
      <head><title>Chart of Accounts</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 700; }
      </style>
      </head>
      <body>
        <div class="header"><h1>Chart of Accounts</h1><p>${accounts.length} accounts</p></div>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;
    printHTML(html, { title: "Chart of Accounts" });
  };

  const handleExport = () => {
    const accounts = Array.isArray(data) ? data : data.data || [];
    const headers = ["Account Code", "Account Name", "Type", "Status"];
    const rows = accounts.map(acc => [
      acc.account_code || "",
      acc.account_name,
      ACCOUNT_TYPES[acc.account_type]?.label || acc.account_type,
      acc.is_active ? "Active" : "Inactive",
    ]);
    exportCsv("chart-of-accounts.csv", headers, rows);
  };

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📒" title="Loading..." description="Fetching chart of accounts" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📒" title="No data" description="Unable to load chart of accounts" /></Card>;

  const accounts = Array.isArray(data) ? data : data.data || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Chart of Accounts</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>Complete list of all financial accounts</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: "", label: "All Types" },
                { value: "asset", label: "Assets" },
                { value: "liability", label: "Liabilities" },
                { value: "equity", label: "Equity" },
                { value: "revenue", label: "Revenue" },
                { value: "expense", label: "Expenses" },
              ]}
            />
            <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
            <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
            <Button onClick={load}>Refresh</Button>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "var(--space-4)" }}>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <Table
            headers={["Code", "Account Name", "Type", "Active"]}
            data={accounts.map(acc => [
              <span key="code" style={{ fontWeight: 600, fontFamily: "monospace" }}>{acc.account_code}</span>,
              <span key="name" style={{ fontWeight: 600 }}>{acc.account_name}</span>,
              <Badge key="type" text={ACCOUNT_TYPES[acc.account_type]?.label || acc.account_type} style={{ background: ACCOUNT_TYPES[acc.account_type]?.color + "20", color: ACCOUNT_TYPES[acc.account_type]?.color, borderColor: "transparent" }} />,
              <Badge key="active" text={acc.is_active ? "Active" : "Inactive"} style={{ background: acc.is_active ? "var(--color-success)" : "var(--color-text-muted)", color: "white", borderColor: "transparent" }} />,
            ])}
          />
        </div>
      </Card>
    </div>
  );
}

// Journal Entries Component
function JournalEntries({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const result = await apiFetch(`/finance/journal-entries?start_date=${startDate}&end_date=${endDate}`, { token: auth.token });
      setData(result);
    } catch (e) {
      console.error("Journal entries error:", e);
    }
    setLoading(false);
  }, [auth, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    if (!data) return;
    const entries = Array.isArray(data) ? data : data.data || [];
    const entryBlocks = entries.map(entry => {
      const lineRows = (entry.journal_entry_lines || []).map(line => `
        <tr>
          <td style="padding-left: 20px">${line.chart_of_accounts?.account_name || line.account_id}</td>
          <td style="text-align: right; color: green">${line.debit > 0 ? money(line.debit) : "—"}</td>
          <td style="text-align: right; color: red">${line.credit > 0 ? money(line.credit) : "—"}</td>
        </tr>
      `).join("");
      return `
        <div style="margin-bottom: 16px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
          <div style="padding: 10px; background: #f5f5f5; display: flex; justify-content: space-between;">
            <span style="font-weight: 700">${entry.entry_number || `JE-${entry.id}`}</span>
            <span>${new Date(entry.entry_date).toLocaleDateString()}</span>
          </div>
          ${entry.description ? `<div style="padding: 6px 10px; font-size: 13px; color: #555">${entry.description}</div>` : ""}
          <table style="width: 100%; border-collapse: collapse;">
            <thead><tr><th style="text-align: left">Account</th><th style="text-align: right">Debit</th><th style="text-align: right">Credit</th></tr></thead>
            <tbody>${lineRows}</tbody>
          </table>
        </div>
      `;
    }).join("");
    const html = `
      <html>
      <head><title>Journal Entries</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
      </style>
      </head>
      <body>
        <div class="header"><h1>Journal Entries</h1></div>
        ${entryBlocks || '<p style="text-align: center; color: #999">No journal entries found.</p>'}
      </body>
      </html>
    `;
    printHTML(html, { title: "Journal Entries" });
  };

  const handleExport = () => {
    const entries = Array.isArray(data) ? data : data.data || [];
    const headers = ["Entry Number", "Date", "Description", "Account", "Debit", "Credit"];
    const rows = [];
    entries.forEach(entry => {
      (entry.journal_entry_lines || []).forEach(line => {
        rows.push([
          entry.entry_number || `JE-${entry.id}`,
          new Date(entry.entry_date).toLocaleDateString(),
          entry.description || "",
          line.chart_of_accounts?.account_name || line.account_id,
          String(line.debit || 0),
          String(line.credit || 0),
        ]);
      });
    });
    exportCsv("journal-entries.csv", headers, rows);
  };

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📝" title="Loading..." description="Fetching journal entries" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📝" title="No data" description="Unable to load journal entries" /></Card>;

  const entries = Array.isArray(data) ? data : data.data || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Journal Entries</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
            <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
            <Button onClick={load}>Refresh</Button>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "var(--space-4)" }}>
        {entries.length === 0 ? (
          <EmptyState icon="📝" title="No journal entries" description="No journal entries found for the selected date range" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {entries.map(entry => (
              <div key={entry.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "14px" }}>{entry.entry_number || `JE-${entry.id}`}</span>
                    <span style={{ color: "var(--color-text-secondary)", marginLeft: "var(--space-2)" }}>{new Date(entry.entry_date).toLocaleDateString()}</span>
                  </div>
                  <Badge text={entry.status} style={{ background: entry.status === "posted" ? "var(--color-success)" : "var(--color-warning)", color: "white", borderColor: "transparent" }} />
                </div>
                <div style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>{entry.description}</div>
                {entry.journal_entry_lines && (
                  <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    <Table
                      headers={["Account", "Debit", "Credit"]}
                      data={entry.journal_entry_lines.map(line => [
                        <span key="account" style={{ fontWeight: 600 }}>{line.chart_of_accounts?.account_name || line.account_id}</span>,
                        <span key="debit" style={{ fontWeight: 700, color: "var(--color-success)" }}>{line.debit > 0 ? money(line.debit) : "-"}</span>,
                        <span key="credit" style={{ fontWeight: 700, color: "var(--color-danger)" }}>{line.credit > 0 ? money(line.credit) : "-"}</span>,
                      ])}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// General Ledger Component
function GeneralLedger({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accounts, setAccounts] = useState([]);

  const loadAccounts = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const result = await apiFetch("/finance/accounts", { token: auth.token });
      const accountList = Array.isArray(result) ? result : result.data || [];
      setAccounts(accountList.filter(a => a.is_active));
    } catch (e) {
      console.error("Failed to load accounts:", e);
    }
  }, [auth]);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const url = selectedAccountId 
        ? `/finance/reports/general-ledger?account_id=${selectedAccountId}&start_date=${startDate}&end_date=${endDate}`
        : `/finance/reports/general-ledger?start_date=${startDate}&end_date=${endDate}`;
      const result = await apiFetch(url, { token: auth.token });
      setData(result);
    } catch (e) {
      console.error("General ledger error:", e);
    }
    setLoading(false);
  }, [auth, selectedAccountId, startDate, endDate]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    if (!data) return;
    const ledger = Array.isArray(data.ledger) ? data.ledger : [];
    const txRows = ledger.flatMap(accountLedger =>
      (accountLedger.transactions || []).map(tx => `
        <tr>
          <td>${new Date(tx.transaction_date || tx.date).toLocaleDateString()}</td>
          <td style="font-family: monospace">${tx.reference || "—"}</td>
          <td>${tx.description}</td>
          <td style="text-align: right; color: green">${tx.debit > 0 ? money(tx.debit) : "—"}</td>
          <td style="text-align: right; color: red">${tx.credit > 0 ? money(tx.credit) : "—"}</td>
          <td style="text-align: right; font-weight: 700">${money(tx.balance || tx.running_balance || 0)}</td>
        </tr>
      `).join("")
    ).join("");
    const html = `
      <html>
      <head><title>General Ledger</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 700; }
      </style>
      </head>
      <body>
        <div class="header">
          <h1>General Ledger</h1>
          <p>${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Reference</th><th>Description</th><th style="text-align: right">Debit</th><th style="text-align: right">Credit</th><th style="text-align: right">Balance</th></tr>
          </thead>
          <tbody>${txRows || '<tr><td colspan="6" style="text-align: center; color: #999">No transactions found.</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;
    printHTML(html, { title: "General Ledger" });
  };

  const handleExport = () => {
    const ledger = Array.isArray(data.ledger) ? data.ledger : [];
    const headers = ["Account", "Date", "Reference", "Description", "Debit", "Credit", "Balance"];
    const rows = [];
    ledger.forEach(accountLedger => {
      const accountName = accountLedger.account?.account_name || "";
      (accountLedger.transactions || []).forEach(tx => {
        rows.push([
          accountName,
          new Date(tx.transaction_date || tx.date).toLocaleDateString(),
          tx.reference || "",
          tx.description || "",
          String(tx.debit || 0),
          String(tx.credit || 0),
          String(tx.balance || tx.running_balance || 0),
        ]);
      });
    });
    exportCsv("general-ledger.csv", headers, rows);
  };

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📚" title="Loading..." description="Fetching general ledger data" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📚" title="No data" description="Unable to load general ledger" /></Card>;

  const ledger = Array.isArray(data.ledger) ? data.ledger : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>General Ledger</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <Select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              options={[
                { value: "", label: "All Accounts" },
                ...accounts.map(a => ({ value: a.id, label: `${a.account_code} - ${a.account_name}` }))
              ]}
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
            <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
            <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
            <Button onClick={load}>Refresh</Button>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "var(--space-4)" }}>
        {ledger.length === 0 ? (
          <EmptyState icon="📚" title="No transactions" description="No ledger transactions found for the selected criteria" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {ledger.map((accountLedger, idx) => (
              <div key={idx} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <div style={{ padding: "var(--space-3)", background: "var(--color-bg-base)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px" }}>{accountLedger.account.account_name}</span>
                    <Badge text={accountLedger.account.account_code} style={{ background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }} />
                    <Badge text={ACCOUNT_TYPES[accountLedger.account.account_type]?.label || accountLedger.account.account_type} style={{ background: ACCOUNT_TYPES[accountLedger.account.account_type]?.color + "20", color: ACCOUNT_TYPES[accountLedger.account.account_type]?.color, borderColor: "transparent" }} />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{accountLedger.transactions.length} transactions</span>
                </div>
                {accountLedger.transactions.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <Table
                      headers={["Date", "Reference", "Description", "Debit", "Credit", "Balance"]}
                      data={accountLedger.transactions.map(tx => [
                        <span key="date" style={{ fontSize: "13px" }}>{new Date(tx.transaction_date || tx.date).toLocaleDateString()}</span>,
                        <span key="ref" style={{ fontSize: "13px", fontFamily: "monospace" }}>{tx.reference || tx.entry_number || "—"}</span>,
                        <span key="desc" style={{ fontSize: "13px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</span>,
                        <span key="debit" style={{ fontWeight: 700, color: tx.debit > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>{tx.debit > 0 ? money(tx.debit) : "-"}</span>,
                        <span key="credit" style={{ fontWeight: 700, color: tx.credit > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>{tx.credit > 0 ? money(tx.credit) : "-"}</span>,
                        <span key="balance" style={{ fontWeight: 800, color: "var(--color-text-primary)" }}>{money(tx.balance || tx.running_balance || 0)}</span>,
                      ])}
                    />
                  </div>
                ) : (
                  <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--color-text-muted)" }}>No transactions for this account</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Main Financial Reports Page
export default function FinancialReportsPage({ auth, toast }) {
  const [activeTab, setActiveTab] = useState("balance-sheet");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>Financial Reports</h1>
      </div>

      {/* Tab Navigation */}
      <Card style={{ padding: "var(--space-2)" }}>
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
          {TABS.map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "primary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === "balance-sheet" && <BalanceSheet auth={auth} />}
      {activeTab === "income-statement" && <IncomeStatement auth={auth} />}
      {activeTab === "trial-balance" && <TrialBalance auth={auth} />}
      {activeTab === "chart-of-accounts" && <ChartOfAccounts auth={auth} />}
      {activeTab === "journal-entries" && <JournalEntries auth={auth} />}
      {activeTab === "general-ledger" && <GeneralLedger auth={auth} />}
    </div>
  );
}
