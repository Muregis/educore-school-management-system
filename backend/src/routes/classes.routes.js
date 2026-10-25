import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { compareClasses, getClassLevelRank } from "../utils/classLevels.js";

const router = Router();
router.use(authRequired);

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

router.put("/:classId/promotion", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const { nextClassName, classOrder } = req.body;
    const updateData = { updated_at: new Date().toISOString() };
    if (nextClassName === undefined || nextClassName === null || nextClassName === "") {
      updateData.next_class_name = null;
    } else {
      updateData.next_class_name = String(nextClassName).trim();
    }
    if (classOrder !== undefined) updateData.class_order = Number(classOrder);
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
    if (!data) return res.status(404).json({ message: "Class not found", classId });
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

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: classes, error } = await supabase
      .from("classes")
      .select("class_id, class_name, next_class_name, class_order, section, status")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);
    if (error) throw error;
    const sorted = [...(classes || [])].sort(compareClasses);
    res.json({ data: sorted });
  } catch (err) {
    next(err);
  }
});

/** POST /api/classes — create class (optional stream via section) */
router.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const class_name = String(req.body.class_name || "").trim();
    if (!class_name) return res.status(400).json({ message: "class_name is required" });
    const section = req.body.section != null && String(req.body.section).trim()
      ? String(req.body.section).trim()
      : null;
    const row = {
      school_id: schoolId,
      class_name,
      section,
      status: "active",
      is_deleted: false,
      next_class_name: req.body.next_class_name || null,
      class_order: req.body.class_order != null ? Number(req.body.class_order) : getClassLevelRank(class_name),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("classes")
      .insert(row)
      .select("class_id, class_name, section, status, next_class_name")
      .single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/classes/:classId — update name / stream (section) */
router.patch("/:classId", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const update = { updated_at: new Date().toISOString() };
    if (req.body.class_name != null) update.class_name = String(req.body.class_name).trim();
    if (req.body.section !== undefined) {
      update.section =
        req.body.section === null || req.body.section === ""
          ? null
          : String(req.body.section).trim();
    }
    if (req.body.status != null) update.status = String(req.body.status);
    if (req.body.next_class_name !== undefined) update.next_class_name = req.body.next_class_name || null;
    const { data, error } = await supabase
      .from("classes")
      .update(update)
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .select("class_id, class_name, section, status, next_class_name")
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Class not found" });
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
