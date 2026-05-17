import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { authRequired } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { logActivity } from '../helpers/activity.logger.js';

const router = Router();
router.use(authRequired);

// Default discount percentages
const DEFAULT_CONFIGS = [
  { discount_type: 'sibling_2nd', discount_value: 10 },
  { discount_type: 'sibling_3rd', discount_value: 20 },
  { discount_type: 'sibling_4th_plus', discount_value: 30 },
  { discount_type: 'staff_child', discount_value: 50 },
  { discount_type: 'scholarship', discount_value: 100 },
  { discount_type: 'bursary', discount_value: 50 },
];

const DISCOUNT_LABELS = {
  sibling_2nd: 'Sibling (2nd child)',
  sibling_3rd: 'Sibling (3rd child)',
  sibling_4th_plus: 'Sibling (4th+ child)',
  staff_child: 'Staff Child',
  scholarship: 'Scholarship',
  bursary: 'Bursary',
  custom: 'Custom Discount'
};

// GET /api/discounts/config
// Get school discount configuration
router.get('/config', async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    let { data: configs } = await supabase
      .from('discount_configs')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    // If no configs exist yet seed defaults, or update any that are 0%
    if (!configs || configs.length === 0) {
      const defaults = DEFAULT_CONFIGS.map(c => ({
        ...c,
        school_id: schoolId
      }));

      const { data: seeded } = await supabase
        .from('discount_configs')
        .insert(defaults)
        .select('*');

      configs = seeded;
    } else {
      // Update any configs that have 0% when they should have default values
      for (const config of configs) {
        const defaultConfig = DEFAULT_CONFIGS.find(d => d.discount_type === config.discount_type);
        if (defaultConfig && config.discount_value === 0) {
          await supabase
            .from('discount_configs')
            .update({ discount_value: defaultConfig.discount_value })
            .eq('config_id', config.config_id);
          config.discount_value = defaultConfig.discount_value;
        }
      }
    }

    // Add labels
    const configsWithLabels = configs?.map(c => ({
      ...c,
      label: DISCOUNT_LABELS[c.discount_type] || c.discount_type
    })) || [];

    res.json(configsWithLabels);
  } catch (err) { next(err); }
});

// PATCH /api/discounts/config
// Update discount percentages
router.patch('/config', requireRoles('director', 'superadmin'), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { configs } = req.body;

    if (!configs || !Array.isArray(configs)) {
      return res.status(400).json({ message: 'configs array required' });
    }

    for (const config of configs) {
      await supabase
        .from('discount_configs')
        .upsert({
          school_id: schoolId,
          discount_type: config.discount_type,
          discount_value: config.discount_value,
          is_active: true,
          created_by: userId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'school_id,discount_type' });
    }

    // Log activity
    await logActivity(req, 'UPDATE_DISCOUNT_CONFIG', `Updated discount configuration`, { schoolId });

    res.json({
      success: true,
      message: 'Discount configuration updated'
    });
  } catch (err) { next(err); }
});

