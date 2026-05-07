import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";

const DISCOUNT_LABELS = {
  sibling_2nd: "Sibling (2nd child)",
  sibling_3rd: "Sibling (3rd child)",
  sibling_4th_plus: "Sibling (4th+ child)",
  staff_child: "Staff Child",
  scholarship: "Scholarship",
  bursary: "Bursary",
  custom: "Custom Discount"
};

export default function DiscountsReportPage({ auth, toast }) {
  const [discountedStudents, setDiscountedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadDiscountedStudents();
  }, []);

  const loadDiscountedStudents = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/discounts/students", { token: auth?.token });
      setDiscountedStudents(data || []);
    } catch (err) {
      toast("Failed to load discounts report", "error");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalStudents = discountedStudents.length;
  const totalDiscountAmount = discountedStudents.reduce((sum, d) => sum + (d.discount_amount || 0), 0);

  // Group by discount type
  const byType = discountedStudents.reduce((acc, d) => {
    const type = d.discount_type;
    if (!acc[type]) acc[type] = { count: 0, amount: 0 };
    acc[type].count++;
    acc[type].amount += d.discount_amount || 0;
    return acc;
  }, {});

  // Filter students
  const filteredStudents = filterType === "all"
    ? discountedStudents
    : discountedStudents.filter(d => d.discount_type === filterType);

  const discountTypes = Object.keys(byType);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading discounts report...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            Active Discounts Report
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Students with fee discounts applied
          </p>
        </div>
        <Button onClick={loadDiscountedStudents} variant="secondary">
          🔄 Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Total Students with Discounts" 
          value={totalStudents} 
          icon="👥"
          trend={0}
        />
        <StatCard 
          title="Total Fee Reduction" 
          value={money(totalDiscountAmount)} 
          icon="💰"
          trend={0}
        />
        <StatCard 
          title="Sibling Discounts" 
          value={(byType.sibling_2nd?.count || 0) + (byType.sibling_3rd?.count || 0) + (byType.sibling_4th_plus?.count || 0)} 
          icon="👨‍👩‍👧‍👦"
          trend={0}
        />
        <StatCard 
          title="Staff/Other Discounts" 
          value={(byType.staff_child?.count || 0) + (byType.scholarship?.count || 0) + (byType.bursary?.count || 0) + (byType.custom?.count || 0)} 
          icon="🏷️"
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
          {discountTypes.map(type => (
            <Button
              key={type}
              variant={filterType === type ? "primary" : "ghost"}
              size="sm"
              onClick={() => setFilterType(type)}
            >
              {DISCOUNT_LABELS[type] || type} ({byType[type].count})
            </Button>
          ))}
        </div>
      </Card>

      {/* Discounts Table */}
      <Card>
        {filteredStudents.length === 0 ? (
          <div style={{ padding: "60px var(--space-4)" }}>
            <EmptyState icon="🏷️" title="No Discounts" description="No students with discounts found." />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Student", "Class", "Admission #", "Parent", "Discount Type", "%", "Amount Saved", "Approved By", "Date"]}
              data={filteredStudents.map(d => [
                <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                  {d.student?.first_name} {d.student?.last_name}
                </span>,
                <span key="class" style={{ fontSize: "13px" }}>{d.student?.class_name || "—"}</span>,
                <span key="adm" style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{d.student?.admission_number || "—"}</span>,
                <span key="parent" style={{ fontSize: "13px" }}>{d.student?.parent_name || "—"}</span>,
                <Badge
                  key="type"
                  text={DISCOUNT_LABELS[d.discount_type] || d.discount_type}
                  variant={d.discount_type === "staff_child" ? "info" : d.discount_type === "scholarship" ? "success" : "warning"}
                />,
                <span key="percent" style={{ fontWeight: 600, color: "var(--color-success)" }}>{d.discount_value}%</span>,
                <span key="amount" style={{ fontWeight: 600 }}>{money(d.discount_amount || 0)}</span>,
                <span key="approver" style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>{d.approver?.full_name || "—"}</span>,
                <span key="date" style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                  {d.approved_at ? new Date(d.approved_at).toLocaleDateString() : "—"}
                </span>
              ])}
            />
          </div>
        )}
      </Card>

      {/* Breakdown by Type */}
      {discountTypes.length > 0 && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <h3 style={{ color: "var(--color-text-primary)", marginBottom: "var(--space-4)", fontSize: "18px" }}>Summary by Discount Type</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
            {discountTypes.map(type => (
              <Card
                key={type}
                style={{ padding: "var(--space-4)" }}
              >
                <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", marginBottom: "var(--space-2)", fontWeight: 500 }}>
                  {DISCOUNT_LABELS[type] || type}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--color-text-primary)", fontWeight: 700, fontSize: "20px" }}>
                    {byType[type].count} <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text-secondary)" }}>students</span>
                  </span>
                  <span style={{ color: "var(--color-success)", fontWeight: 600, fontSize: "15px" }}>
                    {money(byType[type].amount)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

DiscountsReportPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
