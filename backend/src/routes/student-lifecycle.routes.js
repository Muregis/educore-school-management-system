import { Router } from "express";
import { StudentLifecycleService } from "../core/services/StudentLifecycleService.js";

const router = Router();
const studentLifecycleService = new StudentLifecycleService();

// Enroll student
router.post("/enroll", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await studentLifecycleService.enrollStudent(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 400);
  }
});

// Transfer student
router.post("/:studentId/transfer", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { class_id, stream_id, reason } = req.body;
    const result = await studentLifecycleService.transferStudent(studentId, class_id, stream_id, reason, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 400);
  }
});

// Withdraw student
router.post("/:studentId/withdraw", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reason } = req.body;
    const result = await studentLifecycleService.withdrawStudent(studentId, reason, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 400);
  }
});

// Graduate student
router.post("/:studentId/graduate", async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await studentLifecycleService.graduateStudent(studentId, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 400);
  }
});

// Suspend student
router.post("/:studentId/suspend", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reason } = req.body;
    const result = await studentLifecycleService.suspendStudent(studentId, reason, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 400);
  }
});

// Reinstate student
router.post("/:studentId/reinstate", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reason } = req.body;
    const result = await studentLifecycleService.reinstateStudent(studentId, reason, { userId: req.user.id });
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 400);
  }
});

// Get student history
router.get("/:studentId/history", async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await studentLifecycleService.getStudentHistory(studentId);
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 500);
  }
});

// Get class roster
router.get("/class/:classId/roster", async (req, res) => {
  try {
    const { classId } = req.params;
    const { academic_year_id } = req.query;
    const result = await studentLifecycleService.getClassRoster(classId, academic_year_id);
    res.success(result);
  } catch (error) {
    res.error('STUDENT_LIFECYCLE_ERROR', error.message, {}, 500);
  }
});

export default router;
