/**
 * Unit tests for BillingService (no live DB).
 * selectBillingContext is static and needs Supabase — assert export surface only.
 */
import { describe, it, expect } from "@jest/globals";
import { BillingService } from "../../../src/services/BillingService.js";

describe("BillingService", () => {
  it("exports a class with static selectBillingContext", () => {
    expect(BillingService).toBeDefined();
    expect(typeof BillingService.selectBillingContext).toBe("function");
  });

  it("can be constructed without throwing", () => {
    expect(() => new BillingService()).not.toThrow();
  });
});
