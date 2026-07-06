import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { TermService } from "../services/TermService.js";

const router = Router();
router.use(authRequired);

/**
 * GET /api/academic/terms - List all terms for school
 */
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.query;
    
    const terms = await TermService.getTerms(schoolId, status);
    res.json(terms || []);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/terms/current - Get current active term
 */
router.get("/current", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const term = await TermService.getCurrentTerm(schoolId);
    
    if (!term) {
      return res.status(404).json({ message: "No active term found" });
    }
    
    res.json(term);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/terms - Create new term
 */
router.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { term_name, academic_year, start_date, end_date, status = "upcoming" } = req.body;
    
    if (!term_name || !academic_year || !start_date || !end_date) {
      return res.status(400).json({ 
        message: "term_name, academic_year, start_date, and end_date are required" 
      });
    }
    
    const term = await TermService.createTerm(schoolId, {
      term_name,
      academic_year,
      start_date,
      end_date,
      status
    });
    
    res.status(201).json(term);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/academic/terms/:id/activate - Activate a term
 */
router.put("/:id/activate", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { id } = req.params;
    
    const term = await TermService.activateTerm(schoolId, id, userId);
    
    if (!term) {
      return res.status(404).json({ message: "Term not found" });
    }
    
    res.json({ message: "Term activated successfully", term });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/academic/terms/:id/close - Close a term
 */
router.put("/:id/close", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { id } = req.params;
    
    const term = await TermService.closeTerm(schoolId, id, userId);
    
    if (!term) {
      return res.status(404).json({ message: "Term not found" });
    }
    
    res.json({ message: "Term closed successfully", term });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/academic/terms/:id/end-term - End term and prepare for next term
 * This handles the full term transition workflow:
 * 1. Closes current term
 * 2. Archives grades and results
 * 3. Carries forward student balances
 * 4. Prepares fee structures for next term
 */
router.post("/:id/end-term", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { id } = req.params;
    const { carryForwardBalances = true, archiveGrades = true, nextTermId } = req.body;
    
    const result = await TermService.endTermTransition(schoolId, id, userId, {
      carryForwardBalances,
      archiveGrades,
      nextTermId
    });
    
    if (!result) {
      return res.status(404).json({ message: "Term not found or transition failed" });
    }
    
    res.json({ 
      message: "Term ended and transition completed successfully", 
      term: result.term,
      summary: result.summary
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/academic/terms/:id - Get single term
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    
    const term = await TermService.getTerm(schoolId, id);
    
    if (!term) {
      return res.status(404).json({ message: "Term not found" });
    }
    
    res.json(term);
  } catch (err) {
    next(err);
  }
});

export default router;
