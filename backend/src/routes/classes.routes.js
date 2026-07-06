import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

/**
 * GET /api/classes/promotion-chain - Get promotion chain configuration
 * Returns all classes with their next class in the promotion chain
 */
router.get("/promotion-chain", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
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

/**
 * PUT /api/classes/:classId/promotion - Update promotion target for a class
 * Body: { nextClassName }
 */
router.put("/:classId/promotion", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const { nextClassName } = req.body;
    
    // Verify class exists and belongs to school
    const { data: existingClass, error: fetchError } = await supabase
      .from("classes")
      .select("class_id, class_name")
      .eq("class_id", classId)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!existingClass) {
      return res.status(404).json({ message: "Class not found" });
    }
    
    // Update next_class_name (empty string if no promotion)
    const { data: updatedClass, error: updateError } = await supabase
      .from("classes")
      .update({
        next_class_name: nextClassName || null,
        updated_at: new Date().toISOString()
      })
      .eq("class_id", classId)
      .eq("school_id", schoolId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    res.json({ 
      message: "Promotion target updated successfully",
      data: updatedClass 
    });
  } catch (err) {
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
