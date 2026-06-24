import { Router } from "express";
import { ExamService } from "../core/services/ExamService.js";

const router = Router();
const examService = new ExamService();

// Create exam
router.post("/", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await examService.createExam(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('EXAM_ERROR', error.message, {}, 400);
  }
});

// Record exam result
router.post("/results", async (req, res) => {
  try {
    const result = await examService.recordResult(req.body, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('EXAM_ERROR', error.message, {}, 400);
  }
});

// Bulk record results
router.post("/results/bulk", async (req, res) => {
  try {
    const { results } = req.body;
    const created = await examService.bulkRecordResults(results, { userId: req.user.id });
    res.success({ created, count: created.length });
  } catch (error) {
    res.error('EXAM_ERROR', error.message, {}, 400);
  }
});

// Lock exam results
router.put("/:examId/lock", async (req, res) => {
  try {
    const { examId } = req.params;
    const result = await examService.lockExamResults(examId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('EXAM_ERROR', error.message, {}, 400);
  }
});

// Get exam statistics
router.get("/:examId/statistics", async (req, res) => {
  try {
    const { examId } = req.params;
    const result = await examService.getExamStatistics(examId);
    res.success(result);
  } catch (error) {
    res.error('EXAM_ERROR', error.message, {}, 500);
  }
});

// Get student performance
router.get("/students/:studentId/performance", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academic_year_id } = req.query;
    const result = await examService.getStudentPerformance(studentId, academic_year_id);
    res.success(result);
  } catch (error) {
    res.error('EXAM_ERROR', error.message, {}, 500);
  }
});

export default router;
