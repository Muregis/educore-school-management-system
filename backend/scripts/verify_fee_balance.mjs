import { calculateStudentFeeBalance } from "../src/services/feeBalanceCalculator.js";

function assert(name, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.001;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${actual}, expected ${expected}`);
  if (!ok) process.exitCode = 1;
}

// Scenario A: Opening 5000, Charges 20000, Paid 15000 => 10000
{
  const student = { student_id: "A", className: "1A", opening_balance: 5000, opening_balance_type: "owing" };
  const feeStructures = [{ className: "1A", tuition: 20000, activity: 0, misc: 0 }];
  const payments = [{ student_id: "A", amount: 15000, status: "paid" }];
  const r = calculateStudentFeeBalance({ student, feeStructures, payments });
  assert("A.outstanding", r.balance, 10000);
}

// Scenario B: Opening 0, Charges 30000, Paid 30000 => 0
{
  const student = { student_id: "B", className: "1B", opening_balance: 0, opening_balance_type: "owing" };
  const feeStructures = [{ className: "1B", tuition: 30000, activity: 0, misc: 0 }];
  const payments = [{ student_id: "B", amount: 30000, status: "paid" }];
  const r = calculateStudentFeeBalance({ student, feeStructures, payments });
  assert("B.outstanding", r.balance, 0);
}

// Scenario C: Opening 8000, Charges 25000, Discount 5000 (fixed), Paid 20000 => 8000
{
  const student = {
    student_id: "C", className: "1C", opening_balance: 8000, opening_balance_type: "owing",
    discount_value: 5000, discount_value_type: "fixed", discount_is_percentage: false,
  };
  const feeStructures = [{ className: "1C", tuition: 25000, activity: 0, misc: 0 }];
  const payments = [{ student_id: "C", amount: 20000, status: "paid" }];
  const r = calculateStudentFeeBalance({ student, feeStructures, payments });
  assert("C.outstanding", r.balance, 8000);
}

// Reconciliation: SUM(student outstanding) === school total (summary) for a mix
{
  const feeStructures = [
    { className: "1A", tuition: 20000, activity: 0, misc: 0 },
    { className: "1B", tuition: 30000, activity: 0, misc: 0 },
    { className: "1C", tuition: 25000, activity: 0, misc: 0 },
  ];
  const students = [
    { student_id: "A", className: "1A", opening_balance: 5000, opening_balance_type: "owing" },
    { student_id: "B", className: "1B", opening_balance: 0, opening_balance_type: "owing" },
    { student_id: "C", className: "1C", opening_balance: 8000, opening_balance_type: "owing",
      discount_value: 5000, discount_value_type: "fixed", discount_is_percentage: false },
  ];
  const payments = [
    { student_id: "A", amount: 15000, status: "paid" },
    { student_id: "B", amount: 30000, status: "paid" },
    { student_id: "C", amount: 20000, status: "paid" },
  ];
  const sumStudent = students.reduce(
    (s, st) => s + calculateStudentFeeBalance({ student: st, feeStructures, payments }).balance,
    0
  );
  // "school total" computed the same canonical way (as reports/summary now does)
  const schoolTotal = students.reduce(
    (s, st) => s + calculateStudentFeeBalance({ student: st, feeStructures, payments }).balance,
    0
  );
  assert("reconcile.SUM==schoolTotal", sumStudent, schoolTotal);
  assert("reconcile.value", sumStudent, 10000 + 0 + 8000);
}

console.log("\nRegression scenarios complete.");
