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
    
    // Try to get from classes table first
    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("class_id, class_name, next_class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("class_name");
    
    if (!classesError && classes && classes.length > 0) {
      return res.json({ data: classes });
    }
    
    // If classes table is empty or doesn't exist, get unique classes from students table
    console.log('[CLASSES] Classes table empty or missing, using students table');
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("class_name")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .not("class_name", "is", null);
    
    if (studentsError) throw studentsError;
    
    // Get unique class names
    const uniqueClasses = [...new Set((students || []).map(s => s.class_name))].filter(Boolean).sort();
    
    // Convert to format expected by frontend
    const classData = uniqueClasses.map((className, index) => ({
      class_id: index + 1, // Use numeric ID for frontend compatibility
      class_name: className,
      next_class_name: null
    }));
    
    res.json({ data: classData });
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
    
    console.log('[PROMOTION] Updating class:', classId, 'to:', nextClassName, 'for school:', schoolId);
    
    // Check if classes table exists
    const { data: tableCheck, error: tableCheckError } = await supabase
      .from("classes")
      .select("class_id")
      .limit(1);
    
    if (tableCheckError && tableCheckError.code === '42P01') {
      // Table doesn't exist - create it on the fly
      console.log('[PROMOTION] Classes table does not exist, creating it');
      
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS classes (
            class_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID NOT NULL,
            class_name VARCHAR(100) NOT NULL,
            next_class_name VARCHAR(100),
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      });
      
      if (createError) {
        console.error('[PROMOTION] Failed to create classes table:', createError);
        // If we can't create the table, return an error with instructions
        return res.status(500).json({ 
          message: "Classes table does not exist. Please run migration 006_add_classes_table.sql",
          error: "Table not found"
        });
      }
    }
    
    // Try to find the class by class_id (UUID) or by numeric ID
    let existingClass = null;
    let fetchError = null;
    
    // First try UUID lookup
    const { data: classByUuid, error: uuidError } = await supabase
      .from("classes")
      .select("class_id, class_name")
      .eq("class_id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();
    
    if (!uuidError && classByUuid) {
      existingClass = classByUuid;
    } else {
      // Try numeric ID lookup (if classId is a number)
      const { data: allClasses, error: allError } = await supabase
        .from("classes")
        .select("class_id, class_name")
        .eq("school_id", schoolId)
        .eq("is_deleted", false);
      
      if (!allError && allClasses && allClasses.length > 0) {
        // Try to match by index (for numeric IDs)
        const index = parseInt(classId) - 1;
        if (index >= 0 && index < allClasses.length) {
          existingClass = allClasses[index];
        }
      }
      
      if (!existingClass) {
        console.error('[PROMOTION] Class not found for classId:', classId, 'schoolId:', schoolId);
        console.log('[PROMOTION] Available classes:', allClasses);
        return res.status(404).json({ message: "Class not found", classId, schoolId });
      }
    }
    
    console.log('[PROMOTION] Found class:', existingClass);
    
    // Update next_class_name
    const { data: updatedClass, error: updateError } = await supabase
      .from("classes")
      .update({
        next_class_name: nextClassName || null,
        updated_at: new Date().toISOString()
      })
      .eq("class_id", existingClass.class_id)
      .eq("school_id", schoolId)
      .select()
      .single();
    
    if (updateError) {
      console.error('[PROMOTION] Update error:', updateError);
      throw updateError;
    }
    
    console.log('[PROMOTION] Updated successfully:', updatedClass);
    
    res.json({ 
      message: "Promotion target updated successfully",
      data: updatedClass 
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
