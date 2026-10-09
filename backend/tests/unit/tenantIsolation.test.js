import { describe, it, expect } from "@jest/globals";
import {
  belongsToTenant,
  filterRowsToTenant,
  assertSameTenant,
} from "../../src/utils/tenantIsolation.js";

describe("tenant isolation rules", () => {
  describe("belongsToTenant", () => {
    it("allows matching school ids (number and string)", () => {
      expect(belongsToTenant(3, 3)).toBe(true);
      expect(belongsToTenant("3", 3)).toBe(true);
      expect(belongsToTenant(3, "3")).toBe(true);
    });

    it("rejects different schools", () => {
      expect(belongsToTenant(3, 7)).toBe(false);
      expect(belongsToTenant("3", "7")).toBe(false);
    });

    it("rejects null/undefined", () => {
      expect(belongsToTenant(null, 3)).toBe(false);
      expect(belongsToTenant(3, null)).toBe(false);
      expect(belongsToTenant(undefined, undefined)).toBe(false);
    });
  });

  describe("filterRowsToTenant", () => {
    const rows = [
      { student_id: 1, school_id: 3, name: "A" },
      { student_id: 2, school_id: 7, name: "B" },
      { student_id: 3, school_id: 3, name: "C" },
    ];

    it("returns only caller tenant rows", () => {
      const filtered = filterRowsToTenant(rows, 3);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.school_id === 3)).toBe(true);
    });

    it("returns empty for non-array", () => {
      expect(filterRowsToTenant(null, 3)).toEqual([]);
    });
  });

  describe("assertSameTenant", () => {
    it("returns null when same tenant", () => {
      expect(assertSameTenant(3, 3)).toBeNull();
    });

    it("returns 403 descriptor on cross-tenant", () => {
      const err = assertSameTenant(3, 99);
      expect(err).toMatchObject({
        status: 403,
        code: "TENANT_FORBIDDEN",
      });
    });
  });
});
