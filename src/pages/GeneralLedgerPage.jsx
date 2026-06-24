import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";
import { exportCsv, localDateInputValue, printReport } from "../utils/reportExport";

export default function GeneralLedgerPage({ auth, toast }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    loadAccounts();
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(localDateInputValue(firstDay));
    setEndDate(localDateInputValue(lastDay));
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadTransactions();
    }
  }, [selectedAccount, startDate, endDate]);

  const loadAccounts = async () => {
    try {
      const data = await apiFetch("/finance/accounts", { token: auth?.token });
      const accountRows = Array.isArray(data) ? data : data?.data || [];
      setAccounts(accountRows);
      if (accountRows.length > 0) {
        setSelectedAccount(accountRows[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast("Failed to load accounts", "error");
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!selectedAccount) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        account_id: selectedAccount,
        start_date: startDate,
        end_date: endDate
      });
      const data = await apiFetch(`/finance/ledger/account?${params}`, { token: auth?.token });
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch (err) {
      toast("Failed to load ledger transactions", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedAccountData = accounts.find(acc => acc.id === selectedAccount);
  const totalDebits = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  const runningBalance = transactions.length > 0 ? transactions[transactions.length - 1].running_balance || 0 : 0;

  const exportLedger = () => {
    exportCsv(
      `general-ledger-${selectedAccountData?.account_code || "account"}-${startDate || "all"}-${endDate || "all"}.csv`,
      ["Date", "Account", "Reference", "Description", "Debit", "Credit", "Running Balance"],
      transactions.map(t => [
        t.transaction_date || t.date || "",
        selectedAccountData?.account_name || "",
        t.reference || "",
        t.description || "",
        Number(t.debit || 0).toFixed(2),
        Number(t.credit || 0).toFixed(2),
        Number(t.running_balance || 0).toFixed(2)
      ])
    );
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading general ledger...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            General Ledger
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Transaction details by account
          </p>
        </div>
        <Button onClick={loadTransactions} variant="secondary">
          🔄 Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
          <div>
            <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "13px" }}>
              Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)"
              }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_code} - {acc.account_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "13px" }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)"
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "13px" }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)"
              }}
            />
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Account" 
          value={selectedAccountData?.account_name || "—"} 
          icon="📊"
          trend={0}
        />
        <StatCard 
          title="Total Debits" 
          value={money(totalDebits)} 
          icon="📥"
          trend={0}
        />
        <StatCard 
          title="Total Credits" 
          value={money(totalCredits)} 
          icon="📤"
          trend={0}
        />
        <StatCard 
          title="Running Balance" 
          value={money(runningBalance)}
          icon="💰"
          trend={0}
        />
      </div>

      {/* Transactions Table */}
      <Card>
        {transactions.length === 0 ? (
          <div style={{ padding: "60px var(--space-4)" }}>
            <EmptyState icon="📒" title="No Transactions" description="No transactions found for this account in the selected period." />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date", "Reference", "Description", "Debit", "Credit", "Running Balance"]}
              data={transactions.map(t => [
                <span key="date">{new Date(t.transaction_date || t.date).toLocaleDateString()}</span>,
                <span key="ref" style={{ fontFamily: "monospace" }}>{t.reference || "—"}</span>,
                <span key="desc" style={{ fontWeight: 600 }}>{t.description}</span>,
                <span key="debit" style={{ fontWeight: 600, color: t.debit > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                  {t.debit > 0 ? money(t.debit) : "—"}
                </span>,
                <span key="credit" style={{ fontWeight: 600, color: t.credit > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                  {t.credit > 0 ? money(t.credit) : "—"}
                </span>,
                <span key="balance" style={{ fontWeight: 700 }}>{money(t.running_balance || 0)}</span>,
              ])}
            />
          </div>
        )}
      </Card>

      {/* Account Info */}
      {selectedAccountData && (
        <Card style={{ marginTop: "var(--space-4)", padding: "var(--space-4)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>Account Code</div>
              <div style={{ fontWeight: 600 }}>{selectedAccountData.account_code}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>Account Type</div>
              <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{selectedAccountData.account_type}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>Normal Balance</div>
              <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{selectedAccountData.normal_balance || (["asset", "expense"].includes(selectedAccountData.account_type) ? "debit" : "credit")}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}>Status</div>
              <div style={{ fontWeight: 600, color: selectedAccountData.is_active !== false ? "var(--color-success)" : "var(--color-text-muted)" }}>
                {selectedAccountData.is_active !== false ? "Active" : "Inactive"}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

GeneralLedgerPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
