// backend/src/routes/subjects.routes.js
// Subject management routes for schools

import express from "express";
import { supabase } from "../config/supabaseClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = express.Router();

// GET /api/subjects - List all subjects for school
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { category, active = "true", schoolId: querySchoolId } = req.query;

    // DEBUG: Log request info
    console.log('[SUBJECTS DEBUG] Request:', {
      userRole: role,
      userSchoolId: schoolId,
      querySchoolId,
      category,
      active
    });

    // Directors/superadmins can specify a school_id via query param, or see all subjects
    const effectiveSchoolId = querySchoolId ? Number(querySchoolId) : schoolId;

    // Regular users must have a school context
    if (!effectiveSchoolId && role !== 'director' && role !== 'superadmin') {
      return res.status(400).json({ message: "School context required" });
    }

    let query = supabase
      .from("subjects")
      .select("subject_id, name, code, category, description, class_levels, max_marks, pass_marks, is_active, created_at, school_id")
      .eq("is_deleted", false);

    // Filter by school_id if specified or for regular users
    if (effectiveSchoolId) {
      query = query.eq("school_id", effectiveSchoolId);
    }

    if (active === "true") {
      query = query.eq("is_active", true);
    }

    if (category) {
      query = query.eq("category", category);
    }

    query = query.order("category", { ascending: true }).order("name", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) { next(err); }
});

// GET /api/subjects/:id - Get single subject
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("subjects")
      .select("subject_id, name, code, category, description, class_levels, max_marks, pass_marks, is_active, created_at")
      .eq("subject_id", id)
      .eq("school_id", schoolId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ message: "Subject not found" });
      }
      throw error;
    }

    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/subjects - Create new subject
router.post("/", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, code, category, description, classLevels, maxMarks = 100, passMarks = 40 } = req.body;

    if (!name || !code) {
      return res.status(400).json({ message: "Name and code are required" });
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        school_id: schoolId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        description,
        class_levels: classLevels,
        max_marks: maxMarks,
        pass_marks: passMarks,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(400).json({ message: "Subject with this code already exists" });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PUT /api/subjects/:id - Update subject
router.put("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { name, code, category, description, classLevels, maxMarks, passMarks, isActive } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (classLevels !== undefined) updates.class_levels = classLevels;
    if (maxMarks !== undefined) updates.max_marks = maxMarks;
    if (passMarks !== undefined) updates.pass_marks = passMarks;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await supabase
      .from("subjects")
      .update(updates)
      .eq("subject_id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ message: "Subject not found" });
      }
      throw error;
    }

    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/subjects/:id - Delete subject (soft delete)
router.delete("/:id", requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { error } = await supabase
      .from("subjects")
      .update({ is_deleted: true })
      .eq("subject_id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    res.json({ message: "Subject deleted successfully" });
  } catch (err) { next(err); }
});

// GET /api/subjects/:id - Get single subject
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("subjects")
      .select("subject_id, subject_name as name, code, category, description, class_levels, max_marks, pass_marks, is_active, created_at")
      .eq("subject_id", id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Subject not found" });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/subjects - Create new subject (admin/teacher only)
router.post("/", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      name,
      code = null,
      category = null,
      description = null,
      classLevels = null,
      maxMarks = 100,
      passMarks = 40,
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Subject name is required" });
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert({
        school_id: schoolId,
        subject_name: name.trim(),
        code: code ? code.trim().toUpperCase() : null,
        category: category ? category.trim() : null,
        description: description ? description.trim() : null,
        class_levels: classLevels ? (Array.isArray(classLevels) ? classLevels.join(",") : classLevels) : null,
        max_marks: Number(maxMarks) || 100,
        pass_marks: Number(passMarks) || 40,
        is_active: true,
        is_deleted: false,
      })
      .select("subject_id, subject_name as name, code, category, description, class_levels, max_marks, pass_marks, is_active, created_at")
      .single();

    if (error) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "A subject with this name already exists" });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/subjects/:id - Update subject (admin/teacher only)
