import discountService from "./discountService.js";
import { ledgerBalanceService } from "./ledgerBalanceService.js";

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getStudentId(student) {
  return student?.student_id ?? student?.id ?? student?.studentId ?? null;
}

export function getStudentClassName(student) {
  return student?.className ?? student?.class_name ?? "";
}

export function getOpeningBalanceImpact(student) {
  const amount = toNumber(student?.opening_balance ?? student?.openingBalance);
  return (student?.opening_balance_type ?? student?.openingBalanceType) === "credit" ? -amount : amount;
}

export function getStudentBaseFee(student, feeStructures = []) {
  const className = getStudentClassName(student);
  const structure = feeStructures.find(f => (f?.className ?? f?.class_name) === className);
  if (!structure) {
    return 0;
  }
  return toNumber(structure.tuition) + toNumber(structure.activity) + toNumber(structure.misc);
}

export function hasFeeStructureForClass(student, feeStructures = []) {
  const className = getStudentClassName(student);
  return feeStructures.some(f => (f?.className ?? f?.class_name) === className);
}

// ── Agreed-amount overrides ────────────────────────────────────────────────────
// A student's per-row `transport_fee` / `lunch_fee` / `breakfast_fee` columns
// (set via PATCH /students/:id/fees) represent the *already-computed*
// contribution for that component — they supersede any rate-based calculation
// so a parent/guardian agreement of "transport = KES 4,500 flat" is honored
// exactly, regardless of `transport_base_fee` / `direction` or meal rates.

function getAgreedAmount(student, key) {
  const v = student?.[key];
  return v === undefined || v === null || v === "" ? null : toNumber(v);
}

export function getStudentTransportFee(student, schoolSettings = {}) {
  // 1. Agreed override (set via PATCH /students/:id/fees)
  const agreed = getAgreedAmount(student, "transport_fee");
  if (agreed !== null && agreed > 0) {
    return agreed;
  }

  // 2. Rate × direction
  const direction =
    student?.transport_direction ??
    student?.transportDirection ??
    schoolSettings.transport_direction ??
    schoolSettings.transportDirection ??
    "none";
  const baseFee = toNumber(
    student?.transport_base_fee ??
    student?.transportBaseFee ??
    schoolSettings.transport_base_fee ??
    schoolSettings.transportBaseFee ??
    0
  );
  return ledgerBalanceService.calculateTransportFee(baseFee, direction);
}

export function getStudentLunchFee(student, schoolSettings = {}) {
  // 1. Agreed override
  const agreed = getAgreedAmount(student, "lunch_fee");
  if (agreed !== null && agreed > 0) {
    return agreed;
  }

  const dailyRate = toNumber(
    student?.lunch_daily_rate ??
    student?.lunchDailyRate ??
    schoolSettings.lunch_daily_rate ??
    schoolSettings.lunchDailyRate ??
    0
  );
  const days = toNumber(
    student?.lunch_days ??
    student?.lunchDays ??
    schoolSettings.lunch_days ??
    schoolSettings.lunchDays ??
    schoolSettings.term_days ??
    schoolSettings.termDays ??
    0
  );
  const billingType =
    student?.lunch_billing_type ??
    student?.lunchBillingType ??
    schoolSettings.lunch_billing_type ??
    schoolSettings.lunchBillingType ??
    "termly";
  const explicitFlag = student?.lunch_enabled ?? student?.lunchEnabled;
  const schoolFlag = schoolSettings.lunch_enabled ?? schoolSettings.lunchEnabled;
  const enabled = explicitFlag !== undefined ? Boolean(explicitFlag)
                  : schoolFlag !== undefined ? Boolean(schoolFlag)
                  : dailyRate > 0;
  if (!enabled) return 0;
  return ledgerBalanceService.calculateLunchFee(dailyRate, days, billingType);
}

export function getStudentBreakfastFee(student, schoolSettings = {}) {
  // 1. Agreed override
  const agreed = getAgreedAmount(student, "breakfast_fee");
  if (agreed !== null && agreed > 0) {
    return agreed;
  }

  const dailyRate = toNumber(
    student?.breakfast_daily_rate ??
    student?.breakfastDailyRate ??
    schoolSettings.breakfast_daily_rate ??
    schoolSettings.breakfastDailyRate ??
    0
  );
  const days = toNumber(
    student?.breakfast_days ??
    student?.breakfastDays ??
    schoolSettings.breakfast_days ??
    schoolSettings.breakfastDays ??
    schoolSettings.term_days ??
    schoolSettings.termDays ??
    0
  );
  const billingType =
    student?.breakfast_billing_type ??
    student?.breakfastBillingType ??
    schoolSettings.breakfast_billing_type ??
    schoolSettings.breakfastBillingType ??
    "termly";
  const explicitFlag = student?.breakfast_enabled ?? student?.breakfastEnabled;
  const schoolFlag = schoolSettings.breakfast_enabled ?? schoolSettings.breakfastEnabled;
  const enabled = explicitFlag !== undefined ? Boolean(explicitFlag)
                  : schoolFlag !== undefined ? Boolean(schoolFlag)
                  : dailyRate > 0;
  if (!enabled) return 0;
  return ledgerBalanceService.calculateBreakfastFee(dailyRate, days, billingType);
}

