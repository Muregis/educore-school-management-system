import express from "express";
import { supabase } from "../config/supabaseClient.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req;
    const { student_id, record_type } = req.query;

    let query = supabase
      .from("medical_records")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("record_date", { ascending: false });

    if (student_id) query = query.eq("student_id", student_id);
    if (record_type) query = query.eq("record_type", record_type);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { schoolId } = req;
    const { student_id, record_type, record_date, title, description, details, documented_by, follow_up_required, follow_up_date } = req.body;

    if (!student_id || !record_type || !title) {
      return res.status(400).json({ message: "student_id, record_type, and title are required" });
    }

    const { data, error } = await supabase
      .from("medical_records")
      .insert({
        school_id: schoolId,
        student_id,
        record_type,
        record_date: record_date || new Date().toISOString().split("T")[0],
        title,
        description,
        details,
        documented_by,
        follow_up_required: follow_up_required || false,
        follow_up_date,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { record_type, record_date, title, description, details, documented_by, follow_up_required, follow_up_date } = req.body;

    const { data: existing } = await supabase
      .from("medical_records")
      .select("school_id")
      .eq("record_id", id)
      .eq("school_id", schoolId)
      .single();

    if (!existing) {
      return res.status(404).json({ message: "Medical record not found" });
    }

    const { data, error } = await supabase
      .from("medical_records")
      .update({
        record_type,
        record_date,
        title,
        description,
        details,
        documented_by,
        follow_up_required,
        follow_up_date,
        updated_at: new Date().toISOString(),
      })
      .eq("record_id", id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { data: existing } = await supabase
      .from("medical_records")
      .select("school_id")
      .eq("record_id", id)
      .eq("school_id", schoolId)
      .single();

    if (!existing) {
      return res.status(404).json({ message: "Medical record not found" });
    }

    const { error } = await supabase
      .from("medical_records")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("record_id", id);

    if (error) throw error;
    res.json({ message: "Medical record deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;