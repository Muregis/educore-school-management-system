import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles, requireDirector } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

function normalizeGender(value) {
  if (!value || value === "" || value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (s === 'm' || s === 'male') return 'male';
  if (s === 'f' || s === 'female') return 'female';
  if (s === 'o' || s === 'other') return 'other';
  // If it's already a valid value, return it
  if (['male', 'female', 'other'].includes(s)) return s;
  // Default to null for unrecognized values
  return null;
}

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows, error } = await supabase
      .from("teachers")
      .select("teacher_id, staff_number, national_id, first_name, last_name, email, phone, gender, department, qualification, status, hire_date, created_at")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("first_name");

    if (error) throw error;
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRoles("admin", "hr", "director"), async (req, res, next) => {
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
      gender,
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
        gender: normalizeGender(gender),
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

    // Create user account for teacher login - this is required for class assignments
    let userId;
    try {
      const defaultPass = email.split("@")[0];
      const hash = await bcrypt.hash(defaultPass, 10);
      
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("email", email)
        .maybeSingle();
      
      if (existingUser) {
        userId = existingUser.user_id;
        // Update existing user to teacher role
        await supabase
          .from("users")
          .update({ role: "teacher", status: "active" })
          .eq("user_id", userId);
        console.log("Updated existing user to teacher role:", userId);
      } else {
        // Create new user account
        const { data: userResult, error: userError } = await supabase
          .from("users")
          .insert({
            school_id: schoolId,
            full_name: `${firstName} ${lastName}`,
            email,
            password_hash: hash,
            role: "teacher",
            status: "active",
          })
          .select("user_id")
          .single();
        
        if (userError) {
          console.error("Failed to create teacher user account:", userError);
          throw new Error(`Failed to create teacher login: ${userError.message}`);
        }
        
        userId = userResult.user_id;
        console.log("Teacher user account created successfully:", userId);
      }
      
      // Link teacher to user account
      if (userId) {
        await supabase
          .from("teachers")
          .update({ user_id: userId })
          .eq("teacher_id", insertedTeacher.teacher_id);
        insertedTeacher.user_id = userId;
      }
    } catch (e) {
      console.error("Could not create teacher user account:", e.message);
      // Don't throw - allow teacher creation to succeed but log the error
      // The user can use the sync-hr endpoint to create the account later
    }

    res.status(201).json({ ...insertedTeacher, defaultPassword: email.split("@")[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Email or staff number already exists" });
    }
    next(err);
  }
});

