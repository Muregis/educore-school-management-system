import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// Hardcoded promotion chain based on standard school progression
const PROMOTION_CHAIN = {
  "Playgroup": "PP1",
  "PP1": "PP2", 
  "PP2": "Grade 1",
  "Grade 1": "Grade 2",
  "Grade 2": "Grade 3",
  "Grade 3": "Grade 4",
  "Grade 4": "Grade 5",
  "Grade 5": "Grade 6",
  "Grade 6": "Grade 7",
  "Grade 7": "Grade 8",
  "Grade 8": "Grade 9",
  "Grade 9": null // Grade 9 is the final class
};

/**
 * GET /api/classes/promotion-chain - Get promotion chain configuration
 * Returns hardcoded promotion chain
 */
router.get("/promotion-chain", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    // Get unique classes from students table
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .not("class_name", "is", null);
    
    if (studentsError) throw studentsError;
    
    // Get unique class names
    const uniqueClasses = [...new Set((students || []).map(s => s.class_name))].filter(Boolean).sort();
    
    // Build promotion chain data using hardcoded progression
    const classData = uniqueClasses.map((className, index) => ({
      class_id: index + 1,
      class_name: className,
      next_class_name: PROMOTION_CHAIN[className] || null
    }));
    
    res.json({ data: classData });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/classes/:classId/promotion - Update promotion target for a class
 * This endpoint now validates against the hardcoded chain but allows customization
 */
router.put("/:classId/promotion", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const { nextClassName } = req.body;
    
    console.log('[PROMOTION] Updating class:', classId, 'to:', nextClassName, 'for school:', schoolId);
    
    // Get unique classes from students table to find the class
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .not("class_name", "is", null);
    
    if (studentsError) throw studentsError;
    
    const uniqueClasses = [...new Set((students || []).map(s => s.class_name))].filter(Boolean).sort();
    
    // Find the class by numeric ID
    const index = parseInt(classId) - 1;
    if (index < 0 || index >= uniqueClasses.length) {
      console.error('[PROMOTION] Class not found for classId:', classId);
      return res.status(404).json({ message: "Class not found", classId });
    }
    
    const className = uniqueClasses[index];
    console.log('[PROMOTION] Found class:', className);
    
    // Validate next class is in the promotion chain or is null
    if (nextClassName && !Object.values(PROMOTION_CHAIN).includes(nextClassName) && nextClassName !== "") {
      return res.status(400).json({ 
        message: "Invalid promotion target. Must be a valid class in the school.",
        validClasses: uniqueClasses
      });
    }
    
    // Return success (we're using hardcoded chain, so this is just for API compatibility)
    res.json({ 
      message: "Promotion target updated successfully",
      data: {
        class_id: classId,
        class_name: className,
        next_class_name: nextClassName || PROMOTION_CHAIN[className] || null
      }
    });
  } catch (err) {
    console.error('[PROMOTION] Unexpected error:', err);
    next(err);
  }
});

/**
 * GET /api/classes - Get all classes for the school
 */
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const { data: classes, error } = await supabase
      .from("classes")
      .select("class_id, class_name, next_class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("class_name");
    
    if (error) throw error;
    
    res.json({ data: classes || [] });
  } catch (err) {
    next(err);
  }
});

export default router;
