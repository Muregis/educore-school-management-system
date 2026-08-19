import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

/**
 * GET /api/classes/promotion-chain - Get promotion chain configuration
 * Returns classes from the database with their promotion targets
 */
router.get("/promotion-chain", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    const { data: classes, error } = await supabase
      .from("classes")
      .select("class_id, class_name, next_class_name, class_order, status")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("class_order", { ascending: true })
      .order("class_name", { ascending: true });

    if (error) throw error;

    const classData = (classes || []).map((cls) => ({
      class_id: cls.class_id,
      class_name: cls.class_name,
      next_class_name: cls.next_class_name || null,
      class_order: cls.class_order || 0,
      status: cls.status || "active",
    }));

    res.json({ data: classData });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/classes/:classId/promotion - Update promotion target for a class
 * Persists next_class_name to the database
 */
router.put("/:classId/promotion", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const { nextClassName, classOrder } = req.body;

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (nextClassName === undefined || nextClassName === null || nextClassName === "") {
      updateData.next_class_name = null;
    } else {
      updateData.next_class_name = String(nextClassName).trim();
    }

    if (classOrder !== undefined) {
      updateData.class_order = Number(classOrder);
    }

    const { data, error } = await supabase
      .from("classes")
      .update(updateData)
      .eq("school_id", schoolId)
      .or(`class_id.eq.${classId},class_name.eq.${classId}`)
      .select()
      .single();

    if (error) {
      if (error.code === "42703") {
        return res.status(400).json({
          message: "Promotion columns not found. Please run the promotion columns migration.",
          detail: error.message,
        });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({ message: "Class not found", classId });
    }

    res.json({
      message: "Promotion target updated successfully",
      data: {
        class_id: data.class_id,
        class_name: data.class_name,
        next_class_name: data.next_class_name,
        class_order: data.class_order,
      },
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
