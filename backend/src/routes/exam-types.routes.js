import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// GET /api/exam-types - Get exam types for the school
router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data, error } = await supabase
      .from("exam_types")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("exam_sequence", { ascending: true });

    if (error) throw error;

    // If no exam types exist, return default types
    if (!data || data.length === 0) {
      return res.json([
        { exam_type_id: null, exam_name: "Opener", exam_sequence: 1, weight_percentage: 100, is_active: true },
        { exam_type_id: null, exam_name: "Mid-Term", exam_sequence: 2, weight_percentage: 100, is_active: true },
        { exam_type_id: null, exam_name: "End-Term", exam_sequence: 3, weight_percentage: 100, is_active: true }
      ]);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/exam-types - Create exam type
router.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { examName, examSequence, weightPercentage = 100 } = req.body;

    if (!examName || !examSequence) {
      return res.status(400).json({ message: "examName and examSequence are required" });
    }

    const { data, error } = await supabase
      .from("exam_types")
      .insert({
        school_id: schoolId,
        exam_name: examName,
        exam_sequence: examSequence,
        weight_percentage: weightPercentage,
        is_active: true,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/exam-types/:id - Update exam type
router.put("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { examName, examSequence, weightPercentage, isActive } = req.body;

    const { data, error } = await supabase
      .from("exam_types")
      .update({
        exam_name: examName,
        exam_sequence: examSequence,
        weight_percentage: weightPercentage,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq("exam_type_id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Exam type not found" });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/exam-types/:id - Delete exam type
router.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("exam_types")
      .update({ is_active: false })
      .eq("exam_type_id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Exam type not found" });

    res.json({ message: "Exam type deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
