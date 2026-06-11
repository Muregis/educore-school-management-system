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
      .select("teacher_id, user_id, staff_number, national_id, first_name, last_name, email, phone, gender, department, qualification, status, hire_date, created_at")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("first_name");

    if (error) throw error;

    // Also fetch staff members with teacher job titles who aren't in teachers table
    const { data: staffTeachers, error: staffError } = await supabase
      .from("hr_staff")
      .select("staff_id, full_name, email, phone, department, job_title, status, start_date")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .eq("status", "active");

    if (staffError) {
      console.error("Error fetching staff teachers:", staffError);
    }

    // Filter staff members who are teachers based on job title
    // Match various forms of teacher titles including compound words
    const teacherRegex = /teacher|tutor|instructor|lecturer|professor|educator|class teacher|subject teacher|teaching assistant/i;
    const nonTeachingRoles = /admin|administrator|secretary|accountant|manager|director|principal|headmaster|headmistress|bursar|finance|hr|human resources|officer|assistant|clerk|security|driver|cook|cleaner|nurse|doctor|librarian|it support|maintenance|receptionist|storekeeper|caretaker|groundsman/i;

    const staffAsTeachers = (staffTeachers || []).filter(s => {
      const jobTitle = (s.job_title || "").toLowerCase();
      const dept = (s.department || "").toLowerCase();
      // Include if job title contains teacher-related terms
      // Exclude if job title contains non-teaching roles
      const isTeachingRole = teacherRegex.test(jobTitle);
      const isNonTeaching = nonTeachingRoles.test(jobTitle);
      return isTeachingRole && !isNonTeaching;
    });

    // Get existing teacher emails to avoid duplicates
    const existingEmails = new Set((rows || []).map(t => t.email?.toLowerCase()).filter(Boolean));

    // Add staff teachers who aren't already in teachers table
    const additionalTeachers = staffAsTeachers
      .filter(s => s.email && !existingEmails.has(s.email.toLowerCase()))
      .map(s => ({
        teacher_id: `staff-${s.staff_id}`,
        user_id: null,
        staff_number: `HR-${s.staff_id}`,
        national_id: null,
        first_name: s.full_name.split(' ')[0] || s.full_name,
        last_name: s.full_name.split(' ').slice(1).join(' ') || '',
        email: s.email,
        phone: s.phone,
        gender: null,
        department: s.department,
        qualification: s.job_title,
        status: s.status,
        hire_date: s.start_date,
        created_at: s.created_at || new Date().toISOString()
      }));

    res.json([...(rows || []), ...additionalTeachers]);
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
      // Check if HR staff exists by email
      const { data: existingHrStaff } = await supabase
        .from("hr_staff")
        .select("staff_id")
        .eq("school_id", schoolId)
        .eq("email", email)
        .maybeSingle();

      let hrStaff;
      if (existingHrStaff) {
        // Update existing
        const { data } = await supabase
          .from("hr_staff")
          .update({
            full_name: `${firstName} ${lastName}`,
            phone: phone || null,
            department: department || 'Academic',
            job_title: qualification || 'Teacher',
            start_date: hireDate || null,
            status: status || 'active',
            updated_at: new Date().toISOString(),
          })
          .eq("staff_id", existingHrStaff.staff_id)
          .select("staff_id")
          .single();
        hrStaff = data;
      } else {
        // Insert new
        const { data } = await supabase
          .from("hr_staff")
          .insert({
            school_id: schoolId,
            full_name: `${firstName} ${lastName}`,
            email: email || null,
            phone: phone || null,
            department: department || 'Academic',
            job_title: qualification || 'Teacher',
            contract_type: 'Permanent',
            start_date: hireDate || null,
            status: status || 'active',
          })
          .select("staff_id")
          .single();
        hrStaff = data;
      }
      
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
        // Check if HR staff exists by email
        const { data: existingHrStaff } = await supabase
          .from("hr_staff")
          .select("staff_id")
          .eq("school_id", schoolId)
          .eq("email", email)
          .maybeSingle();

        if (existingHrStaff) {
          // Update existing
          await supabase
            .from("hr_staff")
            .update({
              full_name: `${firstName || ''} ${lastName || ''}`.trim(),
              phone: phone || null,
              department: department || 'Academic',
              job_title: qualification || 'Teacher',
              start_date: hireDate || null,
              status: status || 'active',
              updated_at: new Date().toISOString(),
            })
            .eq("staff_id", existingHrStaff.staff_id);
        } else {
          // Insert new
          await supabase
            .from("hr_staff")
            .insert({
              school_id: schoolId,
              full_name: `${firstName || ''} ${lastName || ''}`.trim(),
              email: email,
              phone: phone || null,
              department: department || 'Academic',
              job_title: qualification || 'Teacher',
              contract_type: 'Permanent',
              start_date: hireDate || null,
              status: status || 'active',
            });
        }
      } catch (e) {
        console.warn("Could not sync teacher update to HR staff:", e.message);
      }
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

