import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { PromotionService } from "../services/PromotionService.js";

const router = Router();
router.use(authRequired);

/**
 * POST /api/promotion/bulk - Bulk promote students
 */
router.post("/bulk", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const {
      fromClass,
      toClass,
      academicYear,
      dryRun = false,
      autoApprove = false,
      minPercentage = null,
      studentIds = null
    } = req.body;
    
    if (!fromClass || !toClass || !academicYear) {
      return res.status(400).json({ 
        message: "fromClass, toClass, and academicYear are required" 
      });
    }
    
    const result = await PromotionService.promoteStudents(
      schoolId,
      fromClass,
      toClass,
      academicYear,
      { dryRun, autoApprove, userId, minPercentage }
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/promotion/eligible - Check promotion eligibility
 */
router.get("/eligible", requireRoles("admin", "director", "superadmin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, fromClass, toClass, minPercentage } = req.query;
    
    if (!studentId || !fromClass || !toClass) {
      return res.status(400).json({ 
        message: "studentId, fromClass, and toClass are required" 
      });
    }
    
    const criteria = await PromotionService.checkPromotionCriteria(
      schoolId,
      studentId,
      fromClass,
      toClass,
      minPercentage ? parseFloat(minPercentage) : null
    );
    
    res.json(criteria);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/promotion/next-class/:currentClass - Get next class in progression
 */
router.get("/next-class/:currentClass", async (req, res, next) => {
  try {
    const { currentClass } = req.params;
    
    const nextClass = PromotionService.getNextClass(currentClass);
    
    res.json({ 
      currentClass, 
      nextClass,
      hasNext: !!nextClass 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/promotion/rules - Get promotion rules
 */
router.get("/rules", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const rules = await PromotionService.getPromotionRules(schoolId);
    
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/promotion/class - Promote entire class
 */
router.post("/class", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { className, academicYear, dryRun = false } = req.body;
    
    if (!className || !academicYear) {
      return res.status(400).json({ 
        message: "className and academicYear are required" 
      });
    }
    
    const nextClass = PromotionService.getNextClass(className);
    
    if (!nextClass) {
      return res.status(400).json({ 
        message: `No next class defined for ${className}` 
      });
    }
    
    const result = await PromotionService.promoteStudents(
      schoolId,
      className,
      nextClass,
      academicYear,
      { dryRun, autoApprove: true, userId }
    );
    
    res.json({
      ...result,
      fromClass: className,
      toClass: nextClass
    });
  } catch (err) {
    next(err);
  }
});

export default router;
