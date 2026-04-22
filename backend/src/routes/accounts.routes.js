import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

// Apply admin-only to specific routes that need it
// GET /api/accounts/users — list all portal users in this school (admin/teacher/finance)
router.get("/users", requireRoles("admin", "teacher", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, phone, role, status, created_at')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('role')
      .order('full_name');
    if (error) throw error;
    res.json(rows || []);
  } catch (err) { next(err); }
});

// ─── STAFF ACCOUNTS ───────────────────────────────────────────────────────────

// GET /api/accounts/staff — list all staff (admin / teacher / finance)
router.get("/staff", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    console.log(`[DEBUG] Loading staff for schoolId=${schoolId}, requestedBy=${userId}`);
    
    const { data: rows, error } = await supabase
      .from('users')
      .select('user_id, full_name, email, phone, role, status, created_at, is_deleted, school_id')
      .eq('school_id', schoolId)
      .in('role', ['admin', 'teacher', 'finance', 'director'])
      .eq('is_deleted', false)
      .order('role')
      .order('full_name');
    
    if (error) {
      console.error('[DEBUG] Supabase error:', error);
      throw error;
    }
    
    console.log(`[DEBUG] Found ${rows?.length || 0} staff accounts`);
    if (rows?.length > 0) {
      console.log('[DEBUG] First account:', { 
        id: rows[0].user_id, 
        name: rows[0].full_name, 
        role: rows[0].role,
        school_id: rows[0].school_id,
        is_deleted: rows[0].is_deleted
      });
    }
    
    // Also check total count without is_deleted filter (for debugging)
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('user_id, full_name, role, is_deleted, school_id', { count: 'exact', head: false })
      .eq('school_id', schoolId)
      .in('role', ['admin', 'teacher', 'finance']);
    
    if (!allError && allUsers) {
      const deleted = allUsers.filter(u => u.is_deleted).length;
      const active = allUsers.filter(u => !u.is_deleted).length;
      console.log(`[DEBUG] Total staff in DB: ${allUsers.length} (active: ${active}, deleted: ${deleted})`);
    }
    
    res.json(rows || []);
  } catch (err) { 
    console.error('[DEBUG] Error in staff list:', err);
    next(err); 
  }
});

// POST /api/accounts/staff — create a new staff account (admin-only)
router.post("/staff", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, email, phone, role, password, status = "active" } = req.body;

    if (!name || !email || !password || !role)
      return res.status(400).json({ message: "name, email, password and role are required" });
    if (!["admin","teacher","finance"].includes(role))
      return res.status(400).json({ message: "role must be admin, teacher or finance" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    // Check if admin already exists when trying to create another admin
    if (role === "admin") {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("user_id, full_name")
        .eq("school_id", schoolId)
        .in("role", ["admin"])
        .maybeSingle();
      if (usersError) throw usersError;
      if (users) {
        return res.status(409).json({ 
          message: `An admin already exists: ${users.full_name} (${users.email}). Only one admin per school is allowed.` 
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert({
        school_id: schoolId,
        full_name: name,
        email,
        phone: phone || null,
        password_hash: hash,
        role,
        status
      })
      .select('user_id')
      .single();
    if (insertError) {
      if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      throw insertError;
    }
    res.status(201).json({ userId: inserted.user_id, message: "Staff account created" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY" || err.message?.includes("duplicate"))
      return res.status(409).json({ message: "An account with this email already exists" });
    next(err);
  }
});

// PATCH /api/accounts/staff/:id — update name/email/phone/role/status or reset password
router.patch("/staff/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, email, phone, role, status, password } = req.body;

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hash = await bcrypt.hash(password, 10);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hash, updated_at: new Date().toISOString() })
        .eq('user_id', req.params.id)
        .eq('school_id', schoolId)
        .in('role', ['admin', 'teacher', 'finance'])
        .eq('is_deleted', false);
      if (updateError) throw updateError;
    }

    // Build update object
    const updateData = {};
    if (name) updateData.full_name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (role && ["admin","teacher","finance"].includes(role)) updateData.role = role;
    if (status && ["active","inactive"].includes(status)) updateData.status = status;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', req.params.id)
        .eq('school_id', schoolId)
        .in('role', ['admin', 'teacher', 'finance'])
        .eq('is_deleted', false);
      if (updateError) {
        if (updateError.code === '23505' || updateError.message?.includes('duplicate')) {
          return res.status(409).json({ message: "Email already in use" });
        }
        throw updateError;
      }
    }

    res.json({ updated: true });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY" || err.message?.includes("duplicate"))
      return res.status(409).json({ message: "Email already in use" });
    next(err);
  }
});

