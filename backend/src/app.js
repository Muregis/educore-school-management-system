import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import * as Sentry from "@sentry/node";
import { env } from "./config/env.js";
import { apiRateLimit } from "./middleware/tenantRateLimit.js";
import healthRoutes        from "./routes/health.routes.js";
import authRoutes          from "./routes/auth.routes.js";
import studentsRoutes      from "./routes/students.routes.js";
import teachersRoutes      from "./routes/teachers.routes.js";
import attendanceRoutes    from "./routes/attendance.routes.js";
import gradesRoutes        from "./routes/grades.routes.js";
import paymentsRoutes      from "./routes/payments.routes.js";
import reportsRoutes       from "./routes/reports.routes.js";
import communicationRoutes from "./routes/communication.routes.js";
import integrationsRoutes  from "./routes/integrations.routes.js";
import disciplineRoutes    from "./routes/discipline.routes.js";
import transportRoutes     from "./routes/transport.routes.js";
import settingsRoutes      from "./routes/settings.routes.js";
import mpesaRoutes         from "./routes/mpesa.routes.js";
import paystackRoutes      from "./routes/paystack.routes.js";
import accountsRoutes      from "./routes/accounts.routes.js";
import timetableRoutes     from "./routes/timetable.routes.js";
import admissionsRoutes    from "./routes/admissions.routes.js";
import invoicesRoutes      from "./routes/invoices.routes.js";
import reportcardsRoutes   from "./routes/reportcards.routes.js";
import analyticsRoutes     from "./routes/analytics.routes.js";
import hrRoutes            from "./routes/hr.routes.js";
import libraryRoutes       from "./routes/library.routes.js";
import analysisRoutes      from "./routes/analysis.routes.js";
import activityRoutes      from "./routes/activity.routes.js";
import adminRoutes         from "./routes/admin.routes.js";
import lessonPlansRoutes   from "./routes/lessonplans.routes.js";
import announcementsRoutes from "./routes/announcements.routes.js";
import importRoutes         from "./routes/import.routes.js";
import ledgerRoutes        from "./routes/ledger.routes.js";
import paymentConfigsRoutes from "./routes/payment-configs.routes.js";
import subjectsRoutes      from "./routes/subjects.routes.js";
import examsRoutes         from "./routes/exams.routes.js";
import medicalRoutes       from "./routes/medical.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import publicRoutes        from "./routes/public.routes.js";
import newApiRoutes       from "./routes/new_api_routes.js";
import updateRequestsRoutes from "./routes/update_requests.js";
import enhancedExportsRoutes from "./routes/enhanced_exports.js";
import branchRoutes          from "./routes/branch.routes.js"; // NEW: Branch support
import adminPermissionsRoutes from "./routes/admin-permissions.routes.js"; // NEW: Director admin permissions
import performanceRoutes    from "./routes/performance.routes.js"; // NEW: KNEC performance sheets
import promotionRoutes      from "./routes/promotion.routes.js";  // NEW: Student promotion chain
import feereRemindersRoutes from "./routes/feereminders.routes.js"; // NEW: Fee reminder automation
// import { startBackupScheduler } from "./services/backup.service.js";
import { errorHandler }    from "./middleware/error.js";
import { authRequired } from "./middleware/auth.js";
import { tenantContext, tenantSecurityCheck } from "./middleware/tenantContext.js";
import { logTenantContext } from "./helpers/tenant-debug.logger.js";

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const corsOrigins = String(env.corsOrigin || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
      return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  optionsSuccessStatus: 204,
}));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(apiRateLimit); // Apply rate limiting to all API routes

// NEW: Apply tenant context middleware globally (after auth, before routes)
// Note: auth routes are excluded from global auth and handled separately
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api", authRequired);
app.use("/api", tenantContext);
app.use("/api", tenantSecurityCheck);
app.use("/api", (req, _res, next) => {
  logTenantContext("api.request", req, { method: req.method, path: req.path });
  next();
});

// OLD: app.use("/api",               studentsRoutes);
app.use("/api/students",      studentsRoutes);
app.use("/api/teachers",      teachersRoutes);
app.use("/api/attendance",    attendanceRoutes);
app.use("/api/grades",        gradesRoutes);
app.use("/api/payments",      paymentsRoutes);
app.use("/api/reports",       reportsRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/integrations",  integrationsRoutes);
app.use("/api/discipline",    disciplineRoutes);
app.use("/api/transport",     transportRoutes);
app.use("/api/settings",      settingsRoutes);
app.use("/api/mpesa",         mpesaRoutes);
app.use("/api/paystack",      paystackRoutes);
app.use("/api/accounts",      accountsRoutes);
app.use("/api/timetable",     timetableRoutes);
app.use("/api/admissions",    admissionsRoutes);
app.use("/api/invoices",      invoicesRoutes);
app.use("/api/reportcards",   reportcardsRoutes);
app.use("/api/analytics",     analyticsRoutes);
app.use("/api",             newApiRoutes);
app.use("/api/hr",            hrRoutes);
// OLD: app.use("/api/library",       libraryRoutes);
app.use("/api/library",       libraryRoutes);
app.use("/api/analysis",      analysisRoutes);
app.use("/api/activity-logs", activityRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/lesson-plans",  lessonPlansRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/import",         importRoutes);
app.use("/api/ledger",         ledgerRoutes);
app.use("/api/payment-configs",  paymentConfigsRoutes);
app.use("/api/subjects",        subjectsRoutes);
app.use("/api/exams",           examsRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/medical",         medicalRoutes);
app.use("/api/students",        updateRequestsRoutes);
app.use("/api",                 enhancedExportsRoutes);
app.use("/api/branches",        branchRoutes); // NEW: Branch/campus support
app.use("/api/admin-permissions", adminPermissionsRoutes); // NEW: Director admin permissions
app.use("/api/performance",     performanceRoutes);  // NEW: KNEC performance sheet
app.use("/api/students/promote", promotionRoutes);   // NEW: Promotion chain
app.use("/api/fees",             feereRemindersRoutes); // NEW: Fee reminders (additive, does not override /api/payments)

app.use((req, res) => res.status(404).json({ message: "Not found" }));

// Sentry error handler - must be added after all routes
Sentry.setupExpressErrorHandler(app);

// Legacy error handler (kept as fallback)
app.use(errorHandler);

// ── Start backup scheduler (daily at midnight) ───────────────────────────────
// startBackupScheduler();

export default app;
export { upload };
