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
  return {
    expenditure_id: `payroll-${row.payslip_id}`,
    school_id: row.school_id,
    expense_date: row.paid_date,
    category: "Teachers Salary",
    item_name: row.hr_staff?.full_name || "Payroll",
    description: `${row.hr_staff?.job_title || "Staff salary"} for ${row.month}/${row.year}`,
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
