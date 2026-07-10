/**
 * FeeBalanceCalculator
 * ---------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for fee-balance calculations on the server.
 *
 * This intentionally mirrors the frontend formula implemented in
 * `src/services/studentBalanceUtils.js -> calculateStudentBalanceLocal()`
 * and `src/services/discountService.js -> calculateFeeWithDiscount()` so that
 * every surface (Dashboard, Fees page, Reports, Analytics, Defaulters,
 * Parent/Student portals) produces an identical outstanding balance.
 *
 * Canonical formula
 * -----------------
 *   Outstanding =
 *       Opening Balance
 *     + Current Term Charges (tuition + activity + misc + transport + lunch + breakfast)
 *     + Previous Carry Forward   (stored as `opening_balance` after a term transition)
 *     - Payments Received
 *     - Discounts                (applied ONLY to tuition, never to other components)
 *     - Waivers
 *     ± Approved Adjustments
 *
 * In this schema the term-transition routine (TermService) writes the previous
 * term's residual balance into `students.opening_balance`, so the "carry
 * forward" amount and the "opening balance" are the SAME stored value and must
 * NOT be added twice. A positive balance means the student OWES money; a
 * negative balance is a credit/overpayment.
 */

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

// ── Opening balance ───────────────────────────────────────────────────────────
// A "credit" opening balance reduces what is owed; an "owing" balance adds to it.
export function getOpeningBalanceImpact(student) {
  const amount = toNumber(student?.opening_balance ?? student?.openingBalance);
  return (student?.opening_balance_type ?? student?.openingBalanceType) === "credit"
    ? -amount
    : amount;
}

// ── Current term charges from the fee structure ────────────────────────────────
export function getStudentBaseFee(student, feeStructures = []) {
  const className = student?.className ?? student?.class_name ?? "";
  const structure = feeStructures.find(
    (f) => (f?.className ?? f?.class_name) === className
  );
  if (!structure) return 0;
  return toNumber(structure.tuition) + toNumber(structure.activity) + toNumber(structure.misc);
}

export function calculateTransportFee(baseFee, direction = "two_way") {
  const base = toNumber(baseFee);
  if (!direction || direction === "none") return 0;
  // The stored transport base fee is the full (two-way) amount.
  return base;
}

export function calculateLunchFee(dailyRate, days = 66, billingType = "daily") {
  if (billingType === "termly") return round2(toNumber(dailyRate));
  return round2(toNumber(dailyRate) * toNumber(days));
}

export function calculateBreakfastFee(dailyRate, days = 66, billingType = "daily") {
  if (billingType === "termly") return round2(toNumber(dailyRate));
  return round2(toNumber(dailyRate) * toNumber(days));
}

export function getStudentTransportFee(student) {
  return calculateTransportFee(
    student?.transport_base_fee ?? student?.transportBaseFee,
    student?.transport_direction ?? student?.transportDirection ?? "none"
  );
}

export function getStudentLunchFee(student, schoolSettings = {}) {
  if (!Boolean(student?.lunch_enabled ?? student?.lunchEnabled)) return 0;
  return calculateLunchFee(
    student?.lunch_daily_rate ?? student?.lunchDailyRate ?? schoolSettings.lunch_daily_rate ?? 100,
    student?.lunch_days ?? student?.lunchDays ?? schoolSettings.lunch_days ?? 66,
    student?.lunch_billing_type ?? student?.lunchBillingType ?? "daily"
  );
}

export function getStudentBreakfastFee(student, schoolSettings = {}) {
  if (!Boolean(student?.breakfast_enabled ?? student?.breakfastEnabled)) return 0;
  return calculateBreakfastFee(
    student?.breakfast_daily_rate ?? student?.breakfastDailyRate ?? schoolSettings.breakfast_daily_rate ?? 100,
    student?.breakfast_days ?? student?.breakfastDays ?? schoolSettings.breakfast_days ?? 66,
    student?.breakfast_billing_type ?? student?.breakfastBillingType ?? "daily"
  );
}

// ── Discounts ───────────────────────────────────────────────────────────────────
// Only the highest-value, active discount applies (no stacking). If the student
// record carries a legacy `discount_value` but no explicit discount rows, it is
// used as a fallback so the calculation still reflects stored financial data.
function getFallbackDiscounts(student) {
  const discountValue = toNumber(student?.discount_value ?? student?.discountValue);
  if (!discountValue) return [];
  const discountValueType =
    student?.discount_value_type ??
    student?.discountValueType ??
    (student?.discount_is_percentage === false ? "fixed" : "percentage");
  return [
    {
      is_active: true,
      discount_value: discountValue,
      discount_value_type: discountValueType,
      discount_type: student?.discount_type ?? student?.discountType ?? "custom",
      discountPercent: discountValueType === "percentage" ? discountValue : 0,
    },
  ];
}

export function getBestDiscount(discounts = [], tuition = 0) {
  const activeDiscounts = (discounts || []).filter((d) => {
    if (!d?.is_active) return false;
    if (d.expires_at && new Date(d.expires_at) < new Date()) return false;
    return true;
  });
  if (activeDiscounts.length === 0) return null;

  return activeDiscounts.reduce((best, current) => {
    const currentValue = current.discount_value || current.discountPercent || 0;
    const bestValue = best.discount_value || best.discountPercent || 0;

    if (current.discount_value_type === "fixed" && best.discount_value_type === "fixed") {
      return currentValue > bestValue ? current : best;
    }
    if (current.discount_value_type === "fixed") {
      const currentAmount = currentValue;
      const bestAmount =
        best.discount_value_type === "fixed"
          ? bestValue
          : (tuition * bestValue) / 100;
      return currentAmount > bestAmount ? current : best;
    }
    if (best.discount_value_type === "fixed") {
      const bestAmount = bestValue;
      const currentAmount = (tuition * currentValue) / 100;
      return currentAmount > bestAmount ? current : best;
    }
    return currentValue > bestValue ? current : best;
  }, activeDiscounts[0]);
}

