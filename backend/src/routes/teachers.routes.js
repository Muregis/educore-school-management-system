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

router.post("/", requireRoles("admin", "hr", "director", "superadmin"), async (req, res, next) => {
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
        tsc_staff_id: tscStaffId || null,
        national_id: null,
        department: department || null,
        qualification: qualification || null,
        hire_date: hireDate || null,
        status,
      })
      .select("*")
      .single();

    if (insertTeacherError) throw insertTeacherError;

    // Sync to HR staff table
    try {
      const { data: hrStaff } = await supabase
        .from("hr_staff")
        .upsert({
          school_id: schoolId,
          full_name: `${firstName} ${lastName}`,
          email: email || null,
          phone: phone || null,
          department: department || 'Academic',
          job_title: qualification || 'Teacher',
          contract_type: 'Permanent',
          start_date: hireDate || null,
          status: status || 'active',
        }, { onConflict: "school_id,email" })
        .select("staff_id")
        .single();
      
      if (hrStaff?.staff_id) {
        // Link teacher record to hr_staff
        await supabase
          .from("teachers")
          .update({ staff_id: hrStaff.staff_id })
          .eq("teacher_id", insertedTeacher.teacher_id);
        insertedTeacher.staff_id = hrStaff.staff_id;
      }
    } catch (e) {
      console.warn("Could not sync teacher to HR staff:", e.message);
    }

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

router.put("/:id", requireRoles("admin", "hr", "director", "superadmin"), async (req, res, next) => {
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

    // Sync updates to HR staff table
    if (email) {
      try {
        await supabase
          .from("hr_staff")
          .upsert({
            school_id: schoolId,
            full_name: `${firstName || ''} ${lastName || ''}`.trim(),
            email: email,
            phone: phone || null,
            department: department || 'Academic',
            job_title: qualification || 'Teacher',
            start_date: hireDate || null,
            status: status || 'active',
            updated_at: new Date().toISOString(),
          }, { onConflict: "school_id,email" });
      } catch (e) {
        console.warn("Could not sync teacher update to HR staff:", e.message);
      }
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/teachers/sync-hr - Sync all existing teachers to HR staff table
router.post("/sync-hr", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    // Get all teachers that don't have staff_id linked
    const { data: teachers, error: teachersError } = await supabase
      .from("teachers")
      .select("teacher_id, first_name, last_name, email, phone, department, qualification, hire_date, status")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .is("staff_id", null);
    
    if (teachersError) throw teachersError;
    
    let synced = 0;
    let errors = [];
    
    for (const teacher of (teachers || [])) {
      try {
        // Sync to HR staff
        const { data: hrStaff, error: hrError } = await supabase
          .from("hr_staff")
          .upsert({
            school_id: schoolId,
            full_name: `${teacher.first_name} ${teacher.last_name}`,
            email: teacher.email,
            phone: teacher.phone || null,
            department: teacher.department || 'Academic',
            job_title: teacher.qualification || 'Teacher',
            contract_type: 'Permanent',
            start_date: teacher.hire_date || null,
            status: teacher.status || 'active',
          }, { onConflict: "school_id,email" })
          .select("staff_id")
          .single();
        
        if (hrError) {
          errors.push({ teacher: teacher.email, error: hrError.message });
          continue;
        }
        
        // Link teacher to hr_staff
        if (hrStaff?.staff_id) {
          await supabase
            .from("teachers")
            .update({ staff_id: hrStaff.staff_id })
            .eq("teacher_id", teacher.teacher_id);
          synced++;
        }
      } catch (e) {
        errors.push({ teacher: teacher.email, error: e.message });
      }
    }
    
    res.json({ 
      synced, 
      total: teachers?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
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

    // Soft-delete linked HR staff record
    try {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("email, staff_id")
        .eq("teacher_id", req.params.id)
        .single();
      
      if (teacher?.staff_id) {
        await supabase
          .from("hr_staff")
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq("staff_id", teacher.staff_id)
          .eq("school_id", schoolId);
      } else if (teacher?.email) {
        await supabase
          .from("hr_staff")
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq("email", teacher.email)
          .eq("school_id", schoolId);
      }
    } catch (e) {
      console.warn("Could not sync teacher deletion to HR staff:", e.message);
    }

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
