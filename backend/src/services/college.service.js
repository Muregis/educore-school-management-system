import { supabase } from "../config/supabaseClient.js";
import { database } from "./db.js";

// Department services

export const departmentService = {
  list: async (schoolId, options = {}) => {
    const { status } = options;
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
    return data || [];
  },

  get: async (schoolId, departmentId) => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('department_id', departmentId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return null;
    return data;
  },

  create: async (schoolId, { name, code, description }) => {
    // Check for duplicate code
    const { data: existing, error: checkError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('school_id', schoolId)
      .eq('code', code)
      .eq('is_deleted', false)
      .single();

    if (existing && !checkError) {
      throw new Error("Department code already exists in this college");
    }

    const { data, error } = await supabase
      .from('departments')
      .insert({ school_id: schoolId, name, code, description })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (schoolId, departmentId, { name, code, description }) => {
    const { error } = await supabase
      .from('departments')
      .update({ name, code, description })
      .eq('department_id', departmentId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  },

  deactivate: async (schoolId, departmentId) => {
    const { error } = await supabase
      .from('departments')
      .update({ is_deleted: true })
      .eq('department_id', departmentId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  }
};

// Program services

export const programService = {
  list: async (schoolId, options = {}) => {
    const { status, departmentId } = options;
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
    return data || [];
  },

  get: async (schoolId, programId) => {
    const { data, error } = await supabase
      .from('programs')
      .select(`
        *,
        departments (
          department_id,
          name
        )
      `)
      .eq('program_id', programId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return null;
    return data;
  },

  create: async (schoolId, { name, code, departmentId }) => {
    // Verify department belongs to same tenant
    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('department_id')
      .eq('department_id', departmentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (deptError || !dept) {
      throw new Error("Invalid department or department not found in this college");
    }

    // Check for duplicate code
    const { data: existing, error: checkError } = await supabase
      .from('programs')
      .select('program_id')
      .eq('school_id', schoolId)
      .eq('code', code)
      .eq('is_deleted', false)
      .single();

    if (existing && !checkError) {
      throw new Error("Program code already exists in this college");
    }

    const { data, error } = await supabase
      .from('programs')
      .insert({ school_id: schoolId, department_id: departmentId, name, code })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (schoolId, programId, { name, code, departmentId }) => {
    const { error } = await supabase
      .from('programs')
      .update({ name, code, department_id: departmentId })
      .eq('program_id', programId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  },

  deactivate: async (schoolId, programId) => {
    const { error } = await supabase
      .from('programs')
      .update({ is_deleted: true })
      .eq('program_id', programId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  }
};

// Unit services

export const unitService = {
  list: async (schoolId, options = {}) => {
    const { status, programId } = options;
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
    return data || [];
  },

  get: async (schoolId, unitId) => {
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
      .eq('unit_id', unitId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return null;
    return data;
  },

  create: async (schoolId, { title, code, programId, departmentId }) => {
    // Verify program belongs to same tenant
    const { data: prog, error: progError } = await supabase
      .from('programs')
      .select('program_id')
      .eq('program_id', programId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (progError || !prog) {
      throw new Error("Invalid program or program not found in this college");
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
      throw new Error("Invalid department or department not found in this college");
    }

    // Check for duplicate code
    const { data: existing, error: checkError } = await supabase
      .from('units')
      .select('unit_id')
      .eq('school_id', schoolId)
      .eq('code', code)
      .eq('is_deleted', false)
      .single();

    if (existing && !checkError) {
      throw new Error("Unit code already exists in this college");
    }

    const { data, error } = await supabase
      .from('units')
      .insert({ school_id: schoolId, program_id: programId, department_id: departmentId, code, title })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (schoolId, unitId, { title, code, programId, departmentId }) => {
    const { error } = await supabase
      .from('units')
      .update({ title, code, program_id: programId, department_id: departmentId })
      .eq('unit_id', unitId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  },

  deactivate: async (schoolId, unitId) => {
    const { error } = await supabase
      .from('units')
      .update({ is_deleted: true })
      .eq('unit_id', unitId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  }
};

// Student program enrollment services

export const enrollmentService = {
  list: async (schoolId, options = {}) => {
    const { status, studentId, programId } = options;
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
          name,
          department_id
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
    return data || [];
  },

  get: async (schoolId, enrollmentId) => {
    const { data, error } = await supabase
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
          name,
          department_id
        )
      `)
      .eq('enrollment_id', enrollmentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) return null;
    return data;
  },

  create: async (schoolId, { studentId, programId, academicYear, enrollmentDate }) => {
    // Verify student exists in same tenant
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentError || !student) {
      throw new Error("Invalid student or student not found in this college");
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
      throw new Error("Invalid program or program not found in this college");
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
      throw new Error("Student already enrolled in this program for the academic year");
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
    return data;
  },

  getStudentEnrollments: async (schoolId, studentId) => {
    // Verify student belongs to same tenant
    const { data: studentCheck, error: studentCheckError } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .single();

    if (studentCheckError || !studentCheck) {
      throw new Error("Student not found in this college");
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
    return data || [];
  },

  updateStatus: async (schoolId, enrollmentId, status) => {
    const { error } = await supabase
      .from('student_program_enrollments')
      .update({ status })
      .eq('enrollment_id', enrollmentId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  },

  withdraw: async (schoolId, enrollmentId) => {
    const { error } = await supabase
      .from('student_program_enrollments')
      .update({ is_deleted: true, status: 'withdrawn' })
      .eq('enrollment_id', enrollmentId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return true;
  }
};