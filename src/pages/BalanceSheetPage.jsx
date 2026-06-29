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

export default function BalanceSheetPage({ auth, toast }) {
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState("");

  useEffect(() => {
    // Set default to today
    setAsOfDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (asOfDate) {
      loadBalanceSheet();
    }
  }, [asOfDate]);

  const loadBalanceSheet = async () => {
    setLoading(true);
    try {
      const params = asOfDate ? `?as_of_date=${asOfDate}` : "";
      const data = await apiFetch(`/finance/reports/balance-sheet${params}`, { token: auth?.token });
      setBalanceSheet(data);
    } catch (err) {
      toast("Failed to load balance sheet", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ["Account", "Amount", "Category"];
    const rows = [
      ...(balanceSheet?.assets || []).map(item => [item.account_name, String(item.amount || item.balance || 0), "Asset"]),
      ...(balanceSheet?.liabilities || []).map(item => [item.account_name, String(item.amount || item.balance || 0), "Liability"]),
      ...(balanceSheet?.equity || []).map(item => [item.account_name, String(item.amount || item.balance || 0), "Equity"]),
    ];
    exportCsv("balance-sheet.csv", headers, rows);
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading balance sheet...
      </div>
    );
  }

  const totalAssets = balanceSheet?.total_assets || balanceSheet?.assets?.reduce((sum, item) => sum + (item.amount || item.balance || 0), 0) || 0;
  const totalLiabilities = balanceSheet?.total_liabilities || balanceSheet?.liabilities?.reduce((sum, item) => sum + (item.amount || item.balance || 0), 0) || 0;
  const totalEquity = balanceSheet?.total_equity || balanceSheet?.equity?.reduce((sum, item) => sum + (item.amount || item.balance || 0), 0) || 0;
  const isBalanced = balanceSheet?.is_balanced !== false && Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const handlePrint = () => {
    const asOf = asOfDate ? new Date(asOfDate).toLocaleDateString() : "today";
    const assetRows = (balanceSheet?.assets || []).map(item => `
      <tr>
        <td>${item.account_name}</td>
        <td style="text-align: right">${money(item.amount || item.balance || 0)}</td>
      </tr>
    `).join("");
    const liabilityRows = (balanceSheet?.liabilities || []).map(item => `
      <tr>
        <td>${item.account_name}</td>
        <td style="text-align: right">${money(item.amount || item.balance || 0)}</td>
      </tr>
    `).join("");
    const equityRows = (balanceSheet?.equity || []).map(item => `
      <tr>
        <td>${item.account_name}</td>
        <td style="text-align: right">${money(item.amount || item.balance || 0)}</td>
      </tr>
    `).join("");
    const html = `
      <html>
      <head><title>Balance Sheet</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
        .header p { margin: 0; color: #666; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 700; }
        .totals { font-weight: 700; margin-top: 10px; text-align: right; font-size: 14px; }
        .status { margin-top: 16px; padding: 10px; border-radius: 4px; font-weight: 700; text-align: center; }
        .balanced { background: #e6f4ea; color: #1e7e34; }
        .unbalanced { background: #fce8e6; color: #c5221f; }
        .section-title { font-weight: 700; font-size: 15px; margin-top: 16px; margin-bottom: 4px; }
      </style>
      </head>
      <body>
        <div class="header">
          <h1>Balance Sheet</h1>
          <p>As of ${asOf}</p>
        </div>
        <div class="section-title">Assets</div>
        <table>
          <thead><tr><th>Account</th><th style="text-align: right">Amount</th></tr></thead>
          <tbody>${assetRows}</tbody>
        </table>
        <div class="totals">Total Assets: ${money(totalAssets)}</div>
        <div class="section-title">Liabilities</div>
        <table>
          <thead><tr><th>Account</th><th style="text-align: right">Amount</th></tr></thead>
          <tbody>${liabilityRows}</tbody>
        </table>
        <div class="totals">Total Liabilities: ${money(totalLiabilities)}</div>
        <div class="section-title">Equity</div>
        <table>
          <thead><tr><th>Account</th><th style="text-align: right">Amount</th></tr></thead>
          <tbody>${equityRows}</tbody>
        </table>
        <div class="totals">Total Equity: ${money(totalEquity)}</div>
        <div class="status ${isBalanced ? "balanced" : "unbalanced"}">${isBalanced ? "Balance Sheet Balanced" : "Balance Sheet Not Balanced"}</div>
      </body>
      </html>
    `;
    printHTML(html, { title: "Balance Sheet" });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            Balance Sheet
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Financial position as of {asOfDate ? new Date(asOfDate).toLocaleDateString() : "today"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
          <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-card)",
              color: "var(--color-text-primary)",
              fontSize: "13px"
            }}
          />
          <Button onClick={loadBalanceSheet} variant="secondary">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Total Assets" 
          value={money(totalAssets)} 
          icon="💰"
          trend={0}
        />
        <StatCard 
          title="Total Liabilities" 
          value={money(totalLiabilities)} 
          icon="📉"
          trend={0}
        />
        <StatCard 
          title="Total Equity" 
          value={money(totalEquity)}
          icon="📈"
          trend={0}
        />
        <StatCard 
          title="Balance Status" 
          value={isBalanced ? "Balanced ✅" : "Unbalanced ❌"}
          icon={isBalanced ? "⚖️" : "⚠️"}
          trend={0}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-4)" }}>
        {/* Assets Section */}
        <Card>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "16px" }}>
            💰 Assets
          </div>
          {balanceSheet?.assets?.length > 0 ? (
            <Table
              headers={["Account", "Amount"]}
              data={balanceSheet.assets.map(item => [
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.account_name}</span>,
                <span key="amount" style={{ fontWeight: 600, color: "var(--color-success)" }}>{money(item.amount || item.balance || 0)}</span>,
              ])}
            />
          ) : (
            <EmptyState icon="💰" title="No Assets" description="No asset accounts found." />
          )}
          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total Assets</span>
            <span style={{ color: "var(--color-success)" }}>{money(totalAssets)}</span>
          </div>
        </Card>

        {/* Liabilities Section */}
        <Card>
          <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "16px" }}>
            📉 Liabilities
          </div>
          {balanceSheet?.liabilities?.length > 0 ? (
            <Table
              headers={["Account", "Amount"]}
              data={balanceSheet.liabilities.map(item => [
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.account_name}</span>,
                <span key="amount" style={{ fontWeight: 600, color: "var(--color-danger)" }}>{money(item.amount || item.balance || 0)}</span>,
              ])}
            />
          ) : (
            <EmptyState icon="📉" title="No Liabilities" description="No liability accounts found." />
          )}
          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total Liabilities</span>
            <span style={{ color: "var(--color-danger)" }}>{money(totalLiabilities)}</span>
          </div>
        </Card>
      </div>

      {/* Equity Section */}
      <Card style={{ marginTop: "var(--space-4)" }}>
        <div style={{ fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "16px" }}>
          📈 Equity
        </div>
        {balanceSheet?.equity?.length > 0 ? (
          <Table
              headers={["Account", "Amount"]}
              data={balanceSheet.equity.map(item => [
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{item.account_name}</span>,
                <span key="amount" style={{ fontWeight: 600, color: "var(--color-primary)" }}>{money(item.amount || item.balance || 0)}</span>,
              ])}
            />
        ) : (
          <EmptyState icon="📈" title="No Equity" description="No equity accounts found." />
        )}
        <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
          <span>Total Equity</span>
          <span style={{ color: "var(--color-primary)" }}>{money(totalEquity)}</span>
        </div>
      </Card>

      {/* Balance Check */}
      <Card style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", background: isBalanced ? "var(--color-bg-success)" : "var(--color-bg-error)", border: `1px solid ${isBalanced ? "var(--color-border-success)" : "var(--color-border-error)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "var(--space-1)" }}>
              {isBalanced ? "Balance Sheet Balanced" : "Balance Sheet Not Balanced"}
            </div>
            <div style={{ fontSize: "13px", opacity: 0.8 }}>
              Assets = Liabilities + Equity
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14px", marginBottom: "var(--space-1)" }}>
              Assets: <span style={{ fontWeight: 700 }}>{money(totalAssets)}</span>
            </div>
            <div style={{ fontSize: "14px", marginBottom: "var(--space-1)" }}>
              Liabilities + Equity: <span style={{ fontWeight: 700 }}>{money(totalLiabilities + totalEquity)}</span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: isBalanced ? "var(--color-success)" : "var(--color-error)" }}>
              Difference: {money(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

BalanceSheetPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
