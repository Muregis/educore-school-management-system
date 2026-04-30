import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const HR_ROLES = ["admin", "hr", "director", "superadmin"];

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return Boolean(error) && (
    error.code === "PGRST204" ||
    message.includes("column") ||
    message.includes("schema cache")
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAFF RECORDS
// ═══════════════════════════════════════════════════════════════════
router.get("/staff", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: rows, error } = await supabase
      .from('hr_staff')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('department')
      .order('full_name');
    if (error) throw error;
    res.json(rows || []);
  } catch (err) { next(err); }
});

router.post("/staff", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { fullName, email, phone, department, jobTitle, contractType, startDate, salary, status, nationalId, notes } = req.body;
    if (!fullName || !jobTitle) return res.status(400).json({ message: "fullName and jobTitle are required" });
    const { data: inserted, error: insertError } = await supabase
      .from('hr_staff')
      .insert({
        school_id: schoolId,
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        department: department || 'Academic',
        job_title: jobTitle,
        contract_type: contractType || 'Permanent',
        start_date: startDate || null,
        salary: salary || 0,
        status: status || 'active',
        national_id: nationalId || null,
        notes: notes || null
      })
      .select('staff_id')
      .single();
    if (insertError) throw insertError;

    // Sync to teachers table if job title indicates teacher OR department is Academic
    const isTeacherRole = jobTitle && /teacher|tutor|instructor|lecturer/i.test(jobTitle);
    const isAcademicDept = department && /academic/i.test(department);
    if (isTeacherRole || isAcademicDept) {
      try {
        await supabase.from('teachers').upsert({
          school_id: schoolId,
          first_name: fullName.split(' ')[0] || fullName,
          last_name: fullName.split(' ').slice(1).join(' ') || '',
          email: email || null,
          phone: phone || null,
          department: department || 'Academic',
          qualification: jobTitle,
          status: status || 'active',
          hire_date: startDate || null,
          staff_id: inserted.staff_id
        }, { onConflict: 'school_id,email' });
      } catch (e) {
        // Teacher sync failed, but staff was created successfully
        console.log('Teacher sync failed:', e.message);
      }
    }
    const { data: row, error: selectError } = await supabase
      .from('hr_staff')
      .select('*')
      .eq('staff_id', inserted.staff_id)
      .eq('school_id', schoolId)
      .single();
    if (selectError) throw selectError;
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put("/staff/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { fullName, email, phone, department, jobTitle, contractType, startDate, salary, status, nationalId, notes } = req.body;
    const { data: updated, error } = await supabase
      .from('hr_staff')
      .update({
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        department,
        job_title: jobTitle,
        contract_type: contractType,
        start_date: startDate || null,
        salary: salary || 0,
        status,
        national_id: nationalId || null,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('staff_id', req.params.id)
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .select('staff_id, email')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Staff not found" });

    // Sync updates to teachers table if academic department or teacher role
    const isTeacherRole = jobTitle && /teacher|tutor|instructor|lecturer/i.test(jobTitle);
    const isAcademicDept = department && /academic/i.test(department);
    if ((isTeacherRole || isAcademicDept) && email) {
      try {
        await supabase.from('teachers').upsert({
          school_id: schoolId,
          first_name: fullName?.split(' ')[0] || fullName,
          last_name: fullName?.split(' ').slice(1).join(' ') || '',
          email: email,
          phone: phone || null,
          department: department || 'Academic',
          qualification: jobTitle,
          status: status || 'active',
          hire_date: startDate || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'school_id,email' });
      } catch (e) {
        console.log('Teacher sync on update failed:', e.message);
      }
    }

    res.json({ updated: true });
  } catch (err) { next(err); }
});

router.delete("/staff/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { error } = await supabase
      .from('hr_staff')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('staff_id', req.params.id)
      .eq('school_id', schoolId);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// LEAVE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
router.get("/leave", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: leaves, error: leaveError } = await supabase
      .from('hr_leave')
      .select('*, hr_staff(full_name, department, job_title)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (leaveError) throw leaveError;
    const rows = (leaves || []).map(l => ({
      ...l,
      staff_name: l.hr_staff?.full_name,
      department: l.hr_staff?.department,
      job_title: l.hr_staff?.job_title,
      hr_staff: undefined
    }));
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/leave", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { staffId, leaveType, fromDate, toDate, reason } = req.body;
    if (!staffId || !fromDate || !toDate)
      return res.status(400).json({ message: "staffId, fromDate, toDate are required" });
    const { data: inserted, error } = await supabase
      .from('hr_leave')
      .insert({
        school_id: schoolId,
        staff_id: staffId,
        leave_type: leaveType || 'Annual',
        from_date: fromDate,
        to_date: toDate,
        reason: reason || null,
        status: 'pending'
      })
      .select('leave_id')
      .single();
    if (error) throw error;
    res.status(201).json({ leaveId: inserted.leave_id });
  } catch (err) { next(err); }
});

