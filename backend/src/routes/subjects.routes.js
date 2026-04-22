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
    if (!supabase) return res.status(503).json({ message: "Database service unavailable" });
    const { schoolId, role } = req.user;
    const { category, active = "true", schoolId: querySchoolId } = req.query;

    const effectiveSchoolId = querySchoolId ? Number(querySchoolId) : schoolId;

    if (!effectiveSchoolId && role !== 'director' && role !== 'superadmin') {
      return res.status(400).json({ message: "School context required" });
    }

    // Use * to be safe against schema variations
    let query = supabase
      .from("subjects")
      .select("*")
      .eq("is_deleted", false);

    if (effectiveSchoolId) {
      query = query.eq("school_id", effectiveSchoolId);
    }

    query = query.order("category", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Normalise data for frontend
    const normalised = (data || []).map(s => ({
      ...s,
      id: s.subject_id || s.id,
      name: s.name || s.subject_name || "",
      is_active: s.is_active !== undefined ? s.is_active : (s.status === 'active' || s.status === true),
    }));

    const filtered = active === "true" ? normalised.filter(s => s.is_active) : normalised;
    res.json(filtered);
  } catch (err) { next(err); }
});

// GET /api/subjects/:id - Get single subject
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ message: "Database service unavailable" });
    const { schoolId, role } = req.user;
    const { id } = req.params;

    let query = supabase
      .from("subjects")
      .select("*")
      .eq("is_deleted", false);

    // Try both possible ID columns
    if (id.includes("-")) { // UUID
       query = query.eq("subject_id", id);
    } else {
       query = query.or(`subject_id.eq.${id},id.eq.${id}`);
    }

    if (role !== 'director' && role !== 'superadmin') {
      query = query.eq("school_id", schoolId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Subject not found" });

    res.json({
      ...data,
      id: data.subject_id || data.id,
      name: data.name || data.subject_name || "",
      is_active: data.is_active !== undefined ? data.is_active : (data.status === 'active' || data.status === true),
    });
  } catch (err) { next(err); }
});

// POST /api/subjects - Create new subject
router.post("/", requireAuth, requireRoles("admin", "teacher", "director"), async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ message: "Database service unavailable" });
    const { schoolId } = req.user;
    const { 
      name, 
      code = null, 
      category = null, 
      description = null, 
      classLevels = null, 
      maxMarks = 100, 
      passMarks = 40,
      schoolId: bodySchoolId 
    } = req.body;

    const effectiveSchoolId = bodySchoolId || schoolId;
    if (!name || !effectiveSchoolId) {
      return res.status(400).json({ message: "Name and School ID are required" });
    }

    const insertData = {
      school_id: effectiveSchoolId,
      name: name.trim(),
      subject_name: name.trim(),
      code: code ? code.trim().toUpperCase() : null,
      category: category ? category.trim() : null,
      description: description ? description.trim() : null,
      class_levels: Array.isArray(classLevels) ? classLevels.join(",") : (classLevels || null),
      max_marks: Number(maxMarks) || 100,
      pass_marks: Number(passMarks) || 40,
      is_active: true,
      status: 'active',
      is_deleted: false,
    };

    const { data, error } = await supabase.from("subjects").insert(insertData).select().single();

    if (error) {
      if (error.code === "23505") return res.status(409).json({ message: "Duplicate subject" });
      throw error;
    }

    res.status(201).json({
      ...data,
      id: data.subject_id || data.id,
      name: data.name || data.subject_name,
      is_active: data.is_active !== undefined ? data.is_active : (data.status === 'active'),
    });
  } catch (err) { next(err); }
});

// PUT /api/subjects/:id - Update subject
router.put("/:id", requireAuth, requireRoles("admin", "teacher", "director"), async (req, res, next) => {
  try {
    const { schoolId, role } = req.user;
    const { id } = req.params;
    const { name, code, category, description, classLevels, maxMarks, passMarks, isActive } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) { updates.name = name; updates.subject_name = name; }
    if (code !== undefined) updates.code = code;
    if (category !== undefined) updates.category = category;
    if (description !== undefined) updates.description = description;
    if (classLevels !== undefined) updates.class_levels = Array.isArray(classLevels) ? classLevels.join(",") : (classLevels || null);
    if (maxMarks !== undefined) updates.max_marks = Number(maxMarks);
    if (passMarks !== undefined) updates.pass_marks = Number(passMarks);
    if (isActive !== undefined) {
      updates.is_active = Boolean(isActive);
      updates.status = isActive ? 'active' : 'inactive';
    }

    let query = supabase.from("subjects").update(updates).eq("is_deleted", false);
    if (id.includes("-")) query = query.eq("subject_id", id);
    else query = query.or(`subject_id.eq.${id},id.eq.${id}`);

    if (role !== 'director' && role !== 'superadmin') {
      query = query.eq("school_id", schoolId);
    }

    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Subject not found" });

    res.json({
      ...data,
      id: data.subject_id || data.id,
      name: data.name || data.subject_name,
      is_active: data.is_active !== undefined ? data.is_active : (data.status === 'active'),
    });
  } catch (err) { next(err); }
});