router.put("/:id", requireAuth, requireRoles("admin", "teacher"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const {
      name,
      code,
      category,
      description,
      classLevels,
      maxMarks,
      passMarks,
      isActive,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.subject_name = name.trim();
    if (code !== undefined) updates.code = code ? code.trim().toUpperCase() : null;
    if (category !== undefined) updates.category = category ? category.trim() : null;
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (classLevels !== undefined) updates.class_levels = classLevels ? (Array.isArray(classLevels) ? classLevels.join(",") : classLevels) : null;
    if (maxMarks !== undefined) updates.max_marks = Number(maxMarks);
    if (passMarks !== undefined) updates.pass_marks = Number(passMarks);
    if (isActive !== undefined) updates.is_active = Boolean(isActive);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("subjects")
      .update(updates)
      .eq("subject_id", id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select("subject_id, subject_name as name, code, category, description, class_levels, max_marks, pass_marks, is_active, created_at")
      .single();

    if (error) {
      if (error.message?.includes("unique")) {
        return res.status(409).json({ message: "A subject with this name already exists" });
      }
      throw error;
    }

    if (!data) return res.status(404).json({ message: "Subject not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/subjects/:id - Soft delete subject (admin only)
router.delete("/:id", requireAuth, requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("subjects")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("subject_id", id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select("subject_id")
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Subject not found" });

    res.json({ deleted: true, subjectId: id });
  } catch (err) {
    next(err);
  }
});

// GET /api/subjects/categories/list - Get all unique categories for school
router.get("/categories/list", requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data, error } = await supabase
      .from("subjects")
      .select("category")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("is_active", true);

    if (error) throw error;

    const categories = [...new Set((data || []).map(s => s.category).filter(Boolean))];
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// POST /api/subjects/seed-defaults - Seed default Kenyan curriculum subjects
router.post("/seed-defaults", requireAuth, requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const defaultSubjects = [
      // Languages
      { name: "English", category: "Languages", code: "ENG" },
      { name: "Kiswahili", category: "Languages", code: "KIS" },
      { name: "Indigenous Languages", category: "Languages", code: "IND" },
      // Sciences
      { name: "Mathematics", category: "Sciences", code: "MAT" },
      { name: "Biology", category: "Sciences", code: "BIO" },
      { name: "Chemistry", category: "Sciences", code: "CHEM" },
      { name: "Physics", category: "Sciences", code: "PHY" },
      { name: "Environmental Studies", category: "Sciences", code: "ENV" },
      // Humanities
      { name: "History", category: "Humanities", code: "HIST" },
      { name: "Geography", category: "Humanities", code: "GEO" },
      { name: "Religious Education", category: "Humanities", code: "RE" },
      { name: "Christian Religious Education (CRE)", category: "Humanities", code: "CRE" },
      // Creative & Technical
      { name: "Agriculture", category: "Technical", code: "AGR" },
      { name: "Business Studies", category: "Technical", code: "BST" },
      { name: "Computer Studies", category: "Technical", code: "COMP" },
      { name: "Home Science", category: "Creative", code: "HS" },
      { name: "Art & Design", category: "Creative", code: "ART" },
      { name: "Creative Activities", category: "Creative", code: "CRA" },
      { name: "Music", category: "Creative", code: "MUS" },
      { name: "Physical Education", category: "Creative", code: "PE" },
    ];

    const inserted = [];
    const skipped = [];

    for (const subj of defaultSubjects) {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          school_id: schoolId,
          subject_name: subj.name,
          code: subj.code,
          category: subj.category,
          max_marks: 100,
          pass_marks: 40,
          is_active: true,
          is_deleted: false,
        })
            .select("subject_id, name, code, category")
        .maybeSingle();

      if (error) {
        if (error.message?.includes("unique")) {
          skipped.push(subj.name);
        }
      } else if (data) {
        inserted.push(data);
      }
    }

    res.json({
      message: `Seeded ${inserted.length} subjects, skipped ${skipped.length} duplicates`,
      inserted,
      skipped,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
