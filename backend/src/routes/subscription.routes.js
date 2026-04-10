import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

const PLAN_PRICING = {
  starter: 35,
  standard: 50,
  premium: 85
};

router.get("/", async (req, res, next) => {
  try {
    const { schoolId } = req.user;

    const { data: school } = await supabase
      .from('schools')
      .select('plan, plan_expires_at, student_count, monthly_fee')
      .eq('school_id', schoolId)
      .single();

    const { data: history } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      currentPlan: school?.plan || 'starter',
      expiresAt: school?.plan_expires_at,
      studentCount: school?.student_count || 0,
      monthlyFee: school?.monthly_fee || 0,
      history: history || []
    });
  } catch (err) { next(err); }
});

router.post("/upgrade", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { plan, studentCount, billingCycle = 'monthly', paymentReference } = req.body;

    if (!plan || !studentCount) {
      return res.status(400).json({ 
        message: "plan and studentCount are required" 
      });
    }

    if (!['starter','standard','premium'].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    const pricePerStudent = PLAN_PRICING[plan];
    const monthlyAmount = pricePerStudent * studentCount;
    const totalAmount = billingCycle === 'annual' 
      ? monthlyAmount * 10  
      : monthlyAmount;

    const expiresAt = new Date();
    if (billingCycle === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    await supabase
      .from('schools')
      .update({
        plan,
        plan_expires_at: expiresAt.toISOString(),
        student_count: studentCount,
        monthly_fee: monthlyAmount,
        updated_at: new Date().toISOString()
      })
      .eq('school_id', schoolId);

    await supabase
      .from('subscriptions')
      .insert({
        school_id: schoolId,
        plan,
        student_count: studentCount,
        monthly_amount: totalAmount,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        payment_reference: paymentReference || null
      });

    res.json({
      success: true,
      plan,
      studentCount,
      monthlyAmount,
      totalAmount,
      billingCycle,
      expiresAt,
      message: `Successfully upgraded to ${plan} plan`
    });

  } catch (err) { next(err); }
});

router.post("/downgrade", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { plan } = req.body;

    await supabase
      .from('schools')
      .update({ plan, updated_at: new Date().toISOString() })
      .eq('school_id', schoolId);

    res.json({ success: true, plan, message: `Plan changed to ${plan}` });
  } catch (err) { next(err); }
});

export default router;