// GET /api/discounts/detect/:studentId
// Auto-detect what discounts a student qualifies for
router.get('/detect/:studentId', requireRoles('finance', 'director', 'superadmin', 'admin'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const qualifies = [];

    // Get student details
    const { data: student } = await supabase
      .from('students')
      .select('student_id, first_name, last_name, parent_phone, parent_name')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .single();

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get discount configs
    const { data: configs } = await supabase
      .from('discount_configs')
      .select('discount_type, discount_value')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const configMap = {};
    configs?.forEach(c => {
      configMap[c.discount_type] = c.discount_value;
    });

    // CHECK 1 — Sibling discount
    if (student.parent_phone) {
      const { data: siblings } = await supabase
        .from('students')
        .select('student_id, first_name, last_name')
        .eq('school_id', schoolId)
        .eq('parent_phone', student.parent_phone)
        .eq('is_deleted', false)
        .neq('student_id', studentId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (siblings && siblings.length > 0) {
        // Count total children from same parent
        const totalChildren = siblings.length + 1;

        let siblingType = null;
        let siblingDiscount = 0;

        // Determine which discount applies based on birth order (oldest first)
        // Student position is determined by when they were added (created_at)
        const allSiblings = [
          ...siblings,
          { student_id: student.student_id, first_name: student.first_name, last_name: student.last_name }
        ];

        // Find this student's position (1-indexed)
        const numericStudentId = parseInt(studentId, 10);
        if (isNaN(numericStudentId)) {
          return res.status(400).json({ message: 'Invalid student ID' });
        }
        const studentPosition = allSiblings.findIndex(s => s.student_id === numericStudentId) + 1;

        if (studentPosition === 2) {
          siblingType = 'sibling_2nd';
          siblingDiscount = configMap['sibling_2nd'] || 0;
        } else if (studentPosition === 3) {
          siblingType = 'sibling_3rd';
          siblingDiscount = configMap['sibling_3rd'] || 0;
        } else if (studentPosition >= 4) {
          siblingType = 'sibling_4th_plus';
          siblingDiscount = configMap['sibling_4th_plus'] || 0;
        }

        if (siblingType) {
          qualifies.push({
            type: siblingType,
            discountPercent: siblingDiscount,
            label: DISCOUNT_LABELS[siblingType],
            reason: `Sibling discount — ${totalChildren} children from same family`,
            siblings: siblings.map(s => `${s.first_name} ${s.last_name}`),
            position: studentPosition
          });
        }
      }
    }

    // CHECK 2 — Staff child discount
    if (student.parent_phone) {
      // Check if parent is staff (match by phone)
      const { data: staffMatch } = await supabase
        .from('hr_staff')
        .select('staff_id, full_name, job_title, phone')
        .eq('school_id', schoolId)
        .eq('phone', student.parent_phone)
        .eq('is_deleted', false)
        .single();

      if (staffMatch) {
        qualifies.push({
          type: 'staff_child',
          discountPercent: configMap['staff_child'] || 0,
          label: DISCOUNT_LABELS['staff_child'],
          reason: `Staff child — Parent: ${staffMatch.full_name} (${staffMatch.job_title})`,
          staffMember: staffMatch.full_name,
          staffPhone: staffMatch.phone
        });
      }
    }

    // CHECK 3 — Existing manual discounts
    const { data: existing } = await supabase
      .from('student_discounts')
      .select('discount_id, discount_type, discount_value, reason, expires_at, approved_at, is_active')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString().split('T')[0]) // Not expired
      .or('expires_at.is.null');

    res.json({
      student: {
        studentId: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        parentPhone: student.parent_phone
      },
      qualifies,
      existingDiscounts: existing || [],
      hasDiscounts: qualifies.length > 0 || (existing && existing.length > 0)
    });

  } catch (err) { next(err); }
});

// POST /api/discounts/apply
// Apply discount to a student
router.post('/apply', requireRoles('finance', 'director', 'superadmin'), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const {
      studentId,
      discountType,
      discountValue,
      reason,
      expiresAt
    } = req.body;

    if (!studentId || !discountType || discountValue === undefined) {
      return res.status(400).json({
        message: 'studentId, discountType and discountValue required'
      });
    }

    // Deactivate existing discount of same type for this student
    await supabase
      .from('student_discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('discount_type', discountType);

    // Apply new discount
    const { data, error } = await supabase
      .from('student_discounts')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        discount_type: discountType,
        discount_value: discountValue,
        reason: reason || DISCOUNT_LABELS[discountType] || null,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        expires_at: expiresAt || null,
        is_active: true
      })
      .select('discount_id')
      .single();

    if (error) throw error;

    // Log activity
    await logActivity(req, 'APPLY_DISCOUNT', `Applied ${discountValue}% ${discountType} discount to student ${studentId}`, { schoolId, studentId });

    res.status(201).json({
      success: true,
      discountId: data.discount_id,
      message: `${discountValue}% ${DISCOUNT_LABELS[discountType] || discountType} discount applied successfully`
    });

  } catch (err) { next(err); }
});

