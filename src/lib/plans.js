export const PLAN_FEATURES = {
  starter: {
    pages: [
      "dashboard", "students", "teachers", 
      "attendance", "grades", "fees", 
      "reportcards", "discipline", "timetable", "settings"
    ],
    maxStaff: 3,
    sms: false,
    mpesa: false,
    hr: false,
    library: false,
    ai: false,
    analytics: "basic",
    backups: false,
  },
  standard: {
    pages: [
      "dashboard", "students", "teachers",
      "attendance", "grades", "fees", "payments",
      "reportcards", "discipline", "timetable",
      "invoices", "admissions", "hr", "staff",
      "library", "communication", "reports",
      "analytics", "accounts", "settings"
    ],
    maxStaff: 10,
    sms: true,
    mpesa: true,
    hr: true,
    library: true,
    ai: false,
    analytics: "full",
    backups: "weekly",
  },
  premium: {
    pages: [
      "dashboard", "students", "teachers",
      "attendance", "grades", "fees", "payments",
      "reportcards", "discipline", "timetable",
      "invoices", "admissions", "hr", "staff",
      "library", "communication", "reports",
      "analytics", "accounts", "settings",
      "lessonplans", "pendingplans", "analysis"
    ],
    maxStaff: Infinity,
    sms: true,
    mpesa: true,
    hr: true,
    library: true,
    ai: true,
    analytics: "full",
    backups: "daily",
  }
};

export const PLAN_LIMITS = {
  starter: ["dashboard", "students", "teachers", "attendance", "grades", "fees", "reportcards", "discipline", "timetable", "settings"],
  standard: ["dashboard", "students", "teachers", "attendance", "grades", "fees", "payments", "reportcards", "discipline", "timetable", "invoices", "admissions", "hr", "library", "communication", "reports", "analytics", "accounts", "settings"],
  premium: ["all"]
};

export const PLANS = ["starter", "standard", "premium"];