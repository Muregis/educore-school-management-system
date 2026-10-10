/**
 * Unit tests for AcademicYearRepository — constructor surface only (no live DB).
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { AcademicYearRepository } from "../../../src/core/repositories/AcademicYearRepository.js";

describe("AcademicYearRepository", () => {
  let repository;

  beforeEach(() => {
    repository = new AcademicYearRepository();
  });

  it("creates repository with academic_years table", () => {
    expect(repository).toBeDefined();
    expect(repository.tableName).toBe("academic_years");
  });

  it("exposes findAll", () => {
    expect(typeof repository.findAll).toBe("function");
  });

  it("exposes findById", () => {
    expect(typeof repository.findById).toBe("function");
  });

  it("exposes create", () => {
    expect(typeof repository.create).toBe("function");
  });

  it("exposes update", () => {
    expect(typeof repository.update).toBe("function");
  });

  it("exposes findCurrent", () => {
    expect(typeof repository.findCurrent).toBe("function");
  });

  it("exposes setCurrent", () => {
    expect(typeof repository.setCurrent).toBe("function");
  });
});