// POST /api/discounts/remove
// Remove a discount from a student
router.post('/remove', requireRoles('director', 'superadmin'), async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { studentId, discountType } = req.body;

    if (!studentId || !discountType) {
      return res.status(400).json({ message: 'studentId and discountType required' });
    }

    const { data: removed } = await supabase
      .from('student_discounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('discount_type', discountType)
      .select('discount_id')
      .single();

    if (!removed) {
      return res.status(404).json({ message: 'Discount not found' });
    }

    // Log activity
    await logActivity(req, 'REMOVE_DISCOUNT', `Removed ${discountType} discount from student ${studentId}`, { schoolId, studentId });

    res.json({ success: true, message: 'Discount removed' });
  } catch (err) { next(err); }
});

// GET /api/discounts/student/:studentId
// Get all discounts for a specific student
router.get('/student/:studentId', requireRoles('finance', 'director', 'superadmin', 'admin'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;

    const { data, error } = await supabase
      .from('student_discounts')
      .select(`
        discount_id, discount_type, discount_value, discount_amount,
        reason, is_active, approved_at, expires_at, starts_at,
        approver:users(full_name)
      `)
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('approved_at', { ascending: false });

    if (error) throw error;

    // Add labels
    const discountsWithLabels = data?.map(d => ({
      ...d,
      label: DISCOUNT_LABELS[d.discount_type] || d.discount_type
    })) || [];

    res.json(discountsWithLabels);
  } catch (err) { next(err); }
});

// GET /api/discounts/students
// List all students with active discounts
router.get('/students', requireRoles('finance', 'director', 'superadmin', 'admin'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data, error } = await supabase
      .from('student_discounts')
      .select(`
        discount_id, discount_type, discount_value, discount_amount,
        reason, expires_at, approved_at,
        student:students(
          student_id, first_name,
          last_name, admission_number,
          class_name, parent_name
        ),
        approver:users(full_name)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('approved_at', { ascending: false });

    if (error) throw error;

    // Add labels
    const discountsWithLabels = data?.map(d => ({
      ...d,
      label: DISCOUNT_LABELS[d.discount_type] || d.discount_type
    })) || [];

    res.json(discountsWithLabels);
  } catch (err) { next(err); }
});

// GET /api/discounts/calculate/:studentId
// Calculate discount for a student based on gross amount
router.get('/calculate/:studentId', requireRoles('finance', 'director', 'superadmin', 'admin'), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { grossAmount } = req.query;

    if (!grossAmount || isNaN(parseFloat(grossAmount))) {
      return res.status(400).json({ message: 'grossAmount query param required' });
    }

    const amount = parseFloat(grossAmount);

    // Get active discounts for student
    const { data: discounts } = await supabase
      .from('student_discounts')
      .select('discount_id, discount_type, discount_value')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString().split('T')[0]}`);

    if (!discounts || discounts.length === 0) {
      return res.json({
        grossAmount: amount,
        discountPercent: 0,
        discountAmount: 0,
        netAmount: amount,
        hasDiscount: false
      });
    }

    // Apply highest discount only (not stacked)
    const bestDiscount = discounts.reduce((best, d) =>
      d.discount_value > best.discount_value ? d : best
    );

    const discountAmount = (amount * bestDiscount.discount_value) / 100;
    const netAmount = amount - discountAmount;

    res.json({
      grossAmount: amount,
      discountPercent: bestDiscount.discount_value,
      discountAmount,
      netAmount,
      discountType: bestDiscount.discount_type,
      discountLabel: DISCOUNT_LABELS[bestDiscount.discount_type] || bestDiscount.discount_type,
      discountId: bestDiscount.discount_id,
      hasDiscount: true
    });

  } catch (err) { next(err); }
});

export default router;