// DELETE /api/accounts/staff/:id — soft delete (admin-only, cannot delete yourself or last admin)
router.delete("/staff/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const targetId = req.params.id;
    
    // Prevent self-deletion
    if (String(targetId) === String(userId))
      return res.status(400).json({ message: "You cannot delete your own account" });

    // Check if target is an admin
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', targetId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();
    
    if (targetError && targetError.code !== 'PGRST116') throw targetError;
    
    // If deleting an admin, check if this is the last one
    if (targetUser?.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('users')
        .select('user_id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('role', 'admin')
        .eq('is_deleted', false);
      
      if (countError) throw countError;
      if (count <= 1) {
        return res.status(400).json({ message: "Cannot delete the last admin account. Create another admin first." });
      }
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('user_id', targetId)
      .eq('school_id', schoolId)
      .in('role', ['admin', 'teacher', 'finance'])
      .select('user_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Staff account not found" });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ─── PORTAL ACCOUNTS (parent / student) ──────────────────────────────────────

// GET /api/accounts/portal
router.get("/portal", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    // Get users first
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, full_name, email, role, status, student_id')
      .eq('school_id', schoolId)
      .in('role', ['parent', 'student'])
      .eq('is_deleted', false)
      .order('role')
      .order('full_name');
    if (usersError) throw usersError;
    
    // Get student IDs that need lookup
    const studentIds = (users || []).map(u => u.student_id).filter(Boolean);
    
    // Fetch students data separately if there are any student_ids
    let studentsMap = new Map();
    if (studentIds.length > 0) {
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('student_id, first_name, last_name, admission_number, class_name, is_deleted')
        .in('student_id', studentIds)
        .eq('is_deleted', false);
      if (studentsError) throw studentsError;
      (students || []).forEach(s => studentsMap.set(s.student_id, s));
    }
    
    // Join data manually
    const rows = (users || []).map(u => {
      const student = u.student_id ? studentsMap.get(u.student_id) : null;
      return {
        user_id: u.user_id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        status: u.status,
        student_id: u.student_id,
        student_name: student ? `${student.first_name} ${student.last_name}` : null,
        admission_number: student?.admission_number || null,
        class_name: student?.class_name || null
      };
    }).filter(u => !u.student_id || studentsMap.has(u.student_id));
    
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/accounts/portal (admin-only)
router.post("/portal", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, role, password, name } = req.body;

    if (!studentId || !role || !password)
      return res.status(400).json({ message: "studentId, role and password are required" });
    if (!["parent","student"].includes(role))
      return res.status(400).json({ message: "Role must be parent or student" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, admission_number')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();
    if (studentError || !student) return res.status(404).json({ message: "Student not found" });

    const fullName = name?.trim() || (role === "parent"
      ? `Parent of ${student.first_name} ${student.last_name}`
      : `${student.first_name} ${student.last_name}`);
    const email    = `${student.admission_number.toLowerCase()}.${role}@portal`;
    const hash     = await bcrypt.hash(password, 10);

    // Check existing
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('role', role)
      .eq('is_deleted', false)
      .maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existing)
      return res.status(409).json({ message: `A ${role} account already exists for this student` });

    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        full_name: fullName,
        email,
        password_hash: hash,
        role,
        status: 'active'
      })
      .select('user_id')
      .single();
    if (insertError) throw insertError;
    res.status(201).json({ userId: inserted.user_id, message: "Account created" });
  } catch (err) { next(err); }
});

// PATCH /api/accounts/portal/:id
router.patch("/portal/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, password } = req.body;

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hash = await bcrypt.hash(password, 10);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hash, updated_at: new Date().toISOString() })
        .eq('user_id', req.params.id)
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (updateError) throw updateError;
      return res.json({ updated: true });
    }

    if (status) {
      if (!["active","inactive"].includes(status))
        return res.status(400).json({ message: "status must be active or inactive" });
      const { error: updateError } = await supabase
        .from('users')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('user_id', req.params.id)
        .eq('school_id', schoolId)
        .eq('is_deleted', false);
      if (updateError) throw updateError;
      return res.json({ updated: true });
    }

    res.status(400).json({ message: "Provide status or password to update" });
  } catch (err) { next(err); }
});

// DELETE /api/accounts/portal/:id (admin-only)
router.delete("/portal/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { error } = await supabase
      .from('users')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('user_id', req.params.id)
      .eq('school_id', schoolId)
      .in('role', ['parent', 'student']);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

export default router;
