# ExpendituresPage Enhancement - Step-by-Step Integration Guide

## Overview

This guide shows how to progressively enhance `src/pages/ExpendituresPage.jsx` with the new features created during this enhancement project.

## Step 1: Update Imports

Replace the import section with:

```javascript
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  APPROVAL_STATUSES,
  formatCurrency,
  formatDate,
  formatPercentage,
  getStatusColor,
  getStatusLabel,
} from "../lib/expenditure.utils";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";
import Badge from "../components/ui/Badge";

// New Components
import ExpenseFormModal from "../components/expenditures/ExpenseFormModal";
import ApprovalStatusBadge from "../components/expenditures/ApprovalStatusBadge";
import FinancialAnalyticsDashboard from "../components/expenditures/FinancialAnalyticsDashboard";
import ExportMenuComponent from "../components/expenditures/ExportMenuComponent";
```

## Step 2: Update State Management

Add new state variables to the ExpendituresPage component:

```javascript
// Existing state
const [expenses, setExpenses] = useState([]);
const [summary, setSummary] = useState(null);
const [loading, setLoading] = useState(true);
const [showModal, setShowModal] = useState(false);
const [saving, setSaving] = useState(false);
const [editingExpense, setEditingExpense] = useState(null);
const [categoryFilter, setCategoryFilter] = useState("all");
const [search, setSearch] = useState("");
const [form, setForm] = useState(blankForm());

// NEW: Advanced filtering and approval state
const [approvalStatusFilter, setApprovalStatusFilter] = useState("all");
const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
const [amountFrom, setAmountFrom] = useState("");
const [amountTo, setAmountTo] = useState("");
const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
const [approvingId, setApprovingId] = useState(null);
const [rejectingId, setRejectingId] = useState(null);
const [rejectionReason, setRejectionReason] = useState("");
const [showRejectModal, setShowRejectModal] = useState(false);
```

## Step 3: Add Approval Workflow Functions

Add these new async functions to handle approvals:

```javascript
const approveExpense = async (expenseId) => {
  try {
    setApprovingId(expenseId);
    const updated = await apiFetch(`/expenditures/${expenseId}/approve`, {
      method: "POST",
      token: auth.token,
    });
    
    // Update local state
    setExpenses(expenses.map(e => e.expenditure_id === expenseId ? updated : e));
    toast("Expense approved successfully", "success");
    await loadData(); // Refresh summary
  } catch (error) {
    toast(error.message || "Failed to approve expense", "error");
  } finally {
    setApprovingId(null);
  }
};

const rejectExpense = async (expenseId) => {
  if (!rejectionReason.trim()) {
    toast("Please provide a rejection reason", "error");
    return;
  }
  
  try {
    setRejectingId(expenseId);
    const updated = await apiFetch(`/expenditures/${expenseId}/reject`, {
      method: "POST",
      token: auth.token,
      body: { rejectionReason },
    });
    
    setExpenses(expenses.map(e => e.expenditure_id === expenseId ? updated : e));
    toast("Expense rejected", "success");
    setShowRejectModal(false);
    setRejectionReason("");
    await loadData();
  } catch (error) {
    toast(error.message || "Failed to reject expense", "error");
  } finally {
    setRejectingId(null);
  }
};

const resetAdvancedFilters = () => {
  setApprovalStatusFilter("all");
  setPaymentMethodFilter("all");
  setDateFrom("");
  setDateTo("");
  setAmountFrom("");
  setAmountTo("");
  setSearch("");
  setCategoryFilter("all");
};
```

## Step 4: Update Filtering Logic

Replace the existing `filteredExpenses` useMemo with:

```javascript
const filteredExpenses = useMemo(() => {
  return expenses.filter((expense) => {
    // Category filter
    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
    
    // Approval status filter
    const matchesStatus = 
      approvalStatusFilter === "all" || 
      (expense.approval_status || "pending") === approvalStatusFilter;
    
    // Payment method filter
    const matchesMethod = 
      paymentMethodFilter === "all" || 
      expense.payment_method === paymentMethodFilter;
    
    // Date range filter
    const expenseDate = new Date(expense.expense_date);
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    
    const matchesDateRange = 
      (!fromDate || expenseDate >= fromDate) && 
      (!toDate || expenseDate <= toDate);
    
    // Amount range filter
    const amount = Number(expense.amount || 0);
    const minAmount = amountFrom ? Number(amountFrom) : null;
    const maxAmount = amountTo ? Number(amountTo) : null;
    
    const matchesAmountRange = 
      (!minAmount || amount >= minAmount) && 
      (!maxAmount || amount <= maxAmount);
    
    // Search filter
    const haystack = [
      expense.item_name,
      expense.vendor_name,
      expense.paid_to_name,
      expense.released_by_name,
      expense.purpose,
      expense.reference_number,
      expense.description,
      expense.mpesa_code,
    ].join(" ").toLowerCase();
    
    const matchesSearch = !search.trim() || 
      haystack.includes(search.trim().toLowerCase());
    
    return matchesCategory && 
           matchesStatus && 
           matchesMethod && 
           matchesDateRange && 
           matchesAmountRange && 
           matchesSearch;
  });
}, [
  expenses, 
  categoryFilter, 
  approvalStatusFilter, 
  paymentMethodFilter,
  dateFrom,
  dateTo,
  amountFrom,
  amountTo,
  search
]);
```

## Step 5: Update Form Handling

Replace the form save logic:

```javascript
const saveExpense = async (formData) => {
  setSaving(true);
  try {
    const payload = {
      expenseDate: formData.expenseDate,
      category: formData.category,
      itemName: formData.itemName.trim(),
      description: formData.description.trim(),
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      vendorName: formData.vendorName.trim(),
      paidToName: formData.payee.trim(),
      purpose: formData.purpose.trim(),
      referenceNumber: formData.referenceNumber.trim(),
      mpesaCode: formData.mpesaCode || null,
      receiptUrl: formData.receiptUrl || null,
      notes: formData.notes.trim(),
    };

    if (editingExpense) {
      await apiFetch(`/expenditures/${editingExpense.expenditure_id}`, {
        method: "PUT",
        token: auth.token,
        body: payload,
      });
      toast("Expense updated", "success");
    } else {
      await apiFetch("/expenditures", {
        method: "POST",
        token: auth.token,
        body: payload,
      });
      toast("Expense recorded", "success");
    }

    setShowModal(false);
    setEditingExpense(null);
    await loadData();
  } catch (error) {
    toast(error.message || "Failed to save expense", "error");
  } finally {
    setSaving(false);
  }
};
```

## Step 6: Replace Modal in Render

Replace the existing Modal component with:

```jsx
<ExpenseFormModal
  isOpen={showModal}
  onClose={() => {
    setShowModal(false);
    setEditingExpense(null);
  }}
  onSave={saveExpense}
  expense={editingExpense}
  loading={saving}
/>
```

## Step 7: Add Advanced Filters Section

Add this section in the render before the table:

```jsx
<Card style={{ padding: "var(--space-4)" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)" }}>
      Filters & Export
    </div>
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <Button 
        size="sm"
        variant="secondary"
        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
      >
        {showAdvancedFilters ? "Hide" : "Show"} Advanced
      </Button>
      <Button 
        size="sm"
        variant="secondary"
        onClick={resetAdvancedFilters}
        disabled={
          categoryFilter === "all" && 
          approvalStatusFilter === "all" &&
          paymentMethodFilter === "all" &&
          !dateFrom && !dateTo && !amountFrom && !amountTo && !search
        }
      >
        Clear Filters
      </Button>
      <ExportMenuComponent 
        expenses={filteredExpenses}
        summary={summary}
        disabled={filteredExpenses.length === 0}
      />
    </div>
  </div>

  {/* Basic Filters */}
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
    <div>
      <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
        Search
      </label>
      <Input
        placeholder="Item, vendor, payee..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
    <div>
      <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
        Category
      </label>
      <Select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        options={[
          { value: "all", label: "All categories" },
          ...EXPENSE_CATEGORIES.map(cat => ({ value: cat, label: cat })),
        ]}
      />
    </div>
    <div>
      <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
        Approval Status
      </label>
      <Select
        value={approvalStatusFilter}
        onChange={(e) => setApprovalStatusFilter(e.target.value)}
        options={[
          { value: "all", label: "All statuses" },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]}
      />
    </div>
  </div>

  {/* Advanced Filters */}
  {showAdvancedFilters && (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
          Payment Method
        </label>
        <Select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
          options={[
            { value: "all", label: "All methods" },
            ...PAYMENT_METHODS.map(method => ({ value: method, label: method })),
          ]}
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
          Date From
        </label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
          Date To
        </label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
          Amount From (KES)
        </label>
        <Input
          type="number"
          value={amountFrom}
          onChange={(e) => setAmountFrom(e.target.value)}
        />
      </div>
      <div>
        <label style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px", display: "block", color: "var(--color-text-secondary)" }}>
          Amount To (KES)
        </label>
        <Input
          type="number"
          value={amountTo}
          onChange={(e) => setAmountTo(e.target.value)}
        />
      </div>
    </div>
  )}
</Card>
```

