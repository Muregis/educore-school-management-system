#!/usr/bin/env node
import fs from "fs";

// 1) studentBalanceUtils paid statuses
{
  const path = "src/services/studentBalanceUtils.js";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("const PAID_STATUSES")) {
    t = t.replace(
      "function toNumber(value) {",
      'const PAID_STATUSES = ["paid", "completed", "success"];\nconst isPaidStatus = (status) => PAID_STATUSES.includes(String(status || "paid").toLowerCase());\n\nfunction toNumber(value) {'
    );
  }
  const old = '.filter(p => String(p?.studentId ?? p?.student_id) === String(studentId) && (p?.status ?? "paid") === "paid")';
  const neu = ".filter(p => String(p?.studentId ?? p?.student_id) === String(studentId) && isPaidStatus(p?.status))";
  if (t.includes(old)) {
    t = t.split(old).join(neu);
    console.log("studentBalanceUtils: paid status broadened");
  } else console.log("studentBalanceUtils: already OK or pattern changed");
  fs.writeFileSync(path, t);
}

// 2) AnalyticsPage
{
  const path = "src/pages/AnalyticsPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("isPaidStatus") && t.includes('from "../lib/utils"')) {
    t = t.replace(/import \{([^}]+)\} from ["']\.\.\/lib\/utils["']/, (m, names) => {
      if (names.includes("isPaidStatus")) return m;
      return `import {${names.trim()}, isPaidStatus } from "../lib/utils"`;
    });
  }
  t = t.replace('.filter(p => (p.status ?? "paid") === "paid")', ".filter(p => isPaidStatus(p.status))");
  fs.writeFileSync(path, t);
  console.log("AnalyticsPage updated");
}

// 3) ledger all/balances
{
  const path = "backend/src/routes/ledger.routes.js";
  let t = fs.readFileSync(path, "utf8");
  const old = `    // Fetch all students\n    const { data: students, error: stuErr } = await supabase\n      .from('students')\n      .select('student_id, first_name, last_name, class_name')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false)\n      .eq('status', 'active');\n    if (stuErr) throw stuErr;\n\n    const { data: feeStructures } = await supabase\n      .from('fee_structures')\n      .select('*')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false);\n\n    let query = supabase\n      .from('payments')\n      .select('student_id, amount, status')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false)\n      .in('status', ['paid', 'completed', 'success']);\n    if (term) query = query.eq('term', term);\n    const { data: payments } = await query;\n\n    const studentBalances = (students || []).map(s => {\n      const balanceInfo = calculateStudentFeeBalance({ student: s, feeStructures: feeStructures || [], payments: payments || [] });`;

  const neu = `    // Fetch all students with fee-related fields (opening balance, transport, meals, discounts)\n    const { data: students, error: stuErr } = await supabase\n      .from('students')\n      .select('student_id, first_name, last_name, class_name, opening_balance, opening_balance_type, transport_direction, transport_base_fee, transport_fee, lunch_enabled, lunch_daily_rate, lunch_days, lunch_billing_type, lunch_fee, breakfast_enabled, breakfast_daily_rate, breakfast_days, breakfast_billing_type, breakfast_termly_fee, discount_type, discount_value, discount_is_percentage')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false)\n      .eq('status', 'active');\n    if (stuErr) throw stuErr;\n\n    const feeQuery = supabase\n      .from('fee_structures')\n      .select('*')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false);\n    if (term) feeQuery.eq('term', term);\n    const { data: feeStructures } = await feeQuery;\n\n    let query = supabase\n      .from('payments')\n      .select('student_id, amount, status')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false)\n      .in('status', ['paid', 'completed', 'success']);\n    if (term) query = query.eq('term', term);\n    const { data: payments } = await query;\n\n    const studentBalances = (students || []).map(s => {\n      const balanceInfo = calculateStudentFeeBalance({ student: s, feeStructures: feeStructures || [], payments: payments || [] });`;

  if (t.includes(old)) {
    t = t.replace(old, neu);
    console.log("ledger all/balances fixed");
  } else if (t.includes("opening_balance, opening_balance_type, transport_direction")) {
    console.log("ledger already fixed");
  } else {
    console.warn("ledger pattern not found");
  }
  fs.writeFileSync(path, t);
}

