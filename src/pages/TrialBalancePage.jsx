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
      
      const debits = data.total_debits || (data.accounts || []).reduce((sum, acc) => sum + (acc.debit_balance || acc.debit || 0), 0);
      const credits = data.total_credits || (data.accounts || []).reduce((sum, acc) => sum + (acc.credit_balance || acc.credit || 0), 0);
      
      setTotalDebits(debits);
      setTotalCredits(credits);
      setIsBalanced(data.is_balanced !== false && Math.abs(debits - credits) < 0.01);
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
        <td style="text-align: right; color: ${(acc.debit_balance || acc.debit || 0) > 0 ? "green" : "inherit"}">${(acc.debit_balance || acc.debit || 0) > 0 ? money(acc.debit_balance || acc.debit || 0) : "—"}</td>
        <td style="text-align: right; color: ${(acc.credit_balance || acc.credit || 0) > 0 ? "red" : "inherit"}">${(acc.credit_balance || acc.credit || 0) > 0 ? money(acc.credit_balance || acc.credit || 0) : "—"}</td>
      </tr>
    `).join("");
    const html = `
      <html>
      <head><title>Trial Balance</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; }
        h1 { margin: 0 0 8px; }
        .meta { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 13px; }
        th { background: #f5f5f5; text-align: left; }
        tfoot td { font-weight: 700; }
      </style>
      </head>
      <body>
        <h1>Trial Balance</h1>
        <div class="meta">As of ${asOf} · ${isBalanced ? "Balanced" : "Not balanced"}</div>
        <table>
          <thead>
            <tr>
              <th>Account Code</th>
              <th>Account Name</th>
              <th>Type</th>
              <th style="text-align:right">Debit</th>
              <th style="text-align:right">Credit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">Totals</td>
              <td style="text-align:right">${money(totalDebits)}</td>
              <td style="text-align:right">${money(totalCredits)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;
    printHTML(html, "Trial Balance");
  };

  const handleExport = () => {
    exportCsv(
      "trial-balance.csv",
      ["Account Code", "Account Name", "Account Type", "Debit Balance", "Credit Balance"],
      trialBalance.map(acc => [
        acc.account_code || "",
        acc.account_name || "",
        acc.account_type || "",
        acc.debit_balance || acc.debit || 0,
        acc.credit_balance || acc.credit || 0,
      ])
    );
  };

  if (loading) {
    return <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)" }}>Loading trial balance…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--color-text-primary)" }}>Trial Balance</h1>
          <p style={{ margin: "4px 0 0", color: "var(--color-text-secondary)", fontSize: "13px" }}>
            {isBalanced ? "Books are balanced" : "Books are not balanced — review journal entries"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
          <Button variant="secondary" onClick={handlePrint}>Print</Button>
          <Button onClick={loadTrialBalance}>Refresh</Button>
        </div>
      </div>

      <div className="ec-kpi-grid" style={{ marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Total Debits" 
          value={money(totalDebits)}
          icon="📉"
          trend={0}
        />
        <StatCard 
          title="Total Credits" 
          value={money(totalCredits)}
          icon="📈"
          trend={0}
        />
        <StatCard 
          title="Status" 
          value={isBalanced ? "Balanced" : "Out of Balance"}
          icon={isBalanced ? "✅" : "⚠️"}
          trend={0}
        />
        <StatCard 
          title="Difference" 
          value={money(Math.abs(totalDebits - totalCredits))}
          icon="📊"
          trend={0}
        />
      </div>

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
                <span key="debit" style={{ fontWeight: 600, color: (acc.debit_balance || acc.debit || 0) > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                  {(acc.debit_balance || acc.debit || 0) > 0 ? money(acc.debit_balance || acc.debit || 0) : "—"}
                </span>,
                <span key="credit" style={{ fontWeight: 600, color: (acc.credit_balance || acc.credit || 0) > 0 ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                  {(acc.credit_balance || acc.credit || 0) > 0 ? money(acc.credit_balance || acc.credit || 0) : "—"}
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
