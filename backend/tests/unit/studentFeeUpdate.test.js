import { describe, it, expect } from "@jest/globals";
import {
  buildStudentFeeUpdateData,
  FORBIDDEN_FEE_COLUMNS,
} from "../../src/utils/studentFeeUpdate.js";

describe("buildStudentFeeUpdateData", () => {
  it("maps core fee fields from body", () => {
    const data = buildStudentFeeUpdateData({
      opening_balance: "500",
      opening_balance_type: "owing",
      transport_direction: "two_way",
      transport_base_fee: "1500",
      lunch_enabled: true,
      lunch_daily_rate: 100,
      lunch_days: 20,
      lunch_billing_type: "termly",
      breakfast_enabled: false,
      breakfast_termly_fee: 0,
      discount_type: null,
      discount_value: 0,
      discount_is_percentage: true,
    });

    expect(data.opening_balance).toBe(500);
    expect(data.opening_balance_type).toBe("owing");
    expect(data.transport_direction).toBe("two_way");
    expect(data.transport_base_fee).toBe(1500);
    expect(data.lunch_enabled).toBe(true);
    expect(data.lunch_daily_rate).toBe(100);
    expect(data.lunch_days).toBe(20);
    expect(data.lunch_billing_type).toBe("termly");
    expect(data.breakfast_enabled).toBe(false);
    expect(typeof data.updated_at).toBe("string");
  });

  it("never includes lunch_fee or transport_fee even if client sends them", () => {
    const data = buildStudentFeeUpdateData({
      lunch_fee: 999,
      transport_fee: 888,
      opening_balance: 100,
      lunch_enabled: true,
      transport_direction: "one_way",
      transport_base_fee: 500,
    });

    for (const col of FORBIDDEN_FEE_COLUMNS) {
      expect(data).not.toHaveProperty(col);
    }
    expect(Object.keys(data)).not.toContain("lunch_fee");
    expect(Object.keys(data)).not.toContain("transport_fee");
  });

  it("coerces invalid numbers to 0", () => {
    const data = buildStudentFeeUpdateData({
      opening_balance: "not-a-number",
      transport_base_fee: undefined,
      lunch_daily_rate: "",
    });
    expect(data.opening_balance).toBe(0);
    expect(data).not.toHaveProperty("transport_base_fee");
  });

  it("defaults opening_balance_type to owing when provided empty-ish", () => {
    const data = buildStudentFeeUpdateData({ opening_balance_type: "" });
    expect(data.opening_balance_type).toBe("owing");
  });
});