// In-memory job storage (for production, use Redis or database)
const syncJobs = new Map();

// POST /api/teachers/sync-hr/start - Start sync job and return job ID
router.post("/sync-hr/start", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const jobId = `sync-${schoolId}-${Date.now()}`;
    
    console.log('[SYNC] Starting sync job:', jobId);
    
    // Initialize job status
    syncJobs.set(jobId, {
      status: 'processing',
      progress: { processed: 0, total: 0 },
      result: null,
      error: null,
      startedAt: new Date().toISOString()
    });
    
    // Return job ID immediately
    res.json({ jobId });
    
    // Process sync in background (fire and forget)
    processSyncJob(jobId, schoolId).catch(err => {
      console.error('[SYNC] Job failed:', jobId, err);
      const job = syncJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message;
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/teachers/sync-hr/status/:jobId - Get sync job status
router.get("/sync-hr/status/:jobId", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = syncJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// Background sync job processor
async function processSyncJob(jobId, schoolId) {
  const job = syncJobs.get(jobId);
  if (!job) return;
  
  try {
    console.log('[SYNC] Processing job:', jobId, 'for school:', schoolId);
    
    // Get all teachers
    const { data: teachers, error: teachersError } = await supabase
      .from("teachers")
      .select("teacher_id, first_name, last_name, email, phone, department, qualification, hire_date, status, user_id")
      .eq("school_id", schoolId)
      .eq("is_deleted", false);
    
    if (teachersError) {
      throw teachersError;
    }
    
    job.progress.total = teachers?.length || 0;
    console.log('[SYNC] Found', job.progress.total, 'teachers to sync');
    
    let syncedToHR = 0;
    let userAccountsCreated = 0;
    let userAccountsLinked = 0;
    const errors = [];
    
    // Process teachers in smaller batches
    const batchSize = 5;
    for (let i = 0; i < (teachers || []).length; i += batchSize) {
      const batch = (teachers || []).slice(i, i + batchSize);
      
      for (const teacher of batch) {
        try {
          // Step 1: Sync to HR staff table
          // First check if HR staff exists by email
          const { data: existingHrStaff } = await supabase
            .from("hr_staff")
            .select("staff_id")
            .eq("school_id", schoolId)
            .eq("email", teacher.email)
            .maybeSingle();

          let hrStaff;
          if (existingHrStaff) {
            // Update existing
            const { data, error } = await supabase
              .from("hr_staff")
              .update({
                full_name: `${teacher.first_name} ${teacher.last_name}`,
                phone: teacher.phone || null,
                department: teacher.department || 'Academic',
                job_title: teacher.qualification || 'Teacher',
                start_date: teacher.hire_date || null,
                status: teacher.status || 'active',
                updated_at: new Date().toISOString(),
              })
              .eq("staff_id", existingHrStaff.staff_id)
              .select("staff_id")
              .single();
            hrStaff = data;
            if (error) throw error;
          } else {
            // Insert new
            const { data, error } = await supabase
              .from("hr_staff")
              .insert({
                school_id: schoolId,
                full_name: `${teacher.first_name} ${teacher.last_name}`,
                email: teacher.email || null,
                phone: teacher.phone || null,
                department: teacher.department || 'Academic',
                job_title: teacher.qualification || 'Teacher',
                contract_type: 'Permanent',
                start_date: teacher.hire_date || null,
                status: teacher.status || 'active',
              })
              .select("staff_id")
              .single();
            hrStaff = data;
            if (error) throw error;
          }
          
          if (hrStaff) {
            syncedToHR++;
          }
          
          // Step 2: Create or update user account
          if (!teacher.email) {
            errors.push({ teacher: `${teacher.first_name} ${teacher.last_name}`, error: 'No email address provided' });
            job.progress.processed++;
            continue;
          }
          
          const defaultPass = teacher.email.split("@")[0];
          const hash = await bcrypt.hash(defaultPass, 10);
          
          const { data: existingUser } = await supabase
            .from("users")
            .select("user_id")
            .eq("school_id", schoolId)
            .eq("email", teacher.email)
            .maybeSingle();
          
          let userId;
          
          if (existingUser) {
            userId = existingUser.user_id;
            await supabase
              .from("users")
              .update({ 
                role: "teacher",
                status: "active",
                full_name: `${teacher.first_name} ${teacher.last_name}`,
                updated_at: new Date().toISOString()
              })
              .eq("user_id", userId);
          } else {
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
              errors.push({ teacher: teacher.email, error: `User creation failed: ${userError.message}` });
              job.progress.processed++;
              continue;
            }
            
            userId = newUser.user_id;
            userAccountsCreated++;
          }
          
          // Step 3: Link teacher to user account
          if (userId && teacher.user_id !== userId) {
            const { error: linkError } = await supabase
              .from("teachers")
              .update({ user_id: userId })
              .eq("teacher_id", teacher.teacher_id);
            
            if (linkError) {
              errors.push({ teacher: teacher.email, error: `Teacher-user link failed: ${linkError.message}` });
            } else {
              userAccountsLinked++;
            }
          }
          
        } catch (e) {
          errors.push({ teacher: teacher.email, error: e.message });
        }
        
        job.progress.processed++;
      }
      
      // Update job status in storage
      syncJobs.set(jobId, { ...job });
    }
    
    // Mark job as completed
    job.status = 'completed';
    job.result = {
      syncedToHR,
      userAccountsCreated,
      userAccountsLinked,
      total: teachers?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    };
    syncJobs.set(jobId, job);
    
    console.log('[SYNC] Job completed:', jobId, 'HR synced:', syncedToHR, 'Users created:', userAccountsCreated);
    
    // Clean up old jobs (keep only last 10)
    if (syncJobs.size > 10) {
      const keys = Array.from(syncJobs.keys()).slice(0, -10);
      keys.forEach(key => syncJobs.delete(key));
    }
  } catch (err) {
    console.error('[SYNC] Job processing error:', jobId, err);
    const job = syncJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = err.message;
      syncJobs.set(jobId, job);
    }
  }
}

// POST /api/teachers/sync-hr - Legacy endpoint (deprecated, redirects to new job-based approach)
router.post("/sync-hr", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    
    console.log('[SYNC] Legacy sync endpoint called, redirecting to job-based sync');
    
    // Create job directly
    const jobId = `sync-${schoolId}-${Date.now()}`;
    
    syncJobs.set(jobId, {
      status: 'processing',
      progress: { processed: 0, total: 0 },
      result: null,
      error: null,
      startedAt: new Date().toISOString()
    });
    
    // Return job ID immediately
    res.json({ jobId, message: "Please use the new sync endpoint. This endpoint is deprecated." });
    
    // Process in background
    processSyncJob(jobId, schoolId).catch(err => {
      console.error('[SYNC] Job failed:', jobId, err);
      const job = syncJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message;
      }
    });
  } catch (err) {
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