router.patch("/leave/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.body;
    if (!["approved","rejected","pending"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const { error: updateError } = await supabase
      .from('hr_leave')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('leave_id', req.params.id)
      .eq('school_id', schoolId);
    if (updateError) throw updateError;
    // If approved — update staff status to on-leave
    if (status === "approved") {
      const { data: leave, error: fetchError } = await supabase
        .from('hr_leave')
        .select('staff_id')
        .eq('leave_id', req.params.id)
        .single();
      if (!fetchError && leave) {
        await supabase
          .from('hr_staff')
          .update({ status: 'on-leave' })
          .eq('staff_id', leave.staff_id)
          .eq('school_id', schoolId);
      }
    }
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// STAFF ATTENDANCE
// ═══════════════════════════════════════════════════════════════════
router.get("/attendance", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { date, from, to, staffId, department } = req.query;

    let query = supabase
      .from('hr_attendance')
      .select('*, hr_staff(full_name, department, job_title)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (staffId) query = query.eq('staff_id', staffId);
    if (date) query = query.eq('attendance_date', date);
    if (from) query = query.gte('attendance_date', from);
    if (to) query = query.lte('attendance_date', to);

    const { data: attendance, error } = await query.order('attendance_date', { ascending: false });
    if (error) throw error;

    // Filter by department in memory if needed (since it's on the joined table)
    let rows = attendance || [];
    if (department) {
      rows = rows.filter(a => a.hr_staff?.department === department);
    }

    // Flatten the joined data
    rows = rows.map(a => ({
      ...a,
      staff_name: a.hr_staff?.full_name,
      department: a.hr_staff?.department,
      job_title: a.hr_staff?.job_title,
      hr_staff: undefined
    }));

    res.json(rows);
  } catch (err) { next(err); }
});

// Bulk staff attendance save
router.post("/attendance/bulk", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || !records.length)
      return res.status(400).json({ message: "date and records array are required" });

    const { error: deleteError } = await supabase
      .from('hr_attendance')
      .delete()
      .eq('school_id', schoolId)
      .eq('attendance_date', date);
    if (deleteError) throw deleteError;

    const insertData = records.map(r => ({
      school_id: schoolId,
      staff_id: r.staffId,
      attendance_date: date,
      check_in: r.checkIn || null,
      check_out: r.checkOut || null,
      status: r.status || 'present',
      notes: r.notes || null,
      marked_by: userId
    }));

    const { error: insertError } = await supabase
      .from('hr_attendance')
      .insert(insertData);
    if (insertError) throw insertError;

    res.status(201).json({ saved: records.length });
  } catch (err) { next(err); }
});

// Single staff attendance
router.post("/attendance", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { staffId, date, checkIn, checkOut, status = "present", notes } = req.body;
    if (!staffId || !date) return res.status(400).json({ message: "staffId and date are required" });

    const { error } = await supabase
      .from('hr_attendance')
      .upsert({
        school_id: schoolId,
        staff_id: staffId,
        attendance_date: date,
        check_in: checkIn || null,
        check_out: checkOut || null,
        status,
        notes: notes || null,
        marked_by: userId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'school_id,staff_id,attendance_date' });

    if (error) throw error;
    res.status(201).json({ saved: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// PAYROLL & PAYSLIPS
// ═══════════════════════════════════════════════════════════════════
router.get("/payslips", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year, staffId } = req.query;

    let query = supabase
      .from('hr_payslips')
      .select('*, hr_staff(full_name, department, job_title, national_id)')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    if (month) query = query.eq('month', month);
    if (year) query = query.eq('year', year);
    if (staffId) query = query.eq('staff_id', staffId);

    const { data: payslips, error } = await query
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;

    const rows = (payslips || []).map(p => ({
      ...p,
      staff_name: p.hr_staff?.full_name,
      department: p.hr_staff?.department,
      job_title: p.hr_staff?.job_title,
      national_id: p.hr_staff?.national_id,
      hr_staff: undefined
    }));

    res.json(rows);
  } catch (err) { next(err); }
});

