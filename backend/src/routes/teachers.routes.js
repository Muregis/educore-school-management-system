import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows, error } = await supabase
      .from("teachers")
      .select("teacher_id, staff_number, national_id, first_name, last_name, email, phone, department, qualification, status, hire_date, created_at")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("first_name");

    if (error) throw error;
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRoles("admin", "hr"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName,
      lastName,
      email,
      phone,
      staffNumber,
      department,
      qualification,
      hireDate,
      tscStaffId,
      status = "active",
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "firstName, lastName and email are required" });
    }

    let finalStaffNumber = staffNumber;
    if (!finalStaffNumber) {
      const { count, error: countError } = await supabase
        .from("teachers")
        .select("teacher_id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("is_deleted", false);

      if (countError) throw countError;
      const nextNumber = Number(count || 0) + 1;
      finalStaffNumber = `STF-${schoolId}-${String(nextNumber).padStart(4, "0")}`;
    }

    const { data: insertedTeacher, error: insertTeacherError } = await supabase
      .from("teachers")
      .insert({
        school_id: schoolId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        staff_number: finalStaffNumber,
        national_id: tscStaffId || null,
        department: department || null,
        qualification: qualification || null,
        hire_date: hireDate || null,
        status,
      })
      .select("*")
      .single();

    if (insertTeacherError) throw insertTeacherError;

    try {
      const defaultPass = email.split("@")[0];
      const hash = await bcrypt.hash(defaultPass, 10);
      await supabase
        .from("users")
        .upsert({
          school_id: schoolId,
          full_name: `${firstName} ${lastName}`,
          email,
          password_hash: hash,
          role: "teacher",
          status: "active",
        }, { onConflict: "school_id,email" });
    } catch (e) {
      console.warn("Could not create teacher user account:", e.message);
    }

    res.status(201).json({ ...insertedTeacher, defaultPassword: email.split("@")[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Email or staff number already exists" });
    }
    next(err);
  }
});

router.put("/:id", requireRoles("admin", "hr"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      firstName,
      lastName,
      email,
      phone,
      staffNumber,
      department,
      qualification,
      hireDate,
      tscStaffId,
      status,
    } = req.body;

    const { data: updatedTeacher, error } = await supabase
      .from("teachers")
      .update({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        staff_number: staffNumber || null,
        tsc_staff_id: tscStaffId || null,
        department: department || null,
        qualification: qualification || null,
        hire_date: hireDate || null,
        status: status || "active",
        updated_at: new Date().toISOString(),
      })
      .eq("teacher_id", req.params.id)
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .select("teacher_id")
      .maybeSingle();

    if (error) throw error;
    if (!updatedTeacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: deletedTeacher, error } = await supabase
      .from("teachers")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("teacher_id", req.params.id)
      .eq("school_id", schoolId)
      .select("teacher_id")
      .maybeSingle();

    if (error) throw error;
    if (!deletedTeacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
