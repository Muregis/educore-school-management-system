import { Router } from "express";
import { AcademicYearService } from "../core/services/AcademicYearService.js";

const router = Router();
const academicYearService = new AcademicYearService();

// Get current academic year and term
router.get("/current", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const current = await academicYearService.getCurrent(schoolId);
    res.success(current);
  } catch (error) {
    res.error('ACADEMIC_YEAR_ERROR', error.message, {}, 500);
  }
});

// Get all academic years
router.get("/", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { page = 1, limit = 20 } = req.query;
    const result = await academicYearService.academicYearRepository.findAll(
      { school_id: schoolId },
      { page, limit, sort: 'start_date', order: 'desc' }
    );
    res.paginated(result.data, result.pagination);
  } catch (error) {
    res.error('ACADEMIC_YEAR_ERROR', error.message, {}, 500);
  }
});

// Get academic year with terms
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await academicYearService.getAcademicYearWithTerms(id);
    res.success(result);
  } catch (error) {
    res.error('ACADEMIC_YEAR_ERROR', error.message, {}, 500);
  }
});

// Create academic year
router.post("/", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await academicYearService.createAcademicYear(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('ACADEMIC_YEAR_ERROR', error.message, {}, 400);
  }
});

// Create term
router.post("/terms", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await academicYearService.createTerm(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('TERM_ERROR', error.message, {}, 400);
  }
});

// Set current academic year
router.put("/:id/current", async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const result = await academicYearService.setCurrentAcademicYear(id, schoolId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('ACADEMIC_YEAR_ERROR', error.message, {}, 400);
  }
});

// Set current term
router.put("/terms/:id/current", async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    const result = await academicYearService.setCurrentTerm(id, schoolId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('TERM_ERROR', error.message, {}, 400);
  }
});

// Close academic year
router.put("/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await academicYearService.closeAcademicYear(id, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('ACADEMIC_YEAR_ERROR', error.message, {}, 400);
  }
});

// Close term
router.put("/terms/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await academicYearService.termRepository.close(id);
    res.success(result);
  } catch (error) {
    res.error('TERM_ERROR', error.message, {}, 400);
  }
});

export default router;