// Generate payslips for all active staff for a given month/year
router.post("/payslips/generate", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { month, year, allowances = 0, notes } = req.body;
    if (!month || !year) return res.status(400).json({ message: "month and year are required" });

    const { data: activeStaff, error: staffError } = await supabase
      .from('hr_staff')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');

    if (staffError) throw staffError;

    let generated = 0;
    for (const s of activeStaff || []) {
      const basic    = Number(s.salary) || 0;
      const allow    = Number(allowances) || 0;
      // Simplified KE statutory deductions
      const paye     = basic > 24000 ? Math.round((basic - 24000) * 0.1) : 0;
      const nhif     = basic > 100000 ? 1700 : basic > 50000 ? 1500 : basic > 20000 ? 900 : 500;
      const nssf     = Math.min(Math.round(basic * 0.06), 2160);
      const deduct   = paye + nhif + nssf;
      const netPay   = basic + allow - deduct;

      const { error: upsertError } = await supabase
        .from('hr_payslips')
        .upsert({
          school_id: schoolId,
          staff_id: s.staff_id,
          month,
          year,
          basic_salary: basic,
          allowances: allow,
          deductions: deduct,
          net_pay: netPay,
          paye,
          nhif,
          nssf,
          notes: notes || null,
          status: 'draft',
          generated_by: userId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'school_id,staff_id,month,year' });

      if (upsertError) console.error('Payslip upsert error:', upsertError);
      else generated++;
    }
    res.status(201).json({ generated });
  } catch (err) { next(err); }
});

// Approve all payslips for a month
router.patch("/payslips/approve", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year } = req.body;
    const { error } = await supabase
      .from('hr_payslips')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('month', month)
      .eq('year', year)
      .eq('status', 'draft')
      .eq('is_deleted', false);
    if (error) throw error;
    res.json({ approved: true });
  } catch (err) { next(err); }
});

// Mark payslips as paid for a month (supports professional payment recording)
router.patch("/payslips/mark-paid", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year, staffIds, paymentMethod, paymentReference } = req.body;

    let query = supabase
      .from('hr_payslips')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString().slice(0, 10),
        payment_method: paymentMethod || 'Cash',
        payment_reference: paymentReference || null,
        updated_at: new Date().toISOString()
      })
      .eq('school_id', schoolId)
      .eq('month', month)
      .eq('year', year)
      .eq('status', 'approved')
      .eq('is_deleted', false);

    if (staffIds && Array.isArray(staffIds)) {
      query = query.in('staff_id', staffIds);
    }

    const { error } = await query;
    if (error) throw error;
    res.json({ paid: true });
  } catch (err) { next(err); }
});

// Single payslip update (allowances/notes override)
router.put("/payslips/:id", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { allowances, deductions, notes, status } = req.body;
    const { data: p, error: fetchError } = await supabase
      .from('hr_payslips')
      .select('*')
      .eq('payslip_id', req.params.id)
      .eq('school_id', schoolId)
      .single();

    if (fetchError || !p) return res.status(404).json({ message: "Payslip not found" });

    const allow  = allowances !== undefined ? Number(allowances) : Number(p.allowances);
    const deduct = deductions !== undefined ? Number(deductions) : Number(p.deductions);
    const net    = Number(p.basic_salary) + allow - deduct;

    const { error: updateError } = await supabase
      .from('hr_payslips')
      .update({
        allowances: allow,
        deductions: deduct,
        net_pay: net,
        notes: notes || p.notes,
        status: status || p.status,
        updated_at: new Date().toISOString()
      })
      .eq('payslip_id', req.params.id)
      .eq('school_id', schoolId);

    if (updateError) throw updateError;
    res.json({ updated: true });
  } catch (err) { next(err); }
});

