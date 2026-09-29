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

export function formatCurrencyCompact(amount) {
  const num = Number(amount || 0);
  if (isNaN(num) || num === 0) return "KES 0";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const body = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
    return `${sign}KES ${body}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    const body = k >= 100 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}KES ${body}K`;
  }
  return `${sign}KES ${Math.round(abs)}`;
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

export function filterExpensesByDateRange(expenses, startDate, endDate) {
  if (!startDate && !endDate) return expenses;
  return expenses.filter((expense) => {
    const expenseDate = new Date(expense.expense_date || expense.created_at);
    if (startDate && expenseDate < new Date(startDate)) return false;
    if (endDate && expenseDate > new Date(endDate)) return false;
    return true;
  });
}

export function groupExpensesByCategory(expenses) {
  return expenses.reduce((acc, expense) => {
    const cat = expense.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(expense);
    return acc;
  }, {});
}

export function calculateCategoryTotals(expenses) {
  const grouped = groupExpensesByCategory(expenses);
  return Object.entries(grouped).map(([category, items]) => ({
    category,
    count: items.length,
    total: items.reduce((sum, e) => sum + Number(e.amount || 0), 0),
  }));
}

export function exportExpensesToCSV(expenses) {
  const headers = [
    "Date",
    "Category",
    "Description",
    "Amount",
    "Payment Method",
    "Reference",
    "M-Pesa Code",
    "Status",
    "Notes",
  ];
  const rows = expenses.map((e) => [
    e.expense_date || "",
    e.category || "",
    e.description || "",
    e.amount || 0,
    e.payment_method || "",
    e.reference_number || "",
    e.mpesa_code || "",
    e.approval_status || "pending",
    (e.notes || "").replace(/"/g, '""'),
  ]);
  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  return csvContent;
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
  const schoolName = "School Name";

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
