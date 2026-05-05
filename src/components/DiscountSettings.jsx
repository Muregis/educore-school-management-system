import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import Btn from "./Btn";
import { apiFetch } from "../lib/api";
import { C } from "../lib/theme";

const DISCOUNT_LABELS = {
  sibling_2nd: "2nd child from same family",
  sibling_3rd: "3rd child from same family",
  sibling_4th_plus: "4th child and above",
  staff_child: "Staff member's child",
  scholarship: "Scholarship (Full)",
  bursary: "Bursary (Partial)"
};

export default function DiscountSettings({ isOpen, onClose, auth, toast }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/discounts/config", { token: auth?.token });
      setConfigs(data || []);
    } catch (err) {
      toast("Failed to load discount settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (discountType, newValue) => {
    setConfigs(prev =>
      prev.map(c =>
        c.discount_type === discountType
          ? { ...c, discount_value: Math.min(100, Math.max(0, parseFloat(newValue) || 0)) }
          : c
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/discounts/config", {
        method: "PATCH",
        token: auth?.token,
        body: { configs }
      });
      toast("Discount settings saved", "success");
      onClose();
    } catch (err) {
      toast(err.message || "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  // Group configs by category
  const siblingConfigs = configs.filter(c => c.discount_type.startsWith("sibling_"));
  const staffConfigs = configs.filter(c => c.discount_type === "staff_child");
  const otherConfigs = configs.filter(c => !["sibling_2nd", "sibling_3rd", "sibling_4th_plus", "staff_child"].includes(c.discount_type));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fee Discount Settings">
      <div style={{ minWidth: "500px", maxWidth: "600px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
            Loading settings...
          </div>
        ) : (
          <>
            {/* Sibling Discounts */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ margin: "0 0 16px 0", color: C.text, fontSize: 16, fontWeight: 600 }}>
                Sibling Discounts
              </h4>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                {siblingConfigs.map(config => (
                  <div
                    key={config.discount_type}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: siblingConfigs.indexOf(config) < siblingConfigs.length - 1 ? `1px solid ${C.border}` : "none"
                    }}
                  >
                    <span style={{ color: C.textSub, fontSize: 14 }}>
                      {DISCOUNT_LABELS[config.discount_type] || config.discount_type}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.discount_value}
                        onChange={(e) => handleValueChange(config.discount_type, e.target.value)}
                        style={{
                          width: 60,
                          padding: "6px 10px",
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          background: C.surface,
                          color: C.text,
                          textAlign: "center",
                          fontSize: 14
                        }}
                      />
                      <span style={{ color: C.textMuted, fontSize: 14 }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Discounts */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ margin: "0 0 16px 0", color: C.text, fontSize: 16, fontWeight: 600 }}>
                Staff Discounts
              </h4>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                {staffConfigs.map(config => (
                  <div
                    key={config.discount_type}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0"
                    }}
                  >
                    <span style={{ color: C.textSub, fontSize: 14 }}>
                      {DISCOUNT_LABELS[config.discount_type] || config.discount_type}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.discount_value}
                        onChange={(e) => handleValueChange(config.discount_type, e.target.value)}
                        style={{
                          width: 60,
                          padding: "6px 10px",
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          background: C.surface,
                          color: C.text,
                          textAlign: "center",
                          fontSize: 14
                        }}
                      />
                      <span style={{ color: C.textMuted, fontSize: 14 }}>%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <div
              style={{
                background: "#0f172a",
                border: "1px solid #1e3a5f",
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
                fontSize: 12,
                color: "#60a5fa"
              }}
            >
              <strong>Note:</strong> If a student has multiple discounts, only the
              <strong> highest discount</strong> applies. Discounts are not stacked.
              <br /><br />
              Apply discounts directly to students from the Fees page — no eligibility checks required.
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Btn>
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

DiscountSettings.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
