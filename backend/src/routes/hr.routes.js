import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const HR_ROLES = ["admin", "hr", "director", "superadmin"];

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

    // Sync to teachers table if job title indicates teacher
    if (jobTitle && /teacher|tutor|instructor|lecturer/i.test(jobTitle)) {
      try {
        await supabase.from('teachers').insert({
          school_id: schoolId,
          first_name: fullName.split(' ')[0] || fullName,
          last_name: fullName.split(' ').slice(1).join(' ') || '',
          email: email || null,
          phone: phone || null,
          subject: department || 'General',
          qualification: jobTitle,
          status: status || 'active',
          staff_id: inserted.staff_id
        });
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
      .select('staff_id')
      .single();
    if (error) throw error;
    if (!updated) return res.status(404).json({ message: "Staff not found" });
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

// Mark payslips as paid for a month
router.patch("/payslips/mark-paid", requireRoles(...HR_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { month, year } = req.body;
    const { error } = await supabase
      .from('hr_payslips')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString()
      })
      .eq('school_id', schoolId)
      .eq('month', month)
      .eq('year', year)
      .eq('status', 'approved')
      .eq('is_deleted', false);
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

export default router;