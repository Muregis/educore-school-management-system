import React, { useState, useEffect, useCallback } from "react";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Balance Sheet</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>As of {new Date(asOfDate).toLocaleDateString()}</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Profit & Loss Statement</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Trial Balance</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>As of {new Date(asOfDate).toLocaleDateString()}</p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}
            />
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

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📒" title="Loading..." description="Fetching chart of accounts" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📒" title="No data" description="Unable to load chart of accounts" /></Card>;

  const accounts = Array.isArray(data) ? data : data.data || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Chart of Accounts</h3>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
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

  if (loading) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📝" title="Loading..." description="Fetching journal entries" /></Card>;
  if (!data) return <Card style={{ padding: "40px", textAlign: "center" }}><EmptyState icon="📝" title="No data" description="Unable to load journal entries" /></Card>;

  const entries = Array.isArray(data) ? data : data.data || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Journal Entries</h3>
            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
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

// General Ledger Component (placeholder - needs backend endpoint)
function GeneralLedger({ auth }) {
  return (
    <Card style={{ padding: "40px", textAlign: "center" }}>
      <EmptyState 
        icon="📚" 
        title="General Ledger" 
        description="This feature requires a dedicated backend endpoint to fetch transaction history by account. The ledger infrastructure exists in the backend (LedgerService, fee_balance_ledger table) but needs a general ledger API endpoint." 
      />
    </Card>
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