## Step 8: Add Analytics Dashboard

Add this after the stat cards:

```jsx
<FinancialAnalyticsDashboard 
  summary={summary}
  monthlyData={summary?.monthlyTrend}
/>
```

## Step 9: Update Table with Approval Status

Replace the expense records table with:

```jsx
<Table
  headers={[
    "Date",
    "Category",
    "Item",
    "Payee",
    "Amount",
    "M-Pesa",
    "Status",
    "Actions"
  ]}
  loading={loading}
  data={filteredExpenses.slice(0, 50).map((expense) => [
    <span key="date" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
      {formatDate(expense.expense_date)}
    </span>,
    <Badge key="category" text={expense.category} tone={toneForCategory(expense.category)} />,
    <div key="item">
      <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
        {expense.item_name}
      </div>
      {expense.description && (
        <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "2px" }}>
          {expense.description.substring(0, 50)}...
        </div>
      )}
    </div>,
    <span key="payee" style={{ color: "var(--color-text-primary)" }}>
      {expense.paid_to_name || expense.vendor_name || "-"}
    </span>,
    <span key="amount" style={{ color: "var(--color-danger)", fontWeight: 800 }}>
      {formatCurrency(expense.amount)}
    </span>,
    <span key="mpesa" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-muted)" }}>
      {expense.mpesa_code || "-"}
    </span>,
    <ApprovalStatusBadge
      key="status"
      status={expense.approval_status || "pending"}
      size="sm"
      canModify={canEdit && (expense.approval_status === "pending")}
      onApprove={() => approveExpense(expense.expenditure_id)}
      onReject={() => {
        setRejectingId(expense.expenditure_id);
        setShowRejectModal(true);
      }}
    />,
    canEdit ? (
      <div key="actions" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => openEdit(expense)}
        >
          Edit
        </Button>
        <Button 
          size="sm" 
          variant="danger" 
          onClick={() => deleteExpense(expense)}
        >
          Delete
        </Button>
      </div>
    ) : "View only",
  ])}
  emptyState={
    <EmptyState 
      title="No expenses found" 
      description="Try adjusting your filters or record a new expense."
    />
  }
/>
```

## Step 10: Add Rejection Modal

Add this rejection modal in the render:

```jsx
{showRejectModal && (
  <Modal
    isOpen={showRejectModal}
    onClose={() => {
      setShowRejectModal(false);
      setRejectionReason("");
      setRejectingId(null);
    }}
    title="Reject Expense"
    loading={rejectingId !== null}
    onSubmit={() => rejectExpense(rejectingId)}
    submitText="Reject"
  >
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
        Rejection Reason (Required)
      </label>
      <textarea
        placeholder="Why is this expense being rejected?"
        value={rejectionReason}
        onChange={(e) => setRejectionReason(e.target.value)}
        style={{
          width: "100%",
          minHeight: "100px",
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
  </Modal>
)}
```

## Step 11: Remove Old Constants

Remove these lines (now in expenditure.utils):
```javascript
// DELETE:
const EXPENSE_CATEGORIES = [...]
const PAYMENT_METHODS = [...]
```

## Testing Checklist

After implementation, verify:
- [ ] Form saves with new fields (M-Pesa, receipt)
- [ ] Approval buttons work
- [ ] Filters apply correctly
- [ ] Advanced filters show/hide
- [ ] Export works
- [ ] Analytics dashboard displays
- [ ] Approval status badges show correctly
- [ ] Responsive design on mobile
- [ ] Form validation works
- [ ] No console errors

## Rollback Plan

If issues occur:
1. Revert to git previous version
2. Comment out new components
3. Restore old Modal implementation
4. Test with basic functionality

## Notes

- All existing functionality is preserved
- New features are additive, not breaking
- PropTypes required from old components
- Dark theme CSS variables used throughout
- Mobile responsive with grid layouts
