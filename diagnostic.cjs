/**
 * Balance Diagnostic Script (CommonJS)
 * Compares formula-based vs ledger-based balances for every student.
 * Run: node diagnostic.cjs
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://slewmhaflrplgedgfvmz.supabase.co';
const supabaseServiceKey = 'sb_secret_FJkltGU9pNWfjtfeM97JNg_qxVmde3r';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

const PAID_STATUSES = ['paid', 'completed', 'success'];

function toNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round2(v) { return Math.round(toNumber(v) * 100) / 100; }

function getOpeningBalanceImpact(student) {
  const amt = toNumber(student?.opening_balance);
  return student?.opening_balance_type === 'credit' ? -amt : amt;
}

function getStudentBaseFee(student, structures) {
  const cls = student?.class_name ?? '';
  const s = structures.find(f => f.class_name === cls);
  return s ? toNumber(s.tuition) + toNumber(s.activity) + toNumber(s.misc) : 0;
}

function getStudentTransportFee(student) {
  const base = toNumber(student?.transport_base_fee);
  const dir = student?.transport_direction ?? 'none';
  return dir !== 'none' ? base : 0;
}

function getStudentLunchFee(student) {
  if (!student?.lunch_enabled) return 0;
  const rate = toNumber(student?.lunch_daily_rate || 100);
  const days = toNumber(student?.lunch_days || 66);
  return round2(rate * days);
}

function getStudentBreakfastFee(student) {
  if (!student?.breakfast_enabled) return 0;
  const rate = toNumber(student?.breakfast_daily_rate || 100);
  const days = toNumber(student?.breakfast_days || 66);
  return round2(rate * days);
}

function getBestDiscount(discounts, tuition) {
  const active = (discounts || []).filter(d => {
    if (!d?.is_active) return false;
    if (d.expires_at && new Date(d.expires_at) < new Date()) return false;
    return true;
  });
  if (!active.length) return null;
  return active.reduce((best, cur) => {
    const cv = cur.discount_value || cur.discountPercent || 0;
    const bv = best.discount_value || best.discountPercent || 0;
    if (cur.discount_value_type === 'fixed' && best.discount_value_type === 'fixed') return cv > bv ? cur : best;
    if (cur.discount_value_type === 'fixed') {
      const curAmt = cv;
      const bestAmt = best.discount_value_type === 'fixed' ? bv : (tuition * bv) / 100;
      return curAmt > bestAmt ? cur : best;
    }
    if (best.discount_value_type === 'fixed') {
      const bestAmt = bv;
      const curAmt = (tuition * cv) / 100;
      return curAmt > bestAmt ? cur : best;
    }
    return cv > bv ? cur : best;
  }, active[0]);
}

function getFallbackDiscounts(student) {
  const dv = toNumber(student?.discount_value);
  if (!dv) return [];
  const dvt = student?.discount_value_type ?? (student?.discount_is_percentage === false ? 'fixed' : 'percentage');
  return [{ is_active: true, discount_value: dv, discount_value_type: dvt, discount_type: student?.discount_type ?? 'custom', discountPercent: dvt === 'percentage' ? dv : 0 }];
}

function calcFormulaBalance(student, structures, payments, discounts) {
  const sid = student?.student_id ?? student?.id;
  const cls = student?.class_name ?? '';
  const baseFee = getStudentBaseFee(student, structures);
  const structure = structures.find(f => f.class_name === cls);
  const tuition = structure ? toNumber(structure.tuition) : 0;
  const transportFee = getStudentTransportFee(student);
  const lunchFee = getStudentLunchFee(student);
  const breakfastFee = getStudentBreakfastFee(student);
  const openingBalance = getOpeningBalanceImpact(student);

  const activeDiscounts = discounts?.length ? discounts : getFallbackDiscounts(student);
  const best = getBestDiscount(activeDiscounts, tuition);
  let discAmt = 0, discPct = 0;
  if (best) {
    const dv = best.discount_value || best.discountPercent || 0;
    const dvt = best.discount_value_type || 'percentage';
    if (dvt === 'fixed') { discAmt = dv; discPct = tuition ? (dv / tuition) * 100 : 0; }
    else { discPct = dv; discAmt = (tuition * dv) / 100; }
  }

  const grossAmount = baseFee + transportFee + lunchFee + breakfastFee + openingBalance;
  const netTuition = tuition - discAmt;
  const activityMisc = baseFee - tuition;
  const netBaseFee = netTuition + activityMisc;
  const netAmount = round2(netBaseFee + transportFee + lunchFee + breakfastFee + openingBalance);

  const paid = (payments || [])
    .filter(p => String(p.student_id ?? p.id) === String(sid) && PAID_STATUSES.includes(String(p.status).toLowerCase()))
    .reduce((s, p) => s + toNumber(p.amount), 0);

  const rawBalance = round2(netAmount - paid);
  const balance = Math.max(0, rawBalance);
  return { sid, cls, baseFee, transportFee, lunchFee, breakfastFee, openingBalance, grossAmount, netAmount, discAmt, paid, rawBalance, balance };
}

async function runDiagnostic() {
  console.log('=== EDUCODE BALANCE DIAGNOSTIC ===\n');

  // 1. Get all schools
  const { data: schools, error: schErr } = await supabase.from('schools').select('*');
  if (schErr) { console.error('Schools error:', schErr); return; }
  console.log(`Found ${schools.length} school(s)\n`);

  for (const school of schools) {
    const schoolId = school.school_id || school.id;
    console.log(`\n======= School: ${school.name || school.school_name || schoolId} (ID: ${schoolId}) =======`);

    // 2. Get all students
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (stuErr) { console.error(`  Students error: ${stuErr.message}`); continue; }
    console.log(`  Students: ${students.length}`);

    // 3. Get fee structures
    const { data: structures, error: fsErr } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (fsErr) { console.error(`  Fee structures error: ${fsErr.message}`); continue; }
    console.log(`  Fee Structures: ${structures.length}`);

    // 4. Get all payments
    const { data: allPayments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);
    if (payErr) { console.error(`  Payments error: ${payErr.message}`); continue; }
    console.log(`  Payments (total): ${allPayments.length}`);
    const paidPayments = allPayments.filter(p => PAID_STATUSES.includes(String(p.status).toLowerCase()));
    console.log(`  Payments (paid):  ${paidPayments.length}, Total: KES ${paidPayments.reduce((s,p) => s+toNumber(p.amount), 0).toLocaleString()}`);

    // 5. Get student ledger
    let ledgerMap = {};
    let ledgerEntries = [];
    try {
      const { data: ledgers, error: ledErr } = await supabase
        .from('student_ledger')
        .select('*')
        .eq('school_id', schoolId)
        .order('ledger_id', { ascending: false });
      if (!ledErr && ledgers) {
        ledgerEntries = ledgers;
        for (const entry of ledgers) {
          if (!ledgerMap[entry.student_id]) {
            ledgerMap[entry.student_id] = { balance_after: Number(entry.balance_after) || 0, count: 0 };
          }
          const map = ledgerMap[entry.student_id];
          map.count++;
        }
        const totalLedgerBalance = Object.values(ledgerMap).reduce((s, v) => s + v.balance_after, 0);
        console.log(`  Student Ledger:   ${ledgers.length} entries, ${Object.keys(ledgerMap).length} students, Total: KES ${totalLedgerBalance.toLocaleString()}`);
      } else {
        console.log(`  Student Ledger: MISSING - ${ledErr?.message || 'no data'}`);
      }
    } catch (e) {
      console.log(`  Student Ledger: ERROR - ${e.message}`);
    }

    // 6. Get student discounts
    let sDiscounts = [];
    try {
      const { data: sd, error: sdErr } = await supabase
        .from('student_discounts')
        .select('*')
        .eq('school_id', schoolId);
      if (!sdErr && sd) sDiscounts = sd;
    } catch (e) {}

    // 7. Check students table columns
    console.log('\n  --- Student Table Column Check ---');
    if (students.length > 0) {
      const sample = students[0];
      const requiredFields = ['opening_balance', 'opening_balance_type', 'transport_base_fee', 'transport_direction', 'lunch_enabled', 'lunch_daily_rate', 'lunch_days', 'breakfast_enabled', 'breakfast_daily_rate', 'breakfast_days', 'discount_value', 'discount_type', 'discount_is_percentage'];
      const missing = requiredFields.filter(f => sample[f] === undefined);
      const present = requiredFields.filter(f => sample[f] !== undefined);
      console.log(`  Present fields (${present.length}/${requiredFields.length}): ${present.join(', ')}`);
      if (missing.length) console.log(`  MISSING fields: ${missing.join(', ')}`);
    }

    // 8. Compare formula vs ledger
    console.log('\n  --- Balance Comparison (Formula vs Ledger) ---');
    console.log('  Students with balance > 0 or mismatches:');
    console.log('');

    let mismatchCount = 0;
    let noLedgerCount = 0;
    let totalFormulaBalance = 0;
    let totalLedgerBalanceCheck = 0;
    let totalPaidFormula = 0;
    let totalExpectedFormula = 0;

    for (const student of students) {
      const sid = student.student_id ?? student.id;
      const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown';
      const cls = student.class_name || '';

      const studentDiscs = sDiscounts.filter(d => String(d.student_id ?? d.id) === String(sid));
      const formula = calcFormulaBalance(student, structures, paidPayments, studentDiscs);
      totalFormulaBalance += formula.balance;
      totalPaidFormula += formula.paid;
      totalExpectedFormula += formula.netAmount;

      const ledger = ledgerMap[sid];
      const ledgerBalance = ledger ? ledger.balance_after : null;
      if (ledgerBalance !== null) totalLedgerBalanceCheck += ledgerBalance;

      let issues = [];
      if (ledgerBalance === null) {
        noLedgerCount++;
        if (formula.balance > 0) issues.push('OWES but NO ledger entry');
      } else {
        const balDiff = Math.abs(formula.balance - Math.max(0, ledgerBalance));
        if (balDiff > 1) {
          mismatchCount++;
          if (ledgerBalance > formula.balance) issues.push(`Ledger is KES ${(ledgerBalance - formula.balance).toLocaleString()} HIGHER`);
          else issues.push(`Ledger is KES ${(formula.balance - ledgerBalance).toLocaleString()} LOWER`);
        }
      }

      if (formula.balance > 0 || ledgerBalance > 0 || issues.length) {
        const idStr = String(sid).padEnd(6);
        const nameStr = name.padEnd(22);
        const clsStr = String(cls).padEnd(12);
        const fBalStr = `KES ${String(formula.balance).padStart(9)}`;
        const lBalStr = ledgerBalance !== null ? `KES ${String(ledgerBalance).padStart(9)}` : 'N/A         ';
        const flag = issues.length ? `  <<< ${issues.join('; ')}` : '';
        console.log(`  ${idStr} ${nameStr} ${clsStr} Formula:${fBalStr}  Ledger:${lBalStr}${flag}`);
      }
    }

    console.log('');
    console.log('  ' + '-'.repeat(100));
    console.log('  SUMMARY');
    console.log('  ' + '-'.repeat(100));
    console.log(`    Formula total outstanding: KES ${totalFormulaBalance.toLocaleString()}`);
    console.log(`    Formula total expected:    KES ${totalExpectedFormula.toLocaleString()}`);
    console.log(`    Formula total paid:        KES ${totalPaidFormula.toLocaleString()}`);
    console.log(`    Ledger total balance:      KES ${totalLedgerBalanceCheck.toLocaleString()}`);
    console.log(`    Mismatched students:       ${mismatchCount}`);
    console.log(`    Students without ledger:   ${noLedgerCount}`);
    console.log(`    Students with no issues:   ${students.length - mismatchCount - noLedgerCount}`);

    // 9. Check payment-level ledger sync
    console.log('\n  --- Payment / Ledger Sync Check ---');
    if (ledgerEntries.length > 0) {
      // Count payments recorded as ledger entries
      const ledgerPaymentEntries = ledgerEntries.filter(e => e.transaction_type === 'payment');
      const totalLedgerPayments = ledgerPaymentEntries.reduce((s, e) => s + toNumber(e.amount), 0);
      const totalActualPayments = paidPayments.reduce((s, p) => s + toNumber(p.amount), 0);
      console.log(`    Total payments (table):   KES ${totalActualPayments.toLocaleString()} (${paidPayments.length} payments)`);
      console.log(`    Total payments (ledger):  KES ${totalLedgerPayments.toLocaleString()} (${ledgerPaymentEntries.length} entries)`);
      if (Math.abs(totalActualPayments - totalLedgerPayments) > 1) {
        console.log(`    <<< MISMATCH: KES ${(totalActualPayments - totalLedgerPayments).toLocaleString()} difference`);
      }

      // Count charge entries
      const ledgerChargeEntries = ledgerEntries.filter(e => e.transaction_type === 'charge');
      console.log(`    Ledger charge entries:   ${ledgerChargeEntries.length}`);
    } else {
      console.log('    (ledger table not available)');
    }

    // 10. Check fee_balances table
    console.log('\n  --- Fee Balances Table Check ---');
    try {
      const { data: feeBals, error: fbErr } = await supabase
        .from('fee_balances')
        .select('*')
        .eq('school_id', schoolId);
      if (!fbErr && feeBals) {
        console.log(`    fee_balances entries: ${feeBals.length}`);
        const totalFbBalance = feeBals.reduce((s, fb) => s + toNumber(fb.balance), 0);
        console.log(`    fee_balances total:   KES ${totalFbBalance.toLocaleString()}`);
        if (Math.abs(totalFbBalance - totalFormulaBalance) > 1) {
          console.log(`    <<< MISMATCH with formula: KES ${(totalFormulaBalance - totalFbBalance).toLocaleString()} difference`);
        }
      } else {
        console.log('    fee_balances table: MISSING');
      }
    } catch (e) {
      console.log('    fee_balances table: ERROR - ' + e.message);
    }
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

runDiagnostic().catch(console.error);
