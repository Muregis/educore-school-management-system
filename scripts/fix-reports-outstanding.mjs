#!/usr/bin/env node
import fs from "fs";

// --- Frontend: Fees Pending was wired to pending payment rows, not balances ---
{
  const path = "src/pages/ReportsPage.jsx";
  let t = fs.readFileSync(path, "utf8");
  const old = `feesPending:    s.totalPending   ?? s.feesPending    ?? 0,`;
  const neu = `// Outstanding balances owed (NOT payment rows with status=pending)\n        feesPending:    s.totalOutstanding ?? s.feesPending ?? s.totalPending ?? 0,\n        totalOutstanding: s.totalOutstanding ?? 0,\n        pendingPayments: s.totalPending ?? 0,`;
  if (t.includes(old)) {
    t = t.replace(old, neu);
    console.log("FE mapping fixed");
  } else if (t.includes("totalOutstanding ?? s.feesPending")) {
    console.log("FE mapping already fixed");
  } else {
    console.warn("FE mapping pattern not found");
  }
  t = t.replace(
    '<StatCard label="Fees Pending"     value={money(summary.feesPending)}     tone="warning" />',
    '<StatCard label="Outstanding Fees" value={money(summary.feesPending)}     tone="warning" />'
  );
  t = t.replace(
    '<StatCard label="Fees Pending" value={money(summary.feesPending)} tone="warning" />',
    '<StatCard label="Outstanding Fees" value={money(summary.feesPending)} tone="warning" />'
  );
  fs.writeFileSync(path, t);
}

// --- Backend: align term resolution for summary + class-fee-summary ---
{
  const path = "backend/src/routes/reports.routes.js";
  let t = fs.readFileSync(path, "utf8");

  t = t.replace(
    /router\.get\("\/summary", async \(req, res, next\) => \{\n  try \{\n    const \{ schoolId \} = req\.user;\n    const \{ term \} = req\.query;[^\n]*\n    const currentTerm = term;[^\n]*\n/,
    `router.get("/summary", async (req, res, next) => {\n  try {\n    const { schoolId } = req.user;\n    const { term } = req.query; // Allow term filtering via query param\n    const currentTerm = term || await resolveCurrentTermName(schoolId);\n`
  );

  t = t.replace(
    /\/\/ Calculate outstanding balance \(expected fees - paid\)\n    const \{ data: feeStructures, error: feeErr \} = await supabase\n      \.from\('fee_structures'\)\n      \.select\('class_name, tuition, activity, misc'\)\n      \.eq\('school_id', schoolId)\n      \.eq\('term', currentTerm)\n      \.eq\('is_deleted', false);\n    if \(feeErr\) throw feeErr;/,
    `// Calculate outstanding balance (expected fees - paid)\n    const feeQuery = supabase\n      .from('fee_structures')\n      .select('class_name, tuition, activity, misc')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false);\n    if (currentTerm) feeQuery.eq('term', currentTerm);\n    const { data: feeStructures, error: feeErr } = await feeQuery;\n    if (feeErr) throw feeErr;`
  );

  t = t.replace(
    /router\.get\("\/class-fee-summary", async \(req, res, next\) => \{\n  try \{\n    const \{ schoolId \} = req\.user;\n    const \{ term \} = req\.query;[^\n]*\n    const currentTerm = term;[^\n]*\n/,
    `router.get("/class-fee-summary", async (req, res, next) => {\n  try {\n    const { schoolId } = req.user;\n    const { term } = req.query; // Allow term filtering via query param\n    const currentTerm = term || await resolveCurrentTermName(schoolId);\n`
  );

  // class-fee structures: only filter term when set
  t = t.replace(
    /\/\/ Get fee structures \(filter by term\)\n    const \{ data: feeStructures, error: feeErr \} = await supabase\n      \.from\('fee_structures'\)\n      \.select\('class_name, tuition, activity, misc'\)\n      \.eq\('school_id', schoolId)\n      \.eq\('term', currentTerm)\n      \.eq\('is_deleted', false);\n    if \(feeErr\) throw feeErr;\n    \n    \/\/ Get all paid payments \(filter by term\)\n    const \{ data: payments, error: payErr \} = await supabase\n      \.from\('payments'\)\n      \.select\('student_id, amount'\)\n      \.eq\('school_id', schoolId)\n      \.in\('status', \['paid', 'completed', 'success'\]\)\n      \.eq\('term', currentTerm)\n      \.eq\('is_deleted', false);\n    if \(payErr\) throw payErr;/,
    `// Get fee structures (filter by term when known)\n    const feeQuery = supabase\n      .from('fee_structures')\n      .select('class_name, tuition, activity, misc')\n      .eq('school_id', schoolId)\n      .eq('is_deleted', false);\n    if (currentTerm) feeQuery.eq('term', currentTerm);\n    const { data: feeStructures, error: feeErr } = await feeQuery;\n    if (feeErr) throw feeErr;\n    \n    // Get all paid payments (filter by term when known)\n    const payQuery = supabase\n      .from('payments')\n      .select('student_id, amount')\n      .eq('school_id', schoolId)\n      .in('status', ['paid', 'completed', 'success'])\n      .eq('is_deleted', false);\n    if (currentTerm) payQuery.eq('term', currentTerm);\n    const { data: payments, error: payErr } = await payQuery;\n    if (payErr) throw payErr;`
  );

  fs.writeFileSync(path, t);
  console.log("backend reports patched");
  console.log("summary resolves term", t.includes("term || await resolveCurrentTermName(schoolId)"));
}

console.log("DONE");
