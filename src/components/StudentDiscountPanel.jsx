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
  custom: "Custom Discount"
};

export default function StudentDiscountPanel({ studentId, student, auth, toast, onDiscountChange }) {
  const [detected, setDetected] = useState([]);
  const [activeDiscounts, setActiveDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    discountType: "custom",
    discountValue: "",
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

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const data = await apiFetch(`/discounts/detect/${studentId}`, { token: auth?.token });
      setDetected(data.qualifies || []);

      if (data.qualifies.length === 0 && data.existingDiscounts.length === 0) {
        toast("No discounts detected for this student", "info");
      }
    } catch (err) {
      toast(err.message || "Failed to detect discounts", "error");
    } finally {
      setDetecting(false);
    }
  };

  const handleApply = async (discount) => {
    setLoading(true);
    try {
      await apiFetch("/discounts/apply", {
        method: "POST",
        token: auth?.token,
        body: {
          studentId: parseInt(studentId),
          discountType: discount.type,
          discountValue: discount.discountPercent,
          reason: discount.reason
        }
      });

      toast(`${discount.discountPercent}% ${DISCOUNT_LABELS[discount.type]} applied`, "success");
      await loadActiveDiscounts();
      setDetected(prev => prev.filter(d => d.type !== discount.type));

      if (onDiscountChange) onDiscountChange();
    } catch (err) {
      toast(err.message || "Failed to apply discount", "error");
    } finally {
      setLoading(false);
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

  const handleApplyManual = async () => {
    if (!manualForm.discountValue || parseFloat(manualForm.discountValue) <= 0) {
      return toast("Please enter a valid discount percentage", "error");
    }
    if (!manualForm.reason.trim()) {
      return toast("Please provide a reason for the discount", "error");
    }

    setLoading(true);
    try {
      await apiFetch("/discounts/apply", {
        method: "POST",
        token: auth?.token,
        body: {
          studentId: parseInt(studentId),
          discountType: manualForm.discountType,
          discountValue: parseFloat(manualForm.discountValue),
          reason: manualForm.reason,
          expiresAt: manualForm.expiresAt || null
        }
      });

      toast(`${manualForm.discountValue}% discount applied`, "success");
      await loadActiveDiscounts();
      setShowManualForm(false);
      setManualForm({ discountType: "custom", discountValue: "", reason: "", expiresAt: "" });

      if (onDiscountChange) onDiscountChange();
    } catch (err) {
      toast(err.message || "Failed to apply discount", "error");
    } finally {
      setLoading(false);
    }
  };

  // Find the highest discount from detected and active
  const allDiscounts = [...detected, ...activeDiscounts.map(d => ({ ...d, type: d.discount_type, discountPercent: d.discount_value, isActive: true }))];
  const highestDiscount = allDiscounts.length > 0
    ? allDiscounts.reduce((best, d) => (d.discountPercent > best.discountPercent ? d : best))
    : null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 style={{ margin: 0, color: C.text, fontSize: 16, fontWeight: 600 }}>
          Fee Discounts
        </h4>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn size="small" variant="ghost" onClick={handleDetect} disabled={detecting}>
            {detecting ? "Checking..." : "Check Eligibility"}
          </Btn>
          <Btn size="small" onClick={() => setShowManualForm(true)}>
            + Manual
          </Btn>
        </div>
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
                {highestDiscount.discountPercent}% {DISCOUNT_LABELS[highestDiscount.type] || highestDiscount.label}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                {highestDiscount.reason}
              </div>
            </div>
            {highestDiscount.isActive && (
              <Badge text="Active" tone="success" />
            )}
          </div>
        </div>
      )}

      {/* Auto-detected Discounts */}
      {detected.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h5 style={{ margin: "0 0 12px 0", color: C.textSub, fontSize: 13, fontWeight: 500 }}>
            Auto-detected (Not yet applied)
          </h5>
          {detected.map((discount, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                background: C.surface,
                borderRadius: 8,
                marginBottom: 8
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {discount.discountPercent}% {discount.label}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{discount.reason}</div>
                {discount.siblings && discount.siblings.length > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    Siblings: {discount.siblings.join(", ")}
                  </div>
                )}
              </div>
              <Btn size="small" onClick={() => handleApply(discount)} disabled={loading}>
                Apply
              </Btn>
            </div>
          ))}
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
                  {discount.discount_value}% {discount.label}
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
      {detected.length === 0 && activeDiscounts.length === 0 && !detecting && (
        <div style={{ textAlign: "center", padding: 24, color: C.textMuted, fontSize: 13 }}>
          No discounts configured for this student.
          <br />
          Click "Check Eligibility" to auto-detect sibling or staff discounts.
        </div>
      )}

      {/* Manual Discount Form Modal */}
      {showManualForm && (
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
          onClick={() => setShowManualForm(false)}
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
            <h4 style={{ margin: "0 0 20px 0", color: C.text }}>Apply Manual Discount</h4>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                Type
              </label>
              <select
                value={manualForm.discountType}
                onChange={(e) => setManualForm({ ...manualForm, discountType: e.target.value })}
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
                <option value="scholarship">Scholarship</option>
                <option value="bursary">Bursary</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.textMuted, fontSize: 12, marginBottom: 6 }}>
                Discount % *
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={manualForm.discountValue}
                onChange={(e) => setManualForm({ ...manualForm, discountValue: e.target.value })}
                placeholder="e.g. 25"
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
                Reason *
              </label>
              <input
                type="text"
                value={manualForm.reason}
                onChange={(e) => setManualForm({ ...manualForm, reason: e.target.value })}
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
                value={manualForm.expiresAt}
                onChange={(e) => setManualForm({ ...manualForm, expiresAt: e.target.value })}
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
              <Btn variant="ghost" onClick={() => setShowManualForm(false)}>
                Cancel
              </Btn>
              <Btn onClick={handleApplyManual} disabled={loading}>
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