// Export payroll as CSV for tax filing
router.get("/payslips/export", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year } = req.query;

    const { data: payslips, error } = await supabase
      .from('hr_payslips')
      .select('*, hr_staff(full_name, national_id, pin_number, krapin)') // Include KRA PIN if available
      .eq('school_id', schoolId)
      .eq('month', month)
      .eq('year', year)
      .eq('is_deleted', false);

    if (error) throw error;

    // Build CSV
    const headers = [
      "Staff Name", "ID Number", "KRA PIN", "Month", "Year", 
      "Basic Salary", "Allowances", "Gross Pay", 
      "PAYE", "NHIF", "NSSF", "Total Deductions", "Net Pay", 
      "Status", "Paid Date", "Payment Method", "Reference"
    ];

    const rows = (payslips || []).map(p => {
      const gross = Number(p.basic_salary) + Number(p.allowances);
      const deductions = Number(p.deductions);
      return [
        p.hr_staff?.full_name,
        p.hr_staff?.national_id || "",
        p.hr_staff?.krapin || p.hr_staff?.pin_number || "",
        p.month,
        p.year,
        p.basic_salary,
        p.allowances,
        gross,
        p.paye,
        p.nhif,
        p.nssf,
        deductions,
        p.net_pay,
        p.status,
        p.paid_date || "",
        p.payment_method || "",
        p.payment_reference || ""
      ].map(v => `"${v}"`).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll_${year}_${month}.csv`);
    res.send(csv);

  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════
// BULK SYNC & TRANSFERS
// ═══════════════════════════════════════════════════════════════════

// Sync all staff matching teacher titles to the teachers table
router.post("/sync-teachers", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { data: staff, error: staffError } = await supabase
      .from('hr_staff')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false)
      .eq('status', 'active');
    
    if (staffError) throw staffError;

    const teacherRegex = /teacher|tutor|instructor|lecturer/i;
    const teachersToSync = staff.filter(s => teacherRegex.test(s.job_title || s.department || ""));
    
    let synced = 0;
    for (const s of teachersToSync) {
      const firstName = s.full_name.split(' ')[0] || s.full_name;
      const lastName = s.full_name.split(' ').slice(1).join(' ') || '';
      const teacherEmail = s.email || `hr-teacher-${s.staff_id}@local.invalid`;
      
      let { error: upsertError } = await supabase
        .from('teachers')
        .upsert({
          school_id: schoolId,
          first_name: firstName,
          last_name: lastName,
          email: teacherEmail,
          phone: s.phone || null,
          staff_number: s.staff_number || `HR-${s.staff_id}`,
          national_id: s.national_id || null,
          qualification: s.job_title,
          status: s.status,
          hire_date: s.start_date || null,
          department: s.department || null,
        }, { onConflict: 'school_id,email' }); 

      if (upsertError && isMissingColumnError(upsertError)) {
        ({ error: upsertError } = await supabase
          .from('teachers')
          .upsert({
            school_id: schoolId,
            first_name: firstName,
            last_name: lastName,
            email: teacherEmail,
            phone: s.phone || null,
            qualification: s.job_title || s.department || 'Teacher',
            status: s.status || 'active',
          }, { onConflict: 'school_id,email' }));
      }
      
      if (!upsertError) synced++;
      else console.error(`Sync error for ${s.full_name}:`, upsertError.message);
    }
    
    res.json({ synced });
  } catch (err) { next(err); }
});

// Transfer staff member to another branch
router.post("/transfer", requireRoles("director", "superadmin"), async (req, res, next) => {
  try {
    const { staffId, toSchoolId } = req.body;
    if (!staffId || !toSchoolId) return res.status(400).json({ message: "staffId and toSchoolId are required" });

    // 1. Get staff details
    const { data: s, error: fetchError } = await supabase
      .from('hr_staff')
      .select('*')
      .eq('staff_id', staffId)
      .single();

    if (fetchError || !s) return res.status(404).json({ message: "Staff not found" });

    // 2. Update hr_staff
    const { error: staffUpdateError } = await supabase
      .from('hr_staff')
      .update({ school_id: toSchoolId, updated_at: new Date().toISOString() })
      .eq('staff_id', staffId);
    if (staffUpdateError) throw staffUpdateError;

    // 3. Update teachers
    await supabase
      .from('teachers')
      .update({ school_id: toSchoolId, updated_at: new Date().toISOString() })
      .eq('staff_id', staffId);
    
    // 4. Update users (if email exists)
    if (s.email) {
      await supabase
        .from('users')
        .update({ school_id: toSchoolId, updated_at: new Date().toISOString() })
        .eq('email', s.email);
    }

    res.json({ success: true, message: `Staff transferred to school ${toSchoolId}` });
  } catch (err) { next(err); }
});

export default router;
