/**
 * Export utilities for expenditure reports
 * Supports CSV, JSON, and provides data formatting for PDF/Excel
 */

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-KE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function generateCSV(expenses, includeHeader = true) {
  const headers = [
    "Date",
    "Category",
    "Item Name",
    "Vendor/Payee",
    "Amount (KES)",
    "Payment Method",
    "Reference Number",
    "M-Pesa Code",
    "Status",
    "Notes",
  ];

  const rows = expenses.map((expense) => [
    formatDate(expense.expense_date),
    expense.category,
    expense.item_name,
    expense.paid_to_name || expense.vendor_name || "",
    expense.amount,
    expense.payment_method,
    expense.reference_number || "",
    expense.mpesa_code || "",
    expense.approval_status,
    (expense.notes || "").replace(/"/g, '""'), // Escape quotes
  ]);

  const csvContent = [
    includeHeader ? headers.join(",") : "",
    ...rows.map((row) =>
      row
        .map((cell) => {
          const stringCell = String(cell || "");
          return stringCell.includes(",") || stringCell.includes('"') ? `"${stringCell}"` : stringCell;
        })
        .join(",")
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return csvContent;
}

export function generateJSON(expenses, metadata = {}) {
  const timestamp = new Date().toISOString();
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const approvedAmount = expenses
    .filter((e) => e.approval_status === "approved")
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    metadata: {
      exportDate: timestamp,
      schoolId: metadata.schoolId,
      schoolName: metadata.schoolName,
      reportTitle: metadata.reportTitle || "Expenditure Report",
      totalExpenses: expenses.length,
      totalAmount,
      approvedAmount,
      pendingAmount: totalAmount - approvedAmount,
      ...metadata,
    },
    expenses: expenses.map((e) => ({
      ...e,
      amount: e.amount, // Keep as number for JSON
    })),
  };
}

export function generatePDFData(expenses, metadata = {}) {
  const timestamp = new Date().toISOString();
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const approvedAmount = expenses
    .filter((e) => e.approval_status === "approved")
    .reduce((sum, e) => sum + e.amount, 0);
  const rejectedAmount = expenses
    .filter((e) => e.approval_status === "rejected")
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = expenses
    .filter((e) => e.approval_status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);

  const categoryBreakdown = {};
  expenses.forEach((exp) => {
    const category = exp.category || "Other";
    categoryBreakdown[category] = (categoryBreakdown[category] || 0) + exp.amount;
  });

  return {
    metadata: {
      exportDate: timestamp,
      exportDateFormatted: new Date().toLocaleDateString("en-KE"),
      schoolName: metadata.schoolName || "School Name",
      schoolLogo: metadata.schoolLogo || "",
      reportTitle: metadata.reportTitle || "Expenditure Report",
      reportPeriod: metadata.reportPeriod || "All Time",
      preparedBy: metadata.preparedBy || "Finance Officer",
    },
    summary: {
      totalExpenses: expenses.length,
      totalAmount,
      approvedAmount,
      rejectedAmount,
      pendingAmount,
      categoryCount: Object.keys(categoryBreakdown).length,
    },
    categoryBreakdown: Object.entries(categoryBreakdown).map(([category, amount]) => ({
      category,
      amount,
      percentage: ((amount / totalAmount) * 100).toFixed(2),
      formattedAmount: formatCurrency(amount),
    })),
    statusBreakdown: {
      approved: {
        count: expenses.filter((e) => e.approval_status === "approved").length,
        amount: approvedAmount,
        percentage: totalAmount > 0 ? ((approvedAmount / totalAmount) * 100).toFixed(2) : 0,
      },
      pending: {
        count: expenses.filter((e) => e.approval_status === "pending").length,
        amount: pendingAmount,
        percentage: totalAmount > 0 ? ((pendingAmount / totalAmount) * 100).toFixed(2) : 0,
      },
      rejected: {
        count: expenses.filter((e) => e.approval_status === "rejected").length,
        amount: rejectedAmount,
        percentage: totalAmount > 0 ? ((rejectedAmount / totalAmount) * 100).toFixed(2) : 0,
      },
    },
    expenses: expenses.map((e) => ({
      date: formatDate(e.expense_date),
      category: e.category,
      itemName: e.item_name,
      payee: e.paid_to_name || e.vendor_name || "",
      amount: formatCurrency(e.amount),
      method: e.payment_method,
      reference: e.reference_number || "",
      mpesaCode: e.mpesa_code || "",
      status: e.approval_status,
      notes: e.notes || "",
    })),
  };
}

export function generateExcelData(expenses, metadata = {}) {
  const pdfData = generatePDFData(expenses, metadata);
  const timestamp = new Date().toISOString();

  return {
    metadata: pdfData.metadata,
    summary: pdfData.summary,
    sheets: [
      {
        name: "Expenses",
        data: pdfData.expenses.map((e) => [
          e.date,
          e.category,
          e.itemName,
          e.payee,
          e.amount,
          e.method,
          e.reference,
          e.mpesaCode,
          e.status,
          e.notes,
        ]),
        headers: ["Date", "Category", "Item Name", "Payee", "Amount", "Method", "Reference", "M-Pesa", "Status", "Notes"],
      },
      {
        name: "Category Summary",
        data: pdfData.categoryBreakdown.map((c) => [c.category, c.amount, c.percentage + "%"]),
        headers: ["Category", "Total (KES)", "Percentage"],
      },
      {
        name: "Status Summary",
        data: [
          ["Approved", pdfData.statusBreakdown.approved.count, pdfData.statusBreakdown.approved.percentage + "%"],
          ["Pending", pdfData.statusBreakdown.pending.count, pdfData.statusBreakdown.pending.percentage + "%"],
          ["Rejected", pdfData.statusBreakdown.rejected.count, pdfData.statusBreakdown.rejected.percentage + "%"],
        ],
        headers: ["Status", "Count", "Percentage"],
      },
    ],
  };
}

export function getFileNameWithTimestamp(prefix = "expenditures", ext = "csv") {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const time = now.getTime();

  return `${prefix}_${year}${month}${day}_${time}.${ext}`;
}
