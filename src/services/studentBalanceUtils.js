import discountService from "./discountService";
import { ledgerBalanceService } from "./ledgerBalanceService";

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getStudentId(student) {
  return student?.id ?? student?.student_id ?? student?.studentId ?? null;
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
  if (!structure) return 0;
  return toNumber(structure.tuition) + toNumber(structure.activity) + toNumber(structure.misc);
}

export function getStudentTransportFee(student) {
  return ledgerBalanceService.calculateTransportFee(
    toNumber(student?.transport_base_fee ?? student?.transportBaseFee),
    student?.transport_direction ?? student?.transportDirection ?? "none"
  );
}

export function getStudentLunchFee(student) {
  const enabled = Boolean(student?.lunch_enabled ?? student?.lunchEnabled);
  if (!enabled) return 0;
  return ledgerBalanceService.calculateLunchFee(
    toNumber(student?.lunch_daily_rate ?? student?.lunchDailyRate ?? 100),
    toNumber(student?.lunch_days ?? student?.lunchDays ?? 66),
    student?.lunch_billing_type ?? student?.lunchBillingType ?? "daily"
  );
}

export function getStudentBreakfastFee(student) {
  const enabled = Boolean(student?.breakfast_enabled ?? student?.breakfastEnabled);
  if (!enabled) return 0;
  return ledgerBalanceService.calculateBreakfastFee(
    toNumber(student?.breakfast_daily_rate ?? student?.breakfastDailyRate ?? 100),
    toNumber(student?.breakfast_days ?? student?.breakfastDays ?? 66),
    student?.breakfast_billing_type ?? student?.breakfastBillingType ?? "daily"
  );
}

function getFallbackDiscounts(student) {
  const discountValue = toNumber(student?.discount_value ?? student?.discountValue);
  if (!discountValue) return [];
  const discountValueType = student?.discount_value_type ?? student?.discountValueType ?? 'percentage';
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
  discounts = []
}) {
  const studentId = getStudentId(student);
  const className = getStudentClassName(student);
  const baseFee = getStudentBaseFee(student, feeStructures);
  const transportFee = getStudentTransportFee(student);
  const lunchFee = getStudentLunchFee(student);
  const breakfastFee = getStudentBreakfastFee(student);
  const openingBalance = getOpeningBalanceImpact(student);
  const activeDiscounts = discounts?.length ? discounts : getFallbackDiscounts(student);

  const discountCalc = discountService.calculateFeeWithDiscount({
    baseFee,
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
    balance
  };
}
