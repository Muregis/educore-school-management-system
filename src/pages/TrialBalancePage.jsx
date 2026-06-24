import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";

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
        <Button onClick={loadTrialBalance} variant="secondary">
          🔄 Refresh
        </Button>
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
