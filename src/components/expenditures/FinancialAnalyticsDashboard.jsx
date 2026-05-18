import PropTypes from "prop-types";
import Card from "../ui/Card";
import { formatCurrency, getCategoryColor, formatPercentage } from "../../lib/expenditure.utils";

export default function FinancialAnalyticsDashboard({ summary, monthlyData }) {
  if (!summary) {
    return (
      <Card style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading analytics...
      </Card>
    );
  }

  const {
    totals = {},
    byCategory = [],
  } = summary;

  // Calculate percentages
  const totalExpenses = totals.total || 0;
  const approvedAmount = totals.approved || 0;
  const pendingAmount = totals.pending || 0;
  const rejectedAmount = totals.rejected || 0;

  // Top categories with percentages
  const categoriesWithPercentages = byCategory.map((cat) => ({
    ...cat,
    percentage: ((cat.amount / totalExpenses) * 100).toFixed(1),
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
      {/* Total Breakdown */}
      <Card style={{ padding: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>
          Total Breakdown
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>Total Expenses</span>
            <span style={{ fontWeight: 700, color: "#ef4444", fontSize: "16px" }}>
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>Manual Expenses</span>
            <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
              {formatCurrency(totals.manual || 0)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>Payroll Costs</span>
            <span style={{ fontWeight: 700, color: "#f97316" }}>
              {formatCurrency(totals.payroll || 0)}
            </span>
          </div>
        </div>
      </Card>

      {/* Approval Status */}
      <Card style={{ padding: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>
          Approval Status
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>✓ Approved</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>
              {formatCurrency(approvedAmount)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>⏳ Pending</span>
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>
              {formatCurrency(pendingAmount)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>✗ Rejected</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>
              {formatCurrency(rejectedAmount)}
            </span>
          </div>
        </div>
      </Card>

      {/* Category Breakdown */}
      <Card style={{ padding: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>
          Top 5 Categories
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {categoriesWithPercentages.slice(0, 5).map((cat, idx) => (
            <div key={cat.category}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ color: "var(--color-text-primary)", fontSize: "12px", fontWeight: 500 }}>
                  {idx + 1}. {cat.category}
                </span>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>
                  {cat.percentage}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  backgroundColor: "var(--color-bg-hover)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${cat.percentage}%`,
                    height: "100%",
                    backgroundColor: getCategoryColor(cat.category),
                    borderRadius: "2px",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Statistics */}
      <Card style={{ padding: "16px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "12px" }}>
          Statistics
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>Total Transactions</span>
            <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--color-primary)" }}>
              {totals.transactions || 0}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>Payroll Entries</span>
            <span style={{ fontWeight: 700, fontSize: "18px", color: "#f97316" }}>
              {totals.payrollEntries || 0}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-text-primary)", fontSize: "13px" }}>Categories</span>
            <span style={{ fontWeight: 700, fontSize: "18px", color: "var(--color-success)" }}>
              {byCategory.length}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

FinancialAnalyticsDashboard.propTypes = {
  summary: PropTypes.shape({
    totals: PropTypes.object,
    byCategory: PropTypes.array,
  }),
  monthlyData: PropTypes.array,
};
