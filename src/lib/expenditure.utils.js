/**
 * Frontend utility functions for expenditures module
 */

export function formatCurrency(amount) {
  const num = Number(amount || 0);
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateString, format = "short") {
  if (!dateString) return "";
  const date = new Date(dateString);

  if (format === "short") {
    return date.toLocaleDateString("en-KE", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  if (format === "long") {
    return date.toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  if (format === "monthYear") {
    return date.toLocaleDateString("en-KE", { year: "numeric", month: "long" });
  }

  return dateString;
}

export function getMonthKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

export function calculateMonthlyChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return (((current - previous) / previous) * 100).toFixed(1);
}

export function getCategoryColor(category) {
  const colors = {
    "Teachers Salary": "#ef4444",
    Rent: "#dc2626",
    Utilities: "#f97316",
    "Daily Use": "#eab308",
    Kitchen: "#84cc16",
    Transport: "#22c55e",
    Supplies: "#10b981",
    Maintenance: "#14b8a6",
    Security: "#06b6d4",
    Repairs: "#0ea5e9",
    Technology: "#3b82f6",
    Marketing: "#8b5cf6",
    Other: "#a78bfa",
  };

  return colors[category] || "#6b7280";
}

export function getStatusColor(status) {
  const colors = {
    pending: "#f59e0b",
    approved: "#10b981",
    rejected: "#ef4444",
  };
  return colors[status] || "#6b7280";
}

export function getStatusLabel(status) {
  const labels = {
    pending: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
  };
  return labels[status] || status;
}

export async function downloadCSV(expenses, filename = "expenditures.csv") {
  const headers = [
    "Date",
    "Category",
    "Item Name",
    "Payee",
    "Amount (KES)",
    "Payment Method",
    "Reference",
    "M-Pesa Code",
    "Status",
    "Notes",
  ];

  const rows = expenses.map((e) => [
    formatDate(e.expense_date),
    e.category || "",
    e.item_name || "",
    e.paid_to_name || e.vendor_name || "",
    e.amount || 0,
    e.payment_method || "",
    e.reference_number || "",
    e.mpesa_code || "",
    e.approval_status || "pending",
    (e.notes || "").replace(/"/g, '""'),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell || "");
          return str.includes(",") || str.includes('"') ? `"${str}"` : str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function validateMpesaCode(code) {
  if (!code) return { valid: true };
  const cleaned = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(cleaned)) {
    return { valid: false, message: "M-Pesa code must be 10 alphanumeric characters (e.g., UE2JE2N2SK)" };
  }
  return { valid: true, code: cleaned };
}

export function validateAmount(amount) {
  const num = Number(amount);
  if (isNaN(num) || num < 0) {
    return { valid: false, message: "Amount must be a positive number" };
  }
  if (num > 99999999) {
    return { valid: false, message: "Amount exceeds maximum allowed value" };
  }
  return { valid: true, amount: num };
}

export function getAmountChangeIndicator(current, previous) {
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  return change > 0 ? "increase" : change < 0 ? "decrease" : "neutral";
}

export function formatPercentage(value) {
  return `${Number(value).toFixed(1)}%`;
}

export function truncateText(text, maxLength = 50) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

export function getApprovalStatusIcon(status) {
  const icons = {
    pending: "⏳",
    approved: "✓",
    rejected: "✗",
  };
  return icons[status] || "?";
}

export function generatePrintableReport(summary, expenses) {
  const now = new Date();
  const reportDate = formatDate(now, "long");
  const schoolName = "School Name"; // Would come from context/props

  return {
    title: `Expenditure Report - ${schoolName}`,
    date: reportDate,
    generatedAt: now.toLocaleTimeString("en-KE"),
    summary: {
      totalExpenses: expenses.length,
      totalAmount: formatCurrency(summary.totals.total),
      manualAmount: formatCurrency(summary.totals.manual),
      payrollAmount: formatCurrency(summary.totals.payroll),
      approvedCount: expenses.filter((e) => e.approval_status === "approved").length,
      pendingCount: expenses.filter((e) => e.approval_status === "pending").length,
      rejectedCount: expenses.filter((e) => e.approval_status === "rejected").length,
    },
    expenses,
  };
}

export const EXPENSE_CATEGORIES = [
  "Teachers Salary",
  "Rent",
  "Utilities",
  "Daily Use",
  "Kitchen",
  "Transport",
  "Supplies",
  "Maintenance",
  "Security",
  "Repairs",
  "Technology",
  "Marketing",
  "Other",
];

export const PAYMENT_METHODS = ["Cash", "M-Pesa", "Bank Transfer", "Cheque", "Card"];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
