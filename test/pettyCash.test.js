import test from "node:test";
import assert from "node:assert/strict";

function computePettyCashMetrics(expenses = []) {
  const floatTopUps = expenses.filter(
    (e) => e.category === "Petty Cash Top-up" || e.category === "Petty Cash Float"
  );

  const pettyCashVouchers = expenses.filter((e) => {
    const m = String(e.payment_method || "").toLowerCase();
    return m === "petty cash" || m === "petty_cash" || (e.category === "Petty Cash" && e.category !== "Petty Cash Top-up");
  });

  const totalFloat = floatTopUps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalPettyCashSpent = pettyCashVouchers.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const pettyCashBalance = totalFloat - totalPettyCashSpent;

  // Operating manual expenses: actual running costs (excludes float replenishments)
  const operationalExpenses = expenses.filter((e) => e.category !== "Petty Cash Top-up");
  const totalOperational = operationalExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  let healthStatus = "Healthy";
  if (totalFloat > 0 && pettyCashBalance <= 0) {
    healthStatus = "Exhausted";
  } else if (totalFloat > 0 && pettyCashBalance < totalFloat * 0.25) {
    healthStatus = "Low Float";
  }

  return {
    floatTopUpsCount: floatTopUps.length,
    pettyCashVouchersCount: pettyCashVouchers.length,
    totalFloat,
    totalPettyCashSpent,
    pettyCashBalance,
    totalOperational,
    healthStatus,
  };
}

test("petty cash: calculates live float balance from top-ups and vouchers", () => {
  const expenses = [
    { expenditure_id: 1, category: "Petty Cash Top-up", amount: 15000, payment_method: "Cash" },
    { expenditure_id: 2, category: "Supplies", amount: 1200, payment_method: "Petty Cash" },
    { expenditure_id: 3, category: "Daily Use", amount: 850, payment_method: "Petty Cash" },
    { expenditure_id: 4, category: "Transport", amount: 500, payment_method: "Petty Cash" },
  ];

  const metrics = computePettyCashMetrics(expenses);
  assert.equal(metrics.totalFloat, 15000);
  assert.equal(metrics.totalPettyCashSpent, 2550);
  assert.equal(metrics.pettyCashBalance, 12450);
  assert.equal(metrics.floatTopUpsCount, 1);
  assert.equal(metrics.pettyCashVouchersCount, 3);
  assert.equal(metrics.healthStatus, "Healthy");
});

test("petty cash: flags low float and exhausted float appropriately", () => {
  const lowExpenses = [
    { expenditure_id: 1, category: "Petty Cash Top-up", amount: 10000, payment_method: "Bank Transfer" },
    { expenditure_id: 2, category: "Maintenance", amount: 8500, payment_method: "Petty Cash" },
  ];

  const lowMetrics = computePettyCashMetrics(lowExpenses);
  assert.equal(lowMetrics.pettyCashBalance, 1500); // 15% remaining
  assert.equal(lowMetrics.healthStatus, "Low Float");

  const exhaustedExpenses = [
    { expenditure_id: 1, category: "Petty Cash Top-up", amount: 5000, payment_method: "Bank Transfer" },
    { expenditure_id: 2, category: "Maintenance", amount: 5000, payment_method: "Petty Cash" },
  ];

  const exhaustedMetrics = computePettyCashMetrics(exhaustedExpenses);
  assert.equal(exhaustedMetrics.pettyCashBalance, 0);
  assert.equal(exhaustedMetrics.healthStatus, "Exhausted");
});

test("petty cash: prevents double-counting by excluding top-up from operational expense sum", () => {
  const expenses = [
    { expenditure_id: 1, category: "Petty Cash Top-up", amount: 20000, payment_method: "Bank Transfer" },
    { expenditure_id: 2, category: "Rent", amount: 45000, payment_method: "Bank Transfer" },
    { expenditure_id: 3, category: "Kitchen", amount: 3500, payment_method: "Petty Cash" },
  ];

  const metrics = computePettyCashMetrics(expenses);
  // Total operational expense should be Rent (45,000) + Kitchen (3,500) = 48,500, NOT 68,500!
  assert.equal(metrics.totalOperational, 48500);
  assert.equal(metrics.pettyCashBalance, 16500);
});
