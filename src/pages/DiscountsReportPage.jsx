import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Table from "../components/Table";
import Badge from "../components/Badge";
import { apiFetch } from "../lib/api";
import { C } from "../lib/theme";
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
      <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>
        Loading discounts report...
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: C.text, fontSize: 24, fontWeight: 700 }}>
            Active Discounts Report
          </h2>
          <p style={{ margin: "8px 0 0 0", color: C.textMuted, fontSize: 14 }}>
            Students with fee discounts applied
          </p>
        </div>
        <Btn onClick={loadDiscountedStudents}>🔄 Refresh</Btn>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>Total Students with Discounts</div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 28 }}>{totalStudents}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>Total Fee Reduction</div>
          <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 28 }}>{money(totalDiscountAmount)}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>Sibling Discounts</div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 28 }}>
            {(byType.sibling_2nd?.count || 0) + (byType.sibling_3rd?.count || 0) + (byType.sibling_4th_plus?.count || 0)}
          </div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>Staff/Other Discounts</div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 28 }}>
            {(byType.staff_child?.count || 0) + (byType.scholarship?.count || 0) + (byType.bursary?.count || 0) + (byType.custom?.count || 0)}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Btn
          variant={filterType === "all" ? "primary" : "ghost"}
          onClick={() => setFilterType("all")}
        >
          All Types
        </Btn>
        {discountTypes.map(type => (
          <Btn
            key={type}
            variant={filterType === type ? "primary" : "ghost"}
            onClick={() => setFilterType(type)}
          >
            {DISCOUNT_LABELS[type] || type} ({byType[type].count})
          </Btn>
        ))}
      </div>

      {/* Discounts Table */}
      {filteredStudents.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
          No students with discounts found.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <Table
            headers={["Student", "Class", "Admission #", "Parent", "Discount Type", "%", "Amount Saved", "Approved By", "Date"]}
            rows={filteredStudents.map(d => [
              <span key="name" style={{ color: C.text, fontWeight: 600 }}>
                {d.student?.first_name} {d.student?.last_name}
              </span>,
              <span key="class" style={{ fontSize: 13 }}>{d.student?.class_name || "—"}</span>,
              <span key="adm" style={{ fontSize: 12, color: C.textMuted }}>{d.student?.admission_number || "—"}</span>,
              <span key="parent" style={{ fontSize: 13 }}>{d.student?.parent_name || "—"}</span>,
              <Badge
                key="type"
                text={DISCOUNT_LABELS[d.discount_type] || d.discount_type}
                tone={d.discount_type === "staff_child" ? "info" : d.discount_type === "scholarship" ? "success" : "warning"}
              />,
              <span key="percent" style={{ fontWeight: 600, color: "#22c55e" }}>{d.discount_value}%</span>,
              <span key="amount" style={{ fontWeight: 600 }}>{money(d.discount_amount || 0)}</span>,
              <span key="approver" style={{ fontSize: 13, color: C.textMuted }}>{d.approver?.full_name || "—"}</span>,
              <span key="date" style={{ fontSize: 12, color: C.textMuted }}>
                {d.approved_at ? new Date(d.approved_at).toLocaleDateString() : "—"}
              </span>
            ])}
          />
        </div>
      )}

      {/* Breakdown by Type */}
      {discountTypes.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h4 style={{ color: C.text, marginBottom: 16 }}>Summary by Discount Type</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {discountTypes.map(type => (
              <div
                key={type}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 16
                }}
              >
                <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>
                  {DISCOUNT_LABELS[type] || type}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: 20 }}>
                    {byType[type].count} students
                  </span>
                  <span style={{ color: "#22c55e", fontWeight: 600 }}>
                    {money(byType[type].amount)}
                  </span>
                </div>
              </div>
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