// DELETE /api/subjects/:id - Soft delete subject
router.delete("/:id", requireAuth, requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ message: "Database service unavailable" });
    const { schoolId, role } = req.user;
    const { id } = req.params;

    let query = supabase
      .from("subjects")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("is_deleted", false);

    if (id.includes("-")) query = query.eq("subject_id", id);
    else query = query.or(`subject_id.eq.${id},id.eq.${id}`);

    if (role !== 'director' && role !== 'superadmin') {
      query = query.eq("school_id", schoolId);
    }

    const { data, error } = await query.select("subject_id, id").maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Subject not found" });

    res.json({ message: "Subject deleted successfully", id: data.subject_id || data.id });
  } catch (err) { next(err); }
});

// GET /api/subjects/categories/list - Get all unique categories
router.get("/categories/list", requireAuth, async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ message: "Database service unavailable" });
    const { schoolId, role } = req.user;
    const { schoolId: querySchoolId } = req.query;

    const effectiveSchoolId = querySchoolId ? Number(querySchoolId) : schoolId;

    let query = supabase.from("subjects").select("category").eq("is_deleted", false);

    if (effectiveSchoolId) {
      query = query.eq("school_id", effectiveSchoolId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const categories = [...new Set((data || []).map(s => s.category).filter(Boolean))];
    res.json(categories);
  } catch (err) { next(err); }
});

// POST /api/subjects/seed-defaults - Seed default subjects
router.post("/seed-defaults", requireAuth, requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    if (!supabase) return res.status(503).json({ message: "Database service unavailable" });
    const { schoolId } = req.user;
    const { schoolId: bodySchoolId } = req.body;

    const effectiveSchoolId = bodySchoolId || schoolId;
    if (!effectiveSchoolId) return res.status(400).json({ message: "School ID required" });

    const defaultSubjects = [
      { name: "English", category: "Languages", code: "ENG" },
      { name: "Kiswahili", category: "Languages", code: "KIS" },
      { name: "Indigenous Languages", category: "Languages", code: "IND" },
      { name: "Mathematics", category: "Sciences", code: "MAT" },
      { name: "Biology", category: "Sciences", code: "BIO" },
      { name: "Chemistry", category: "Sciences", code: "CHEM" },
      { name: "Physics", category: "Sciences", code: "PHY" },
      { name: "Environmental Studies", category: "Sciences", code: "ENV" },
      { name: "History", category: "Humanities", code: "HIST" },
      { name: "Geography", category: "Humanities", code: "GEO" },
      { name: "Religious Education", category: "Humanities", code: "RE" },
      { name: "Christian Religious Education (CRE)", category: "Humanities", code: "CRE" },
      { name: "Agriculture", category: "Technical", code: "AGR" },
      { name: "Business Studies", category: "Technical", code: "BST" },
      { name: "Computer Studies", category: "Technical", code: "COMP" },
      { name: "Home Science", category: "Creative", code: "HS" },
      { name: "Art & Design", category: "Creative", code: "ART" },
      { name: "Music", category: "Creative", code: "MUS" },
    ];

    const inserted = [];
    for (const subj of defaultSubjects) {
      const { data } = await supabase.from("subjects").insert({
        school_id: effectiveSchoolId,
        name: subj.name,
        subject_name: subj.name,
        code: subj.code,
        category: subj.category,
        is_active: true,
        status: 'active'
      }).select("subject_id, id, name, subject_name").maybeSingle();
      if (data) inserted.push(data);
    }

    res.json({ message: `Seeded ${inserted.length} subjects`, count: inserted.length });
  } catch (err) { next(err); }
});
  } catch (err) {
    next(err);
  }
});

export default router;
