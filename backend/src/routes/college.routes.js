import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { tenantSecurityCheck } from "../middleware/tenantSecurityCheck.js";
import { requireRoles, requireDirector } from "../middleware/roles.js";
import { authorize } from "../middleware/permissions.js";

const router = Router();
router.use(authRequired);
router.use(tenantContext);
router.use(tenantSecurityCheck);

router.use("/api/college/departments", departmentRoutes);
router.use("/api/college/programs", programRoutes);
router.use("/api/college/units", unitRoutes);
router.use("/api/college/enrollments", enrollmentRoutes);

export default router;

// ─── Departments ────────────────────────────────────────────────────────────
const departmentRouter = Router();
departmentRouter.use(authRequired);
departmentRouter.use(tenantContext);
departmentRouter.use(tenantSecurityCheck);

departmentRouter.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.query;

    let query = supabase
      .from('departments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

departmentRouter.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ message: "Name and code are required" });
    }

    // Check for duplicate code within tenant
    const { data: existing, error: checkError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('school_id', schoolId)
      .eq('code', code)
      .eq('is_deleted', false)
      .single();

    if (existing && !checkError) {
      return res.status(409).json({ message: "Department code already exists in this college" });
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({ school_id: schoolId, name, code, description })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

departmentRouter.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('department_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Department not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

departmentRouter.put("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, code, description } = req.body;

    const { error } = await supabase
      .from('departments')
      .update({ name, code, description })
      .eq('department_id', req.params.id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Department updated successfully" });
  } catch (err) {
    next(err);
  }
});

departmentRouter.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error } = await supabase
      .from('departments')
      .update({ is_deleted: true })
      .eq('department_id', req.params.id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Department deactivated successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── Programs ───────────────────────────────────────────────────────────────
const programRouter = Router();
programRouter.use(authRequired);
programRouter.use(tenantContext);
programRouter.use(tenantSecurityCheck);

programRouter.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, departmentId } = req.query;

    let query = supabase
      .from('programs')
      .select(`
        *,
        departments (
          department_id,
          name
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

programRouter.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, code, departmentId } = req.body;

    if (!name || !code || !departmentId) {
      return res.status(400).json({ message: "Name, code, and departmentId are required" });
    }

    // Verify department belongs to same tenant
    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('department_id', departmentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (deptError || !dept) {
      return res.status(400).json({ message: "Invalid department or department not found in this college" });
    }

    // Check for duplicate code within tenant
    const { data: existing, error: checkError } = await supabase
      .from('programs')
      .select('program_id')
      .eq('school_id', schoolId)
      .eq('code', code)
      .eq('is_deleted', false)
      .single();

    if (existing && !checkError) {
      return res.status(409).json({ message: "Program code already exists in this college" });
    }

    const { data, error } = await supabase
      .from('programs')
      .insert({ school_id: schoolId, department_id: departmentId, name, code })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

programRouter.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        departments (
          department_id,
          name
        )
      `)
      .eq('program_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Program not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

programRouter.put("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { name, code, departmentId } = req.body;

    const { error } = await supabase
      .from('programs')
      .update({ name, code, department_id: departmentId })
      .eq('program_id', req.params.id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Program updated successfully" });
  } catch (err) {
    next(err);
  }
});

programRouter.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error } = await supabase
      .from('programs')
      .update({ is_deleted: true })
      .eq('program_id', req.params.id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Program deactivated successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── Units ─────────────────────────────────────────────────────────────────
const unitRouter = Router();
unitRouter.use(authRequired);
unitRouter.use(tenantContext);
unitRouter.use(tenantSecurityCheck);

unitRouter.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, programId } = req.query;

    let query = supabase
      .from('units')
      .select(`
        *,
        programs (
          program_id,
          name
        ),
        departments (
          department_id,
          name
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (programId) {
      query = query.eq('program_id', programId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('title');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

unitRouter.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, code, programId, departmentId } = req.body;

    if (!title || !code || !programId || !departmentId) {
      return res.status(400).json({ message: "Title, code, programId, and departmentId are required" });
    }

    // Verify program belongs to same tenant
    const { data: prog, error: progError } = await supabase
      .from('programs')
      .select('program_id')
      .eq('program_id', programId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (progError || !prog) {
      return res.status(400).json({ message: "Invalid program or program not found in this college" });
    }

    // Verify department belongs to same tenant
    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('department_id', departmentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (deptError || !dept) {
      return res.status(400).json({ message: "Invalid department or department not found in this college" });
    }

    // Check for duplicate code within tenant
    const { data: existing, error: checkError } = await supabase
      .from('units')
      .select('unit_id')
      .eq('school_id', schoolId)
      .eq('code', code)
      .eq('is_deleted', false)
      .single();

    if (existing && !checkError) {
      return res.status(409).json({ message: "Unit code already exists in this college" });
    }

    const { data, error } = await supabase
      .from('units')
      .insert({ school_id: schoolId, program_id: programId, department_id: departmentId, code, title })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

unitRouter.get("/:id", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data, error } = await supabase
      .from('units')
      .select(`
        *,
        programs (
          program_id,
          name
        ),
        departments (
          department_id,
          name
        )
      `)
      .eq('unit_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Unit not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

unitRouter.put("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { title, code, programId, departmentId } = req.body;

    const { error } = await supabase
      .from('units')
      .update({ title, code, program_id: programId, department_id: departmentId })
      .eq('unit_id', req.params.id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Unit updated successfully" });
  } catch (err) {
    next(err);
  }
});

unitRouter.delete("/:id", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error } = await supabase
      .from('units')
      .update({ is_deleted: true })
      .eq('unit_id', req.params.id)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Unit deactivated successfully" });
  } catch (err) {
    next(err);
  }
});

// ─── Student Program Enrollments ───────────────────────────────────────────
const enrollmentRouter = Router();
enrollmentRouter.use(authRequired);
enrollmentRouter.use(tenantContext);
enrollmentRouter.use(tenantSecurityCheck);

enrollmentRouter.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status, studentId, programId } = req.query;

    let query = supabase
      .from('student_program_enrollments')
      .select(`
        *,
        students (
          student_id,
          first_name,
          last_name,
          admission_number
        ),
        programs (
          program_id,
          name
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (status) {
      query = query.eq('status', status);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (programId) {
      query = query.eq('program_id', programId);
    }

    const { data, error } = await query.order('enrollment_date', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

enrollmentRouter.post("/", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, programId, academicYear, enrollmentDate } = req.body;

    if (!studentId || !programId || !academicYear) {
      return res.status(400).json({ message: "studentId, programId, and academicYear are required" });
    }

    // Verify student exists in same tenant
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) {
      return res.status(400).json({ message: "Invalid student or student not found in this college" });
    }

    // Verify program belongs to same tenant
    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('program_id')
      .eq('program_id', programId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (programError || !program) {
      return res.status(400).json({ message: "Invalid program or program not found in this college" });
    }

    // Check for duplicate active enrollment
    const { data: existing, error: checkError } = await supabase
      .from('student_program_enrollments')
      .select('enrollment_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('program_id', programId)
      .eq('academic_year', academicYear)
      .eq('status', 'enrolled')
      .single();

    if (existing && !checkError) {
      return res.status(409).json({ message: "Student already enrolled in this program for the academic year" });
    }

    const { data, error } = await supabase
      .from('student_program_enrollments')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        program_id: programId,
        academic_year: academicYear,
        enrollment_date: enrollmentDate || new Date().toISOString().split('T')[0],
        status: 'enrolled'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

enrollmentRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;

    // Verify student belongs to same tenant
    const { data: studentCheck, error: studentCheckError } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentCheckError || !studentCheck) {
      return res.status(404).json({ message: "Student not found in this college" });
    }

    const { data, error } = await supabase
      .from('student_program_enrollments')
      .select(`
        *,
        programs (
          program_id,
          name,
          department_id
        )
      `)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_deleted', false)
      .order('enrollment_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

enrollmentRouter.put("/:enrollmentId", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;

    const { error } = await supabase
      .from('student_program_enrollments')
      .update({ status })
      .eq('enrollment_id', req.params.enrollmentId)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Enrollment updated successfully" });
  } catch (err) {
    next(err);
  }
});

enrollmentRouter.delete("/:enrollmentId", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { error } = await supabase
      .from('student_program_enrollments')
      .update({ is_deleted: true, status: 'withdrawn' })
      .eq('enrollment_id', req.params.enrollmentId)
      .eq('school_id', schoolId);

    if (error) throw error;
    res.json({ message: "Enrollment withdrawn successfully" });
  } catch (err) {
    next(err);
  }
});