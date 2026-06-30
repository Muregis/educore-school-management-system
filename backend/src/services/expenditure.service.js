import { supabase } from "../config/supabaseClient.js";

function monthKey(value) {
  if (!value) return null;
  return String(value).slice(0, 7);
}

function monthLabel(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key;
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function normaliseManualExpenditure(row) {
  return {
    expenditure_id: row.expenditure_id,
    school_id: row.school_id,
    expense_date: row.expense_date,
    category: row.category,
    item_name: row.item_name,
    description: row.description,
    amount: Number(row.amount || 0),
    payment_method: row.payment_method,
    vendor_name: row.vendor_name,
    paid_to_name: row.paid_to_name || row.vendor_name,
    purpose: row.purpose || row.item_name,
    reference_number: row.reference_number,
    notes: row.notes,
    mpesa_code: row.mpesa_code || null,
    receipt_url: row.receipt_url || null,
    approval_status: row.approval_status || "pending",
    approval_timestamp: row.approval_timestamp || null,
    approved_by: row.approved_by || null,
    rejection_reason: row.rejection_reason || null,
    created_by: row.created_by,
    released_by_user_id: row.released_by_user_id || row.created_by,
    released_by_name: row.released_by_name || null,
    source_type: "manual",
    source_label: "Manual Expense",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalisePayrollExpenditure(row) {
  const jobTitle = row.hr_staff?.job_title || "Staff";
  // Create category based on job title for better categorization
  let category = "HR Payroll";
  const jobTitleLower = jobTitle.toLowerCase();
  
  if (jobTitleLower.includes("teacher") || jobTitleLower.includes("lecturer")) {
    category = "Teachers Salary";
  } else if (jobTitleLower.includes("support") || jobTitleLower.includes("cleaner") || jobTitleLower.includes("security") || jobTitleLower.includes("driver")) {
    category = "Support Staff Salary";
  } else if (jobTitleLower.includes("admin") || jobTitleLower.includes("secretary") || jobTitleLower.includes("receptionist") || jobTitleLower.includes("manager")) {
    category = "Administrative Staff Salary";
  } else if (jobTitleLower.includes("principal") || jobTitleLower.includes("director") || jobTitleLower.includes("head")) {
    category = "Management Salary";
  } else {
    category = "Other Staff Salary";
  }

  return {
    expenditure_id: `payroll-${row.payslip_id}`,
    school_id: row.school_id,
    expense_date: row.paid_date,
    category: category,
    item_name: row.hr_staff?.full_name || "Payroll",
    description: `${jobTitle} for ${row.month}/${row.year}`,
    amount: Number(row.net_pay || 0),
    payment_method: row.payment_method || "Payroll",
    vendor_name: row.hr_staff?.full_name || null,
    paid_to_name: row.hr_staff?.full_name || null,
    purpose: `Salary payment for ${row.month}/${row.year}`,
    reference_number: row.payment_reference || null,
    notes: row.notes || null,
    created_by: row.generated_by || null,
    released_by_user_id: row.paid_by_user_id || row.generated_by || null,
    released_by_name: row.payment_recorded_by || null,
    source_type: "payroll",
    source_label: "Paid Payroll",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getManualExpenditures(schoolId) {
  const { data, error } = await supabase
    .from("expenditures")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .order("expense_date", { ascending: false })
    .order("expenditure_id", { ascending: false });

  if (error) throw error;
  return (data || []).map(normaliseManualExpenditure);
}

export async function getPayrollExpenditures(schoolId) {
  const { data, error } = await supabase
    .from("hr_payslips")
    .select("payslip_id, school_id, month, year, net_pay, notes, paid_date, payment_method, payment_reference, generated_by, paid_by_user_id, payment_recorded_by, created_at, updated_at, hr_staff(full_name, job_title)")
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .eq("status", "paid")
    .not("paid_date", "is", null)
    .order("paid_date", { ascending: false })
    .order("payslip_id", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalisePayrollExpenditure);
}

export async function getExpenditureSummary(schoolId) {
  const [manualRows, payrollRows] = await Promise.all([
    getManualExpenditures(schoolId),
    getPayrollExpenditures(schoolId),
  ]);

  const combined = [...manualRows, ...payrollRows].sort((a, b) => {
    if (a.expense_date === b.expense_date) return String(b.expenditure_id).localeCompare(String(a.expenditure_id));
    return String(b.expense_date).localeCompare(String(a.expense_date));
  });

  const manualTotal = manualRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const payrollTotal = payrollRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const totalExpenses = manualTotal + payrollTotal;

  const categoryMap = new Map();
  combined.forEach((row) => {
    const key = row.category || "Other";
    categoryMap.set(key, (categoryMap.get(key) || 0) + Number(row.amount || 0));
  });

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const monthMap = new Map();
  combined.forEach((row) => {
    const key = monthKey(row.expense_date);
    if (!key) return;
    const current = monthMap.get(key) || { month: key, label: monthLabel(key), manual: 0, payroll: 0, total: 0 };
    if (row.source_type === "payroll") current.payroll += Number(row.amount || 0);
    else current.manual += Number(row.amount || 0);
    current.total += Number(row.amount || 0);
    monthMap.set(key, current);
  });

  const monthlyTrend = Array.from(monthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);

  return {
    totals: {
      manual: manualTotal,
      payroll: payrollTotal,
      total: totalExpenses,
      transactions: manualRows.length,
      payrollEntries: payrollRows.length,
    },
    byCategory,
    monthlyTrend,
    recent: combined.slice(0, 50),
  };
}

// Approval Workflow Functions

export async function approveExpenditure(schoolId, expenditureId, approvedById) {
  const { data, error } = await supabase
    .from("expenditures")
    .update({
      approval_status: "approved",
      approved_by: approvedById,
      approval_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId)
    .eq("expenditure_id", expenditureId)
    .eq("is_deleted", false)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Expense not found");
  return normaliseManualExpenditure(data);
}

export async function rejectExpenditure(schoolId, expenditureId, rejectionReason, rejectedById) {
  const { data, error } = await supabase
    .from("expenditures")
    .update({
      approval_status: "rejected",
      rejection_reason: rejectionReason || null,
      approved_by: rejectedById,
      approval_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId)
    .eq("expenditure_id", expenditureId)
    .eq("is_deleted", false)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Expense not found");
  return normaliseManualExpenditure(data);
}

export async function getExpendituresByStatus(schoolId, status) {
  const { data, error } = await supabase
    .from("expenditures")
    .select("*")
    .eq("school_id", schoolId)
    .eq("approval_status", status)
    .eq("is_deleted", false)
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return (data || []).map(normaliseManualExpenditure);
}

// Filtering and Export Functions

export async function getFilteredExpenditures(schoolId, filters = {}) {
  let query = supabase
    .from("expenditures")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_deleted", false);

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  if (filters.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }

  if (filters.approvalStatus) {
    query = query.eq("approval_status", filters.approvalStatus);
  }

  if (filters.startDate && filters.endDate) {
    query = query.gte("expense_date", filters.startDate).lte("expense_date", filters.endDate);
  }

  if (filters.minAmount !== undefined && filters.maxAmount !== undefined) {
    query = query.gte("amount", filters.minAmount).lte("amount", filters.maxAmount);
  }

  if (filters.search) {
    query = query.or(
      `item_name.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%,paid_to_name.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%`
    );
  }

  query = query.order("expense_date", { ascending: false }).order("expenditure_id", { ascending: false });

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.offset(filters.offset);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normaliseManualExpenditure);
}

export async function getExpendituresByDateRange(schoolId, startDate, endDate) {
  const { data, error } = await supabase
    .from("expenditures")
    .select("*")
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return (data || []).map(normaliseManualExpenditure);
}

export async function getExpendituresByCategory(schoolId, category) {
  const { data, error } = await supabase
    .from("expenditures")
    .select("*")
    .eq("school_id", schoolId)
    .eq("category", category)
    .eq("is_deleted", false)
    .order("expense_date", { ascending: false });

  if (error) throw error;
  return (data || []).map(normaliseManualExpenditure);
}

// Statistics and Analytics Functions

export async function getApprovalStatistics(schoolId) {
  const { data, error } = await supabase
    .from("expenditures")
    .select("approval_status, amount")
    .eq("school_id", schoolId)
    .eq("is_deleted", false);

  if (error) throw error;

  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    rejectedAmount: 0,
  };

  (data || []).forEach((row) => {
    const status = row.approval_status || "pending";
    const amount = Number(row.amount || 0);
    stats[status]++;
    stats[`${status}Amount`] += amount;
  });

  return stats;
}

export async function getCategoryAnalytics(schoolId, startDate, endDate) {
  const expenses = await getExpendituresByDateRange(schoolId, startDate, endDate);

  const categoryMap = new Map();
  expenses.forEach((expense) => {
    const category = expense.category || "Other";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { category, count: 0, total: 0, percentage: 0 });
    }
    const cat = categoryMap.get(category);
    cat.count++;
    cat.total += expense.amount;
  });

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const result = Array.from(categoryMap.values()).map((cat) => ({
    ...cat,
    percentage: totalAmount > 0 ? ((cat.total / totalAmount) * 100).toFixed(2) : 0,
  }));

  return result.sort((a, b) => b.total - a.total);
}

export async function getMonthlyTrendAnalytics(schoolId, monthsBack = 12) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);

  const { data, error } = await supabase
    .from("expenditures")
    .select("expense_date, amount, approval_status")
    .eq("school_id", schoolId)
    .eq("is_deleted", false)
    .gte("expense_date", startDate.toISOString().split("T")[0]);

  if (error) throw error;

  const monthMap = new Map();
  (data || []).forEach((row) => {
    const date = new Date(row.expense_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        label: monthLabel(monthKey),
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        count: 0,
      });
    }
    const month = monthMap.get(monthKey);
    const amount = Number(row.amount || 0);
    month.total += amount;
    month.count++;
    const status = row.approval_status || "pending";
    month[status] += amount;
  });

  return Array.from(monthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, monthsBack);
}
