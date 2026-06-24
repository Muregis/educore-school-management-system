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

export default function IncomeStatementPage({ auth, toast }) {
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("current");

  useEffect(() => {
    loadIncomeStatement();
  }, [period]);

  const loadIncomeStatement = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/finance/reports/income-statement?period=${period}`, { token: auth?.token });
      setIncomeStatement(data);
    } catch (err) {
      toast("Failed to load income statement", "error");
    } finally {
      setLoading(false);
    }
  };

  const periodLabel = period === "current" ? "Current Term" : period === "ytd" ? "Year to Date" : "Previous Year";

  const handlePrint = () => {
    const revenueRows = (incomeStatement?.revenue || []).map(item => `
      <tr>
        <td>${item.account_name}</td>
        <td style="text-align: right">${money(item.amount)}</td>
      </tr>
    `).join("");
    const expenseRows = (incomeStatement?.expenses || []).map(item => `
      <tr>
        <td>${item.account_name}</td>
        <td style="text-align: right">${money(item.amount)}</td>
      </tr>
    `).join("");
    const html = `
      <html>
      <head><title>Income Statement</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        .header p { margin: 0; color: #666; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 700; }
        .totals { font-weight: 700; margin-top: 10px; text-align: right; font-size: 14px; }
        .net { margin-top: 20px; padding: 12px; border-radius: 4px; font-weight: 700; text-align: center; font-size: 16px; }
        .profit { background: #e6f4ea; color: #1e7e34; }
        .loss { background: #fce8e6; color: #c5221f; }
        .section-title { font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 4px; }
      </style>
      </head>
      <body>
        <div class="header">
          <h1>Income Statement (Profit & Loss)</h1>
          <p>${periodLabel}</p>
        </div>
        <div class="section-title">Revenue</div>
        <table>
          <thead><tr><th>Account</th><th style="text-align: right">Amount</th></tr></thead>
          <tbody>${revenueRows}</tbody>
        </table>
        <div class="totals">Total Revenue: ${money(totalRevenue)}</div>
        <div class="section-title">Expenses</div>
        <table>
          <thead><tr><th>Account</th><th style="text-align: right">Amount</th></tr></thead>
          <tbody>${expenseRows}</tbody>
        </table>
        <div class="totals">Total Expenses: ${money(totalExpenses)}</div>
        <div class="net ${netIncome >= 0 ? "profit" : "loss"}">
          ${netIncome >= 0 ? "Net Profit" : "Net Loss"}: ${money(netIncome)}
        </div>
      </body>
      </html>
    `;
    printHTML(html, { title: "Income Statement" });
  };

  const handleExport = () => {
    const headers = ["Account", "Amount", "Category"];
    const rows = [
      ...(incomeStatement?.revenue || []).map(item => [item.account_name, String(item.amount || 0), "Revenue"]),
      ...(incomeStatement?.expenses || []).map(item => [item.account_name, String(item.amount || 0), "Expense"]),
    ];
    exportCsv("income-statement.csv", headers, rows);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading income statement...
      </div>
    );
  }

  const totalRevenue = incomeStatement?.revenue?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const totalExpenses = incomeStatement?.expenses?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const netIncome = totalRevenue - totalExpenses;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            Income Statement (Profit & Loss)
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Revenue and expense summary for the selected period
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
          <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-card)",
              color: "var(--color-text-primary)",
              fontSize: "13px"
            }}
          >
            <option value="current">Current Term</option>
            <option value="ytd">Year to Date</option>
            <option value="prev_year">Previous Year</option>
          </select>
          <Button onClick={loadIncomeStatement} variant="secondary">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Total Revenue" 
          value={money(totalRevenue)} 
          icon="💰"
          trend={0}
        />
        <StatCard 
          title="Total Expenses" 
          value={money(totalExpenses)} 
          icon="📉"
          trend={0}
        />
        <StatCard 
          title="Net Income" 
          value={money(netIncome)}
          icon={netIncome >= 0 ? "📈" : "📉"}
          trend={0}
        />
        <StatCard 
          title="Profit Margin" 
          value={totalRevenue > 0 ? `${((netIncome / totalRevenue) * 100).toFixed(1)}%` : "0%"}
          icon="📊"
          trend={0}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-4)" }}>
        {/* Revenue Section */}
        <Card>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "16px" }}>
            💰 Revenue
          </div>
          {incomeStatement?.revenue?.length > 0 ? (
            <Table
              headers={["Account", "Amount"]}
              data={incomeStatement.revenue.map(item => [
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.account_name}</span>,
                <span key="amount" style={{ fontWeight: 600, color: "var(--color-success)" }}>{money(item.amount)}</span>,
              ])}
            />
          ) : (
            <EmptyState icon="💰" title="No Revenue" description="No revenue records found." />
          )}
          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total Revenue</span>
            <span style={{ color: "var(--color-success)" }}>{money(totalRevenue)}</span>
          </div>
        </Card>

        {/* Expenses Section */}
        <Card>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "16px" }}>
            📉 Expenses
          </div>
          {incomeStatement?.expenses?.length > 0 ? (
            <Table
              headers={["Account", "Amount"]}
              data={incomeStatement.expenses.map(item => [
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.account_name}</span>,
                <span key="amount" style={{ fontWeight: 600, color: "var(--color-danger)" }}>{money(item.amount)}</span>,
              ])}
            />
          ) : (
            <EmptyState icon="📉" title="No Expenses" description="No expense records found." />
          )}
          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total Expenses</span>
            <span style={{ color: "var(--color-danger)" }}>{money(totalExpenses)}</span>
          </div>
        </Card>
      </div>

      {/* Net Income Summary */}
      <Card style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: netIncome >= 0 ? "var(--color-bg-success)" : "var(--color-bg-error)", border: `1px solid ${netIncome >= 0 ? "var(--color-border-success)" : "var(--color-border-error)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "var(--space-1)" }}>
              {netIncome >= 0 ? "Net Profit" : "Net Loss"}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.8 }}>
              {period === "current" ? "Current Term" : period === "ytd" ? "Year to Date" : "Previous Year"}
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 900, color: netIncome >= 0 ? "var(--color-success)" : "var(--color-error)" }}>
            {money(netIncome)}
          </div>
        </div>
      </Card>
    </div>
  );
}

IncomeStatementPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