router.put("/:id", requireRoles("admin", "hr", "director"), async (req, res, next) => {
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
      gender,
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
        gender: normalizeGender(gender),
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

// POST /api/teachers/sync-hr - Sync all existing teachers to HR staff table and create user accounts
router.post("/sync-hr", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    console.log('[SYNC] Starting teacher sync for school:', schoolId);
    
    // Increase timeout for long-running sync operations
    req.setTimeout(900000); // 15 minutes
    
    // Get all teachers
    const { data: teachers, error: teachersError } = await supabase
      .from("teachers")
      .select("teacher_id, first_name, last_name, email, phone, department, qualification, hire_date, status, user_id")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);
    
    if (teachersError) {
      console.error('[SYNC] Error fetching teachers:', teachersError);
      throw teachersError;
    }
    
    console.log('[SYNC] Found', teachers?.length || 0, 'teachers to sync');
    
    let syncedToHR = 0;
    let userAccountsCreated = 0;
    let userAccountsLinked = 0;
    const errors = [];
    
    // Process teachers in smaller batches to avoid timeouts
    const batchSize = 10;
    for (let i = 0; i < (teachers || []).length; i += batchSize) {
      const batch = (teachers || []).slice(i, i + batchSize);
      console.log(`[SYNC] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(teachers.length/batchSize)}`);
      
      for (const teacher of batch) {
        console.log('[SYNC] Processing teacher:', teacher.email);
        try {
          // Step 1: Sync to HR staff table
          const { data: hrStaff, error: hrError } = await supabase
            .from("hr_staff")
            .upsert({
              school_id: schoolId,
              full_name: `${teacher.first_name} ${teacher.last_name}`,
              email: teacher.email || null,
              phone: teacher.phone || null,
              department: teacher.department || 'Academic',
              job_title: teacher.qualification || 'Teacher',
              contract_type: 'Permanent',
              start_date: teacher.hire_date || null,
              status: teacher.status || 'active',
            }, { onConflict: "school_id,email" })
            .select("staff_id")
            .maybeSingle();
          
          if (hrError) {
            console.error('[SYNC] HR upsert error for', teacher.email, ':', hrError);
            errors.push({ teacher: teacher.email, error: `HR sync failed: ${hrError.message}` });
          } else if (hrStaff) {
            syncedToHR++;
          }
          
          // Step 2: Create or update user account for teacher login
          if (!teacher.email) {
            errors.push({ teacher: `${teacher.first_name} ${teacher.last_name}`, error: 'No email address provided' });
            continue;
          }
          
          const defaultPass = teacher.email.split("@")[0];
          const hash = await bcrypt.hash(defaultPass, 10);
          
          // Check if user account exists
          const { data: existingUser, error: userCheckError } = await supabase
            .from("users")
            .select("user_id")
            .eq("school_id", schoolId)
            .eq("email", teacher.email)
            .maybeSingle();
          
          if (userCheckError && userCheckError.code !== 'PGRST116') {
            console.error('[SYNC] Error checking user account for', teacher.email, ':', userCheckError);
            errors.push({ teacher: teacher.email, error: `User check failed: ${userCheckError.message}` });
            continue;
          }
          
          let userId;
          
          if (existingUser) {
            // User exists, update if needed
            userId = existingUser.user_id;
            console.log('[SYNC] User account exists for', teacher.email);
            
            // Update role to teacher if not already
            const { error: updateError } = await supabase
              .from("users")
              .update({ 
                role: "teacher",
                status: "active",
                full_name: `${teacher.first_name} ${teacher.last_name}`,
                updated_at: new Date().toISOString()
              })
              .eq("user_id", userId);
            
            if (updateError) {
              console.error('[SYNC] Error updating user account for', teacher.email, ':', updateError);
              errors.push({ teacher: teacher.email, error: `User update failed: ${updateError.message}` });
            }
          } else {
            // Create new user account
            const { data: newUser, error: userError } = await supabase
              .from("users")
              .insert({
                school_id: schoolId,
                full_name: `${teacher.first_name} ${teacher.last_name}`,
                email: teacher.email,
                password_hash: hash,
                role: "teacher",
                status: "active",
              })
              .select("user_id")
              .single();
            
            if (userError) {
              console.error('[SYNC] Failed to create user account for', teacher.email, ':', userError);
              errors.push({ teacher: teacher.email, error: `User creation failed: ${userError.message}` });
              continue;
            }
            
            userId = newUser.user_id;
            userAccountsCreated++;
            console.log('[SYNC] Created user account for', teacher.email);
          }
          
          // Step 3: Link teacher to user account
          if (userId && teacher.user_id !== userId) {
            const { error: linkError } = await supabase
              .from("teachers")
              .update({ user_id: userId })
              .eq("teacher_id", teacher.teacher_id);
            
            if (linkError) {
              console.error('[SYNC] Failed to link teacher to user account for', teacher.email, ':', linkError);
              errors.push({ teacher: teacher.email, error: `Teacher-user link failed: ${linkError.message}` });
            } else {
              userAccountsLinked++;
              console.log('[SYNC] Linked teacher to user account for', teacher.email);
            }
          }
          
        } catch (e) {
          console.error('[SYNC] Exception for', teacher.email, ':', e.message);
          errors.push({ teacher: teacher.email, error: e.message });
        }
      }
    }
    
    console.log('[SYNC] Sync complete. HR synced:', syncedToHR, 'User accounts created:', userAccountsCreated, 'User accounts linked:', userAccountsLinked, 'Errors:', errors.length);
    
    res.json({ 
      success: true,
      syncedToHR,
      userAccountsCreated,
      userAccountsLinked,
      total: teachers?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('[SYNC] Sync endpoint error:', err);
    next(err);
  }
});

router.delete("/:id", requireRoles("admin", "director"), async (req, res, next) => {
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