function getFallbackDiscounts(student) {
  const discountValue = toNumber(student?.discount_value ?? student?.discountValue);
  if (!discountValue) return [];
  // Use discount_value_type if available, otherwise fall back to discount_is_percentage for backward compatibility
  const discountValueType = student?.discount_value_type ?? student?.discountValueType ?? 
    (student?.discount_is_percentage === false ? 'fixed' : 'percentage');
  return [{
    is_active: true,
    discount_value: discountValue,
    discount_value_type: discountValueType,
    discount_type: student?.discount_type ?? student?.discountType ?? "custom",
    discountPercent: discountValueType === 'percentage' ? discountValue : 0
  }];
}

export function calculateStudentBalanceLocal({
  student,
  feeStructures = [],
  payments = [],
  discounts = [],
  schoolSettings = {},
  requireFeeStructure = true
}) {
  const studentId = getStudentId(student);
  const className = getStudentClassName(student);
  const hasStructure = hasFeeStructureForClass(student, feeStructures);

  // If requireFeeStructure is true (default for dashboard aggregates) and
  // no fee structure is defined for this class, still surface real opening
  // balances. Only suppress phantom balances when there is no opening balance
  // either.
  if (requireFeeStructure && !hasStructure) {
    const openingBalance = getOpeningBalanceImpact(student);
    const paid = payments
      .filter(p => String(p?.studentId ?? p?.student_id) === String(studentId) && (p?.status ?? "paid") === "paid")
      .reduce((sum, p) => sum + toNumber(p.amount), 0);
    if (openingBalance === 0) {
      return {
        studentId,
        className,
        baseFee: 0,
        transportFee: 0,
        lunchFee: 0,
        breakfastFee: 0,
        openingBalance: 0,
        grossAmount: 0,
        expected: 0,
        totalDiscount: 0,
        discountPercent: 0,
        discountType: null,
        discountLabel: null,
        hasDiscount: false,
        paid,
        rawBalance: -paid,
        overpaymentAmount: paid > 0 ? paid : 0,
        isOverpaid: paid > 0,
        balance: 0,
        hasFeeStructure: false
      };
    }
    const rawBalance = openingBalance - paid;
    const overpaymentAmount = rawBalance < 0 ? Math.abs(rawBalance) : 0;
    return {
      studentId,
      className,
      baseFee: 0,
      transportFee: 0,
      lunchFee: 0,
      breakfastFee: 0,
      openingBalance,
      grossAmount: openingBalance,
      expected: openingBalance,
      totalDiscount: 0,
      discountPercent: 0,
      discountType: null,
      discountLabel: null,
      hasDiscount: false,
      paid,
      rawBalance,
      overpaymentAmount,
      isOverpaid: overpaymentAmount > 0,
      balance: Math.max(0, rawBalance),
      hasFeeStructure: false
    };
  }

  const baseFee = getStudentBaseFee(student, feeStructures);
  const structure = feeStructures.find(f => (f?.className ?? f?.class_name) === className);
  const tuition = structure ? toNumber(structure.tuition) : 0;
  const transportFee = getStudentTransportFee(student, schoolSettings);
  const lunchFee = getStudentLunchFee(student, schoolSettings);
  const breakfastFee = getStudentBreakfastFee(student, schoolSettings);
  const openingBalance = getOpeningBalanceImpact(student);
  const activeDiscounts = discounts?.length ? discounts : getFallbackDiscounts(student);

  const discountCalc = discountService.calculateFeeWithDiscount({
    baseFee,
    tuition,
    transportFee,
    lunchFee,
    breakfastFee,
    openingBalance,
    discounts: activeDiscounts
  });

  const paid = payments
    .filter(p => String(p?.studentId ?? p?.student_id) === String(studentId) && (p?.status ?? "paid") === "paid")
    .reduce((sum, p) => sum + toNumber(p.amount), 0);

  const rawBalance = discountCalc.netAmount - paid;
  const overpaymentAmount = rawBalance < 0 ? Math.abs(rawBalance) : 0;
  const balance = Math.max(0, rawBalance);

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
    discountLabel: discountCalc.discountLabel,
    hasDiscount: discountCalc.hasDiscount,
    paid,
    rawBalance,
    overpaymentAmount,
    isOverpaid: overpaymentAmount > 0,
    balance,
    hasFeeStructure: hasStructure
  };
}
