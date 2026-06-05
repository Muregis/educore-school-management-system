import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "./Btn";
import Badge from "./Badge";
import { apiFetch } from "../lib/api";
import { C } from "../lib/theme";

const DISCOUNT_LABELS = {
  sibling_2nd: "Sibling (2nd child)",
  sibling_3rd: "Sibling (3rd child)",
  sibling_4th_plus: "Sibling (4th+ child)",
  staff_child: "Staff Child",
  scholarship: "Scholarship",
  bursary: "Bursary",
  hardship: "Hardship",
  merit: "Academic Merit",
  sports: "Sports Excellence",
  custom: "Custom Discount"
};

export default function StudentDiscountPanel({ studentId, student, auth, toast, onDiscountChange }) {
  const [activeDiscounts, setActiveDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    discountType: "custom",
    discountValue: "",
    discountValueType: "percentage", // 'percentage' | 'fixed'
    reason: "",
    expiresAt: ""
  });

  useEffect(() => {
    if (studentId) {
      loadActiveDiscounts();
    }
  }, [studentId]);

  const loadActiveDiscounts = async () => {
    try {
      const data = await apiFetch(`/discounts/student/${studentId}`, { token: auth?.token });
      setActiveDiscounts(data || []);
    } catch (err) {
      // Silent fail - student may have no discounts
    }
  };

  const handleRemove = async (discountType) => {
    if (!confirm("Remove this discount?")) return;

    setLoading(true);
    try {
      await apiFetch("/discounts/remove", {
        method: "POST",
        token: auth?.token,
        body: {
          studentId: parseInt(studentId),
          discountType: discountType
        }
      });

      toast("Discount removed", "success");
      await loadActiveDiscounts();

      if (onDiscountChange) onDiscountChange();
    } catch (err) {
      toast(err.message || "Failed to remove discount", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDiscount = async () => {
    if (!form.discountValue || parseFloat(form.discountValue) <= 0) {
      return toast(`Please enter a valid discount ${form.discountValueType === "percentage" ? "percentage" : "amount"}`, "error");
    }

    setLoading(true);
    try {
      await apiFetch("/discounts/apply", {
        method: "POST",
        token: auth?.token,
        body: {
          studentId: parseInt(studentId),
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          discountValueType: form.discountValueType,
          reason: form.reason || DISCOUNT_LABELS[form.discountType] || "Manual discount",
          expiresAt: form.expiresAt || null
        }
      });

      const valueLabel = form.discountValueType === "percentage" ? `${form.discountValue}%` : `KES ${Number(form.discountValue).toLocaleString()}`;
      toast(`${valueLabel} discount applied`, "success");
      await loadActiveDiscounts();
      setShowAddForm(false);
      setForm({ discountType: "custom", discountValue: "", discountValueType: "percentage", reason: "", expiresAt: "" });

      if (onDiscountChange) onDiscountChange();
    } catch (err) {
      toast(err.message || "Failed to apply discount", "error");
    } finally {
      setLoading(false);
    }
  };

  // Find the highest active discount
  const highestDiscount = activeDiscounts.length > 0
    ? activeDiscounts.reduce((best, d) => (d.discount_value > best.discount_value ? d : best))
    : null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 600 }}>
          Fee Discounts
        </h4>
        <Btn size="small" onClick={() => setShowAddForm(true)}>
          + Add Discount
        </Btn>
      </div>

      {/* Highest Discount Banner */}
      {highestDiscount && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #c9a84c",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#c9a84c", marginBottom: 4 }}>
                HIGHEST DISCOUNT APPLIES
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
                {highestDiscount.discount_value_type === "fixed" ? `KES ${Number(highestDiscount.discount_value).toLocaleString()}` : `${highestDiscount.discount_value}%`} {DISCOUNT_LABELS[highestDiscount.discount_type] || highestDiscount.discount_type}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                {highestDiscount.reason}
              </div>
            </div>
            <Badge text="Active" tone="success" />
          </div>
        </div>
      )}

      {/* Active Discounts */}
      {activeDiscounts.length > 0 && (
        <div>
          <h5 style={{ margin: "0 0 12px 0", color: C.textSub, fontSize: 13, fontWeight: 500 }}>
            Active Discounts
          </h5>
          {activeDiscounts.map((discount) => (
            <div
              key={discount.discount_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                background: "#0d2e1a",
                border: "1px solid #166534",
                borderRadius: 8,
                marginBottom: 8
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#4ade80" }}>
                  {discount.discount_value_type === "fixed" ? `KES ${Number(discount.discount_value).toLocaleString()}` : `${discount.discount_value}%`} {discount.label}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{discount.reason}</div>
                {discount.expires_at && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    Expires: {new Date(discount.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              <Btn
                size="small"
                variant="ghost"
                onClick={() => handleRemove(discount.discount_type)}
                disabled={loading}
              >
                Remove
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* No Discounts Message */}
      {activeDiscounts.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: C.textMuted, fontSize: 13 }}>
          No discounts applied.
          <br />
          Click "Add Discount" to apply a fee reduction.
        </div>
      )}

      {/* Add Discount Form Modal */}
      {showAddForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 24,
              minWidth: "350px",
              maxWidth: "400px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: "0 0 20px 0", color: C.text }}>Add Discount</h4>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                Type
              </label>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text
                }}
              >
                <option value="custom">Custom Discount</option>
                <option value="sibling_2nd">Sibling (2nd child)</option>
                <option value="sibling_3rd">Sibling (3rd child)</option>
                <option value="sibling_4th_plus">Sibling (4th+ child)</option>
                <option value="staff_child">Staff Child</option>
                <option value="scholarship">Scholarship</option>
                <option value="bursary">Bursary</option>
                <option value="hardship">Hardship</option>
                <option value="merit">Academic Merit</option>
                <option value="sports">Sports Excellence</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                Discount Type *
              </label>
              <select
                value={form.discountValueType}
                onChange={(e) => setForm({ ...form, discountValueType: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (KES)</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                {form.discountValueType === "percentage" ? "Discount %" : "Discount Amount (KES)"} *
              </label>
              <input
                type="number"
                min="1"
                max={form.discountValueType === "percentage" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                placeholder={form.discountValueType === "percentage" ? "e.g. 25" : "e.g. 5000"}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                Reason (optional)
              </label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Financial hardship, academic excellence"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                Expires (optional)
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: C.text
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Btn>
              <Btn onClick={handleAddDiscount} disabled={loading}>
                {loading ? "Applying..." : "Apply Discount"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

StudentDiscountPanel.propTypes = {
  studentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  student: PropTypes.object,
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired,
  onDiscountChange: PropTypes.func
};
