/**
 * Unit tests for AcademicYearService — no live DB.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { AcademicYearService } from "../../../src/core/services/AcademicYearService.js";

describe("AcademicYearService", () => {
  let service;

  beforeEach(() => {
    service = new AcademicYearService();
  });

  it("creates a service instance", () => {
    expect(service).toBeDefined();
  });

  it("exposes createAcademicYear", () => {
    expect(typeof service.createAcademicYear).toBe("function");
  });

  it("rejects end date before start date before any DB call", async () => {
    const data = {
      school_id: 1,
      name: "2024-2025",
      start_date: "2025-01-01",
      end_date: "2024-12-31",
    };
    await expect(service.createAcademicYear(data)).rejects.toThrow(
      "End date must be after start date"
    );
  });

  it("rejects end date equal to start date before any DB call", async () => {
    const data = {
      school_id: 1,
      name: "2024-2025",
      start_date: "2025-01-01",
      end_date: "2025-01-01",
    };
    await expect(service.createAcademicYear(data)).rejects.toThrow(
      "End date must be after start date"
    );
  });

  it("exposes getCurrent", () => {
    expect(typeof service.getCurrent).toBe("function");
  });

  it("exposes getAcademicYearWithTerms", () => {
    expect(typeof service.getAcademicYearWithTerms).toBe("function");
  });
});
