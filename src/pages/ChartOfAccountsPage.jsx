import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import { apiFetch } from "../lib/api";

export default function ChartOfAccountsPage({ auth, toast }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/finance/accounts", { token: auth?.token });
      setAccounts(data || []);
    } catch (err) {
      toast("Failed to load chart of accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = filterType === "all" 
    ? accounts 
    : accounts.filter(acc => acc.account_type === filterType);

  const accountTypes = [...new Set(accounts.map(acc => acc.account_type))];
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(acc => acc.is_active !== false).length;

  const ACCOUNT_TYPE_COLORS = {
    asset: "var(--color-info)",
    liability: "var(--color-warning)",
    equity: "var(--color-success)",
    revenue: "var(--color-primary)",
    expense: "var(--color-danger)"
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading chart of accounts...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            Chart of Accounts
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Complete list of all financial accounts
          </p>
        </div>
        <Button onClick={loadAccounts} variant="secondary">
          🔄 Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Total Accounts" 
          value={totalAccounts} 
          icon="📊"
          trend={0}
        />
        <StatCard 
          title="Active Accounts" 
          value={activeAccounts} 
          icon="✅"
          trend={0}
        />
        <StatCard 
          title="Account Types" 
          value={accountTypes.length} 
          icon="🏷️"
          trend={0}
        />
        <StatCard 
          title="Inactive" 
          value={totalAccounts - activeAccounts} 
          icon="⏸️"
          trend={0}
        />
      </div>

      {/* Filter */}
      <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button
            variant={filterType === "all" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilterType("all")}
          >
            All Types
          </Button>
          {accountTypes.map(type => (
            <Button
              key={type}
              variant={filterType === type ? "primary" : "ghost"}
              size="sm"
              onClick={() => setFilterType(type)}
              style={{ textTransform: "capitalize" }}
            >
              {type}
            </Button>
          ))}
        </div>
      </Card>

      {/* Accounts Table */}
      <Card>
        {filteredAccounts.length === 0 ? (
          <div style={{ padding: "60px var(--space-4)" }}>
            <EmptyState icon="📊" title="No Accounts" description="No chart of accounts found." />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Account Code", "Account Name", "Type", "Subtype", "Balance Type", "Status"]}
              data={filteredAccounts.map(acc => [
                <span key="code" style={{ fontFamily: "monospace", fontWeight: 600 }}>{acc.account_code || "—"}</span>,
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{acc.account_name}</span>,
                <span 
                  key="type" 
                  style={{ 
                    fontSize: "13px", 
                    textTransform: "capitalize",
                    color: ACCOUNT_TYPE_COLORS[acc.account_type] || "var(--color-text-primary)",
                    fontWeight: 600
                  }}
                >
                  {acc.account_type}
                </span>,
                <span key="subtype" style={{ fontSize: "13px", textTransform: "capitalize" }}>{acc.account_subtype || "—"}</span>,
                <span key="balance" style={{ fontSize: "13px", textTransform: "capitalize" }}>{acc.normal_balance || "—"}</span>,
                <span key="status" style={{ 
                  fontSize: "12px", 
                  fontWeight: 700,
                  color: acc.is_active !== false ? "var(--color-success)" : "var(--color-text-muted)"
                }}>
                  {acc.is_active !== false ? "Active" : "Inactive"}
                </span>,
              ])}
            />
          </div>
        )}
      </Card>

      {/* Account Type Breakdown */}
      {accountTypes.length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <h3 style={{ color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "18px" }}>Accounts by Type</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
            {accountTypes.map(type => {
              const typeAccounts = accounts.filter(acc => acc.account_type === type);
              return (
                <Card
                  key={type}
                  style={{ padding: "var(--space-4)" }}
                >
                  <div style={{ 
                    color: ACCOUNT_TYPE_COLORS[type] || "var(--color-text-secondary)", 
                    fontSize: "12px", 
                    marginBottom: "var(--space-2)", 
                    fontWeight: 500,
                    textTransform: "capitalize"
                  }}>
                    {type}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--color-text-primary)", fontWeight: 700, fontSize: "20px" }}>
                      {typeAccounts.length} <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-secondary)" }}>accounts</span>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

ChartOfAccountsPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