// 4) Reports FE outstanding mapping
{
  const path = "src/pages/ReportsPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  const old = "feesPending:    s.totalPending   ?? s.feesPending    ?? 0,";
  if (t.includes(old)) {
    t = t.replace(
      old,
      `// Outstanding balances owed (NOT payment rows with status=pending)\n        feesPending:    s.totalOutstanding ?? s.feesPending ?? s.totalPending ?? 0,\n        totalOutstanding: s.totalOutstanding ?? 0,\n        pendingPayments: s.totalPending ?? 0,`
    );
    console.log("Reports FE mapping fixed");
  }
  t = t.replace(
    '<StatCard label="Fees Pending"     value={money(summary.feesPending)}     tone="warning" />',
    '<StatCard label="Outstanding Fees" value={money(summary.feesPending)}     tone="warning" />'
  );
  fs.writeFileSync(path, t);
}

// 5) Reports BE term resolution
{
  const path = "backend/src/routes/reports.routes.js";
  let t = fs.readFileSync(path, "utf8");
  t = t.replace(
    /const currentTerm = term; \/\/ No default - require term parameter/g,
    "const currentTerm = term || await resolveCurrentTermName(schoolId);"
  );

  t = t.replace(
    /const \{ data: feeStructures, error: feeErr \} = await supabase\n      \.from\('fee_structures'\)\n      \.select\('class_name, tuition, activity, misc'\)\n      \.eq\('school_id', schoolId)\n      \.eq\('term', currentTerm)\n      \.eq\('is_deleted', false\);\n    if \(feeErr\) throw feeErr;\n\n    \/\/ Calculate outstanding using the canonical fee-balance formula/,
    `const feeQuery = supabase\n      .from('fee_structures')\n      .select('class_name, tuition, activity, misc')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false);\n    if (currentTerm) feeQuery.eq('term', currentTerm);\n    const { data: feeStructures, error: feeErr } = await feeQuery;\n    if (feeErr) throw feeErr;\n\n    // Calculate outstanding using the canonical fee-balance formula`
  );

  t = t.replace(
    /\/\/ Get fee structures \(filter by term\)\n    const \{ data: feeStructures, error: feeErr \} = await supabase\n      \.from\('fee_structures'\)\n      \.select\('class_name, tuition, activity, misc'\)\n      \.eq\('school_id', schoolId)\n      \.eq\('term', currentTerm)\n      \.eq\('is_deleted', false\);\n    if \(feeErr\) throw feeErr;\n    \n    \/\/ Get all paid payments \(filter by term\)\n    const \{ data: payments, error: payErr \} = await supabase\n      \.from\('payments'\)\n      \.select\('student_id, amount'\)\n      \.eq\('school_id', schoolId)\n      \.in\('status', \['paid', 'completed', 'success'\]\)\n      \.eq\('term', currentTerm)\n      \.eq\('is_deleted', false\);\n    if \(payErr\) throw payErr;/,
    `// Get fee structures (filter by term when known)\n    const feeQuery = supabase\n      .from('fee_structures')\n      .select('class_name, tuition, activity, misc')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false);\n    if (currentTerm) feeQuery.eq('term', currentTerm);\n    const { data: feeStructures, error: feeErr } = await feeQuery;\n    if (feeErr) throw feeErr;\n    \n    // Get all paid payments (filter by term when known)\n    const payQuery = supabase\n      .from('payments')\n      .select('student_id, amount')\n      .eq('school_id', schoolId)\n      .in('status', ['paid', 'completed', 'success'])\n      .eq('is_deleted', false);\n    if (currentTerm) payQuery.eq('term', currentTerm);\n    const { data: payments, error: payErr } = await payQuery;\n    if (payErr) throw payErr;`
  );

  fs.writeFileSync(path, t);
  console.log("reports BE term resolution updated");
}

console.log("ALL FINANCE CALC FIXES APPLIED");
