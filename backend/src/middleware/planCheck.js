import { supabase } from "../config/supabaseClient.js";

const PLAN_FEATURES = {
  starter: {
    pages: ["dashboard", "students", "teachers", "attendance", "grades", "fees", "reportcards", "discipline", "timetable", "settings"],
    sms: false,
    mpesa: false,
    hr: false,
    library: false,
    ai: false,
  },
  standard: {
    pages: ["dashboard", "students", "teachers", "attendance", "grades", "fees", "payments", "reportcards", "discipline", "timetable", "invoices", "admissions", "hr", "library", "communication", "reports", "analytics", "accounts", "settings"],
    sms: true,
    mpesa: true,
    hr: true,
    library: true,
    ai: false,
  },
  premium: {
    pages: ["dashboard", "students", "teachers", "attendance", "grades", "fees", "payments", "reportcards", "discipline", "timetable", "invoices", "admissions", "hr", "library", "communication", "reports", "analytics", "accounts", "settings", "lessonplans", "pendingplans", "analysis"],
    sms: true,
    mpesa: true,
    hr: true,
    library: true,
    ai: true,
  },
};

export async function requirePlan(req, res, next) {
  try {
    const { schoolId } = req.user;
    if (!schoolId) {
      return res.status(403).json({ message: "School context required" });
    }

    const { data: school } = await supabase
      .from("schools")
      .select("plan")
      .eq("school_id", schoolId)
      .single();

    const plan = school?.plan || "starter";
    req.schoolPlan = plan;
    req.planFeatures = PLAN_FEATURES[plan];
    next();
  } catch (error) {
    console.error("Plan check error:", error.message);
    req.schoolPlan = "starter";
    req.planFeatures = PLAN_FEATURES.starter;
    next();
  }
}

export function requirePlanFeature(feature) {
  return async (req, res, next) => {
    await requirePlan(req, res, async () => {
      const features = req.planFeatures || PLAN_FEATURES.starter;
      if (!features[feature]) {
        return res.status(403).json({
          message: `This feature requires a higher plan`,
          currentPlan: req.schoolPlan || "starter",
          feature,
        });
      }
      next();
    });
  };
}

export function requirePlanLevel(...allowedPlans) {
  const planRank = { starter: 0, standard: 1, premium: 2 };
  return async (req, res, next) => {
    await requirePlan(req, res, async () => {
      const currentRank = planRank[req.schoolPlan] || 0;
      const allowedRank = Math.min(...allowedPlans.map(p => planRank[p]));
      if (currentRank < allowedRank) {
        return res.status(403).json({
          message: `This feature requires ${allowedPlans[0]} plan or higher`,
          currentPlan: req.schoolPlan,
        });
      }
      next();
    });
  };
}

export default { requirePlan, requirePlanFeature, requirePlanLevel };