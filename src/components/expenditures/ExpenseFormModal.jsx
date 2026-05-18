import PropTypes from "prop-types";
import { useState } from "react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Button from "../ui/Button";
import Card from "../ui/Card";
import ReceiptUploadWidget from "./ReceiptUploadWidget";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, validateMpesaCode, validateAmount } from "../../lib/expenditure.utils";

export default function ExpenseFormModal({
  isOpen,
  onClose,
  onSave,
  expense = null,
  loading = false,
}) {
  const [form, setForm] = useState(
    expense ? {
      expenseDate: expense.expense_date,
      category: expense.category,
      itemName: expense.item_name,
      description: expense.description || "",
      amount: String(expense.amount || ""),
      paymentMethod: expense.payment_method,
      vendorName: expense.vendor_name || "",
      payee: expense.paid_to_name || "",
      purpose: expense.purpose || "",
      referenceNumber: expense.reference_number || "",
      mpesaCode: expense.mpesa_code || "",
      receiptUrl: expense.receipt_url || "",
      notes: expense.notes || "",
    } : {
      expenseDate: new Date().toISOString().slice(0, 10),
      category: "Daily Use",
      itemName: "",
      description: "",
      amount: "",
      paymentMethod: "Cash",
      vendorName: "",
      payee: "",
      purpose: "",
      referenceNumber: "",
      mpesaCode: "",
      receiptUrl: "",
      notes: "",
    }
  );

  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!form.expenseDate.trim()) newErrors.expenseDate = "Date is required";
    if (!form.category.trim()) newErrors.category = "Category is required";
    if (!form.itemName.trim()) newErrors.itemName = "Item name is required";

    const amountValidation = validateAmount(form.amount);
    if (!amountValidation.valid) newErrors.amount = amountValidation.message;

    if (form.paymentMethod === "M-Pesa" && form.mpesaCode) {
      const mpesaValidation = validateMpesaCode(form.mpesaCode);
      if (!mpesaValidation.valid) newErrors.mpesaCode = mpesaValidation.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    onSave({
      ...form,
      amount: Number(form.amount),
      receipt,
    });
  };

  const isEditMode = !!expense;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Expense" : "Record Expense"}
      loading={loading}
      onSubmit={handleSubmit}
      submitText={isEditMode ? "Update" : "Record"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Date and Category Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Expense Date
            </label>
            <Input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              error={errors.expenseDate}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Category
            </label>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
              error={errors.category}
            />
          </div>
        </div>

        {/* Item Name */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
            Item Name
          </label>
          <Input
            placeholder="e.g., Monthly rent, Classroom whiteboard"
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            error={errors.itemName}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
            Description
          </label>
          <textarea
            placeholder="Additional details about the expense"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "8px 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              backgroundColor: "var(--color-bg-base)",
            }}
          />
        </div>

        {/* Amount and Payment Method */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Amount (KES)
            </label>
            <Input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={errors.amount}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Payment Method
            </label>
            <Select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
            />
          </div>
        </div>

        {/* M-Pesa Code (conditional) */}
        {form.paymentMethod === "M-Pesa" && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              M-Pesa Transaction Code
            </label>
            <Input
              placeholder="e.g., UE2JE2N2SK"
              value={form.mpesaCode}
              onChange={(e) => setForm({ ...form, mpesaCode: e.target.value.toUpperCase() })}
              error={errors.mpesaCode}
            />
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
              10-character code from M-Pesa confirmation SMS
            </div>
          </div>
        )}

        {/* Vendor and Payee */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Vendor / Supplier
            </label>
            <Input
              placeholder="Name of supplier or vendor"
              value={form.vendorName}
              onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Payee / Recipient
            </label>
            <Input
              placeholder="Who received the payment"
              value={form.payee}
              onChange={(e) => setForm({ ...form, payee: e.target.value })}
            />
          </div>
        </div>

        {/* Purpose and Reference */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Expense Purpose
            </label>
            <Input
              placeholder="Why was this expense incurred"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
              Reference Number
            </label>
            <Input
              placeholder="Receipt, invoice, or cheque number"
              value={form.referenceNumber}
              onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
            />
          </div>
        </div>

        {/* Receipt Upload */}
        <Card style={{ padding: "12px", backgroundColor: "var(--color-bg-hover)" }}>
          <ReceiptUploadWidget
            value={receipt}
            onChange={setReceipt}
            disabled={loading}
          />
        </Card>

        {/* Notes */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "var(--color-text-secondary)" }}>
            Additional Notes
          </label>
          <textarea
            placeholder="Any additional information"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{
              width: "100%",
              minHeight: "60px",
              padding: "8px 12px",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              fontFamily: "inherit",
              fontSize: "14px",
              color: "var(--color-text-primary)",
              backgroundColor: "var(--color-bg-base)",
            }}
          />
        </div>

        {/* Form Info */}
        <div
          style={{
            padding: "12px",
            backgroundColor: "var(--color-bg-hover)",
            borderRadius: "4px",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>ℹ️ Note:</div>
          <div>This expense will be submitted for approval. The bursar and principal will review it before payment authorization.</div>
        </div>
      </div>
    </Modal>
  );
}

ExpenseFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  expense: PropTypes.object,
  loading: PropTypes.bool,
};
