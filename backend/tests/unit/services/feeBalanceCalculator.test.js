/**
 * Pure unit tests for fee balance calculator — no database.
 * Guards live-tenant money math against regressions.
 */
import { describe, it, expect } from "@jest/globals";
import {
  calculateStudentFeeBalance,
  getStudentBaseFee,
  getOpeningBalanceImpact,
} from "../../../src/services/feeBalanceCalculator.js";

describe("feeBalanceCalculator", () => {
  const structures = [
    { class_name: "Grade 1", tuition: 10000, activity: 500, misc: 200 },
    { class_name: "Form 1", tuition: 15000, activity: 0, misc: 0 },
  ];

  it("matches class names case-insensitively and with extra spaces", () => {
    const student = { student_id: 1, class_name: "  grade 1 " };
    expect(getStudentBaseFee(student, structures)).toBe(10700);
  });

  it("returns 0 base fee when no structure matches", () => {
    const student = { student_id: 1, class_name: "Unknown Class" };
    expect(getStudentBaseFee(student, structures)).toBe(0);
  });

  it("applies owing opening balance", () => {
    expect(
      getOpeningBalanceImpact({ opening_balance: 1000, opening_balance_type: "owing" })
    ).toBe(1000);
  });

  it("applies credit opening balance as negative", () => {
    expect(
      getOpeningBalanceImpact({ opening_balance: 500, opening_balance_type: "credit" })
    ).toBe(-500);
  });

  it("computes outstanding = expected - paid (never negative balance field)", () => {
    const student = {
      student_id: 42,
      class_name: "Grade 1",
      opening_balance: 0,
      opening_balance_type: "owing",
      transport_direction: "none",
    };
    const payments = [
      { student_id: 42, amount: 3000, status: "paid" },
      { student_id: 42, amount: 1000, status: "completed" },
    ];
    const result = calculateStudentFeeBalance({
      student,
      feeStructures: structures,
      payments,
    });
    expect(result.expected).toBe(10700);
    expect(result.paid).toBe(4000);
    expect(result.balance).toBe(6700);
    expect(result.isOverpaid).toBe(false);
  });

  it("treats overpayment as zero outstanding + isOverpaid", () => {
    const student = {
      student_id: 7,
      class_name: "Form 1",
      opening_balance: 0,
      transport_direction: "none",
    };
    const result = calculateStudentFeeBalance({
      student,
      feeStructures: structures,
      payments: [{ student_id: 7, amount: 20000, status: "success" }],
    });
    expect(result.balance).toBe(0);
    expect(result.isOverpaid).toBe(true);
    expect(result.overpaymentAmount).toBe(5000);
  });

  it("ignores non-paid payment statuses", () => {
    const student = {
      student_id: 9,
      class_name: "Form 1",
      transport_direction: "none",
    };
    const result = calculateStudentFeeBalance({
      student,
      feeStructures: structures,
      payments: [
        { student_id: 9, amount: 5000, status: "pending" },
        { student_id: 9, amount: 2000, status: "failed" },
      ],
    });
    expect(result.paid).toBe(0);
    expect(result.balance).toBe(15000);
  });
});
