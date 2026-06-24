import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";
import { exportCsv } from "../utils/reportExport";
import { printHTML } from "../lib/print";

export default function TrialBalancePage({ auth, toast }) {
  const [trialBalance, setTrialBalance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalDebits, setTotalDebits] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [isBalanced, setIsBalanced] = useState(true);

  useEffect(() => {
    loadTrialBalance();
  }, []);

  const loadTrialBalance = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/finance/reports/trial-balance", { token: auth?.token });
      setTrialBalance(data.accounts || []);
      
      const debits = (data.accounts || []).reduce((sum, acc) => sum + (acc.debit_balance || 0), 0);
      const credits = (data.accounts || []).reduce((sum, acc) => sum + (acc.credit_balance || 0), 0);
      
      setTotalDebits(debits);
      setTotalCredits(credits);
      setIsBalanced(Math.abs(debits - credits) < 0.01);
    } catch (err) {
      toast("Failed to load trial balance", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const asOf = new Date().toLocaleDateString();
    const rows = trialBalance.map(acc => `
      <tr>
        <td>${acc.account_code || "—"}</td>
        <td>${acc.account_name}</td>
        <td style="text-transform: capitalize">${acc.account_type}</td>
        <td style="text-align: right; color: ${acc.debit_balance > 0 ? "green" : "inherit"}">${acc.debit_balance > 0 ? money(acc.debit_balance) : "—"}</td>
        <td style="text-align: right; color: ${acc.credit_balance > 0 ? "red" : "inherit"}">${acc.credit_balance > 0 ? money(acc.credit_balance) : "—"}</td>
      </tr>
    `).join("");
    const html = `
      <html>
      <head><title>Trial Balance</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        .header p { margin: 0; color: #666; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 700; }
        .totals { font-weight: 700; margin-top: 12px; text-align: right; font-size: 14px; }
        .status { margin-top: 16px; padding: 10px; border-radius: 4px; font-weight: 700; text-align: center; }
        .balanced { background: #e6f4ea; color: #1e7e34; }
        .unbalanced { background: #fce8e6; color: #c5221f; }
      </style>
      </head>
      <body>
        <div class="header">
          <h1>Trial Balance</h1>
          <p>As of ${asOf}</p>
        </div>
        <table>
          <thead>
            <tr><th>Account Code</th><th>Account Name</th><th>Type</th><th style="text-align: right">Debit Balance</th><th style="text-align: right">Credit Balance</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          Total Debit: ${money(totalDebits)} | Total Credit: ${money(totalCredits)}
        </div>
        <div class="status ${isBalanced ? "balanced" : "unbalanced"}">${isBalanced ? "Balanced" : "Unbalanced"}</div>
      </body>
      </html>
    `;
    printHTML(html, { title: "Trial Balance" });
  };

  const handleExport = () => {
    const headers = ["Account Code", "Account Name", "Account Type", "Debit Balance", "Credit Balance"];
    const rows = trialBalance.map(acc => [
      acc.account_code || "",
      acc.account_name,
      acc.account_type,
      String(acc.debit_balance || 0),
      String(acc.credit_balance || 0),
    ]);
    exportCsv("trial-balance.csv", headers, rows);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading trial balance...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            Trial Balance
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Summary of all account debit and credit balances
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
          <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
          <Button onClick={loadTrialBalance} variant="secondary">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
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
          title="Balance Status" 
          value={isBalanced ? "Balanced ✅" : "Unbalanced ❌"}
          icon={isBalanced ? "⚖️" : "⚠️"}
          trend={0}
        />
        <StatCard 
          title="Difference" 
          value={money(Math.abs(totalDebits - totalCredits))}
          icon="📊"
          trend={0}
        />
      </div>

      {/* Trial Balance Table */}
      <Card>
        {trialBalance.length === 0 ? (
          <div style={{ padding: "60px var(--space-4)" }}>
            <EmptyState icon="📊" title="No Accounts" description="No chart of accounts found." />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Account Code", "Account Name", "Account Type", "Debit Balance", "Credit Balance"]}
              data={trialBalance.map(acc => [
                <span key="code" style={{ fontFamily: "monospace", fontWeight: 600 }}>{acc.account_code || "—"}</span>,
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{acc.account_name}</span>,
                <span key="type" style={{ fontSize: "13px", textTransform: "capitalize" }}>{acc.account_type}</span>,
                <span key="debit" style={{ fontWeight: 600, color: acc.debit_balance > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                  {acc.debit_balance > 0 ? money(acc.debit_balance) : "—"}
                </span>,
                <span key="credit" style={{ fontWeight: 600, color: acc.credit_balance > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                  {acc.credit_balance > 0 ? money(acc.credit_balance) : "—"}
                </span>,
              ])}
            />
          </div>
        )}
      </Card>

      {!isBalanced && (
        <Card style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: "var(--color-bg-error)", border: "1px solid var(--color-border-error)" }}>
          <div style={{ color: "var(--color-error)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
            ⚠️ Trial Balance is Not Balanced
          </div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>
            The total debits ({money(totalDebits)}) do not equal total credits ({money(totalCredits)}). 
            Please review journal entries for errors.
          </div>
        </Card>
      )}
    </div>
  );
}

TrialBalancePage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