// Discount applies ONLY to the tuition component. Activity, misc, transport,
// meals and the opening balance are never discounted.
export function calculateFeeWithDiscount({
  baseFee = 0,
  tuition = 0,
  transportFee = 0,
  lunchFee = 0,
  breakfastFee = 0,
  openingBalance = 0,
  discounts = [],
}) {
  const grossAmount = toNumber(baseFee) + toNumber(transportFee) + toNumber(lunchFee) + toNumber(breakfastFee) + toNumber(openingBalance);

  const bestDiscount = getBestDiscount(discounts, tuition);
  if (!bestDiscount) {
    return {
      grossAmount: round2(grossAmount),
      discountAmount: 0,
      discountPercent: 0,
      netAmount: round2(grossAmount),
      discountType: null,
      discountLabel: null,
      hasDiscount: false,
    };
  }

  const discountValue = bestDiscount.discount_value || bestDiscount.discountPercent || 0;
  const discountValueType = bestDiscount.discount_value_type || "percentage";

  let discountAmount;
  let discountPercent;
  if (discountValueType === "fixed") {
    discountAmount = discountValue;
    discountPercent = tuition ? (discountAmount / tuition) * 100 : 0;
  } else {
    discountPercent = discountValue;
    discountAmount = (tuition * discountPercent) / 100;
  }

  const netTuition = tuition - discountAmount;
  const activityMisc = baseFee - tuition;
  const netBaseFee = netTuition + activityMisc;
  const netAmount =
    netBaseFee + toNumber(transportFee) + toNumber(lunchFee) + toNumber(breakfastFee) + toNumber(openingBalance);

  return {
    grossAmount: round2(grossAmount),
    discountAmount: round2(discountAmount),
    discountPercent: round2(discountPercent),
    netAmount: round2(netAmount),
    discountType: bestDiscount.discount_type || bestDiscount.type,
    discountLabel: bestDiscount.discount_type || bestDiscount.type,
    hasDiscount: true,
  };
}

const PAID_STATUSES = ["paid", "completed", "success"];

// ── Canonical per-student balance calculation ───────────────────────────────────
/**
 * @param {Object} params
 * @param {Object} params.student            student row (must include fee fields)
 * @param {Array}  params.feeStructures      [{ className|class_name, tuition, activity, misc }]
 * @param {Array}  params.payments           [{ student_id|studentId, amount, status }]
 * @param {Array}  params.discounts          explicit discount rows (optional)
 * @param {Object} params.schoolSettings     defaults for lunch/breakfast rates/days
 * @returns {Object} balance breakdown (matches frontend calculateStudentBalanceLocal)
 */
export function calculateStudentFeeBalance({
  student,
  feeStructures = [],
  payments = [],
  discounts = [],
  schoolSettings = {},
} = {}) {
  const studentId = student?.id ?? student?.student_id ?? student?.studentId ?? null;
  const className = student?.className ?? student?.class_name ?? "";

  const baseFee = getStudentBaseFee(student, feeStructures);
  const structure = feeStructures.find(
    (f) => (f?.className ?? f?.class_name) === className
  );
  const tuition = structure ? toNumber(structure.tuition) : 0;

  const transportFee = getStudentTransportFee(student);
  const lunchFee = getStudentLunchFee(student, schoolSettings);
  const breakfastFee = getStudentBreakfastFee(student, schoolSettings);
  const openingBalance = getOpeningBalanceImpact(student);

  const activeDiscounts = discounts?.length ? discounts : getFallbackDiscounts(student);

  const discountCalc = calculateFeeWithDiscount({
    baseFee,
    tuition,
    transportFee,
    lunchFee,
    breakfastFee,
    openingBalance,
    discounts: activeDiscounts,
  });

  const paid = (payments || [])
    .filter(
      (p) =>
        String(p?.student_id ?? p?.studentId) === String(studentId) &&
        PAID_STATUSES.includes((p?.status ?? "paid").toLowerCase())
    )
    .reduce((sum, p) => sum + toNumber(p.amount), 0);

  const rawBalance = round2(discountCalc.netAmount - paid);
  const overpaymentAmount = rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const balance = Math.max(0, rawBalance); // outstanding owed (never negative unless credit supported)

  return {
    studentId,
    className,
    baseFee,
    transportFee,
    lunchFee,
    breakfastFee,
    openingBalance,
    grossAmount: discountCalc.grossAmount,
    expected: discountCalc.netAmount,
    totalDiscount: discountCalc.discountAmount,
    discountPercent: discountCalc.discountPercent,
    discountType: discountCalc.discountType,
    hasDiscount: discountCalc.hasDiscount,
    paid,
    rawBalance,
    overpaymentAmount,
    isOverpaid: overpaymentAmount > 0,
    balance,
  };
}

export default {
  calculateStudentFeeBalance,
  getOpeningBalanceImpact,
  getStudentBaseFee,
  getBestDiscount,
  calculateFeeWithDiscount,
  getStudentTransportFee,
  getStudentLunchFee,
  getStudentBreakfastFee,
};
