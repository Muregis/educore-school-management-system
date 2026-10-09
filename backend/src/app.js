import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import * as Sentry from "@sentry/node";
import { env } from "./config/env.js";
import { apiRateLimit } from "./middleware/tenantRateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { responseWrapper } from "./middleware/responseWrapper.js";
import { compressionMiddleware } from "./middleware/compression.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { apiVersioning } from "./middleware/apiVersioning.js";
import { idempotency } from "./middleware/idempotency.js";
import { requestLogger } from "./utils/logger.js";
import healthRoutes        from "./routes/health.routes.js";
import authRoutes          from "./routes/auth.routes.js";
import onboardingRoutes    from "./routes/onboarding.routes.js";
import studentsRoutes      from "./routes/students.routes.js";
import collegeRoutes       from "./routes/college.routes.js";
import teachersRoutes      from "./routes/teachers.routes.js";
import teacherAssignmentsRoutes from "./routes/teacherassignments.routes.js";
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
import parentRoutes        from "./routes/parent.routes.js";
import newApiRoutes       from "./routes/new_api_routes.js";
import updateRequestsRoutes from "./routes/update_requests.js";
import enhancedExportsRoutes from "./routes/enhanced_exports.js";
import branchRoutes          from "./routes/branch.routes.js";
import adminPermissionsRoutes from "./routes/admin-permissions.routes.js";
import performanceRoutes    from "./routes/performance.routes.js";
import promotionRoutes      from "./routes/promotion.routes.js";
import feereRemindersRoutes   from "./routes/feereminders.routes.js";
import academicTermsRoutes      from "./routes/academic-terms.routes.js";
import promotionAdvancedRoutes  from "./routes/promotion-advanced.routes.js";
import notificationQueueRoutes  from "./routes/notification-queue.routes.js";
import discountsRoutes         from "./routes/discounts.routes.js";
import billingRoutes           from "./routes/billing.routes.js";
import expendituresRoutes     from "./routes/expenditures.routes.js";
import examTypesRoutes         from "./routes/exam-types.routes.js";
import compiledResultsRoutes   from "./routes/compiled-results.routes.js";
import uploadRoutes           from "./routes/upload.routes.js";
import examsEnhancedRoutes       from "./routes/exams-enhanced.routes.js";
import libraryEnhancedRoutes     from "./routes/library-enhanced.routes.js";
import hrPayrollRoutes           from "./routes/hr-payroll.routes.js";
import reportingRoutes           from "./routes/reporting.routes.js";
import auditComplianceRoutes      from "./routes/audit-compliance.routes.js";
import backupRoutes               from "./routes/backup.routes.js";
import academicYearsRoutes        from "./routes/academic-years.routes.js";
import studentLifecycleRoutes     from "./routes/student-lifecycle.routes.js";
import financeRoutes              from "./routes/finance.routes.js";
import securityRoutes             from "./routes/security.routes.js";
import classesRoutes              from "./routes/classes.routes.js";
import { cacheMiddleware, invalidateCacheOnMutation } from "./middleware/cache.js";
import { errorHandler }         from "./middleware/error.js";
import { authRequired }         from "./middleware/auth.js";
import { validateSession }      from "./middleware/session.js";
import { tenantContext, tenantSecurityCheck } from "./middleware/tenantContext.js";
import { logTenantContext }     from "./helpers/tenant-debug.logger.js";

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'text/csv'];
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

app.use(securityHeaders);
app.use(compressionMiddleware);
app.use(requestId);
app.use(apiVersioning);
app.use(responseWrapper);

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
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(apiRateLimit);
app.use(requestLogger);
app.use(idempotency());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

app.post("/api/auth/signup", (req, res, next) => {
  req.url = "/register-school";
  req.originalUrl = "/api/onboarding/register-school";
  return onboardingRoutes(req, res, next);
});

app.use("/api/onboarding", onboardingRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/teacherassignments", teacherAssignmentsRoutes);
app.use("/api/teacher-assignments", teacherAssignmentsRoutes);
app.use("/api/parent", authRequired, validateSession, parentRoutes);

function isPublicApiPath(req) {
  const p = String(req.path || "");
  const full = String(req.originalUrl || "").split("?")[0];
  const exemptPrefixes = [
    "/health", "/auth", "/onboarding", "/public",
    "/teacherassignments", "/teacher-assignments",
    "/api/health", "/api/auth", "/api/onboarding", "/api/public",
  ];
  return exemptPrefixes.some((prefix) => p.startsWith(prefix) || full.startsWith(prefix));
}

app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return authRequired(req, res, next);
});

app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return validateSession(req, res, next);
});
app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return tenantContext(req, res, next);
});
app.use("/api", (req, res, next) => {
  if (isPublicApiPath(req)) return next();
  return tenantSecurityCheck(req, res, next);
});
app.use("/api", (req, _res, next) => {
  logTenantContext("api.request", req, { method: req.method, path: req.path });
  next();
});

app.use(invalidateCacheOnMutation);

app.use("/api/students",      studentsRoutes);
app.use("/api/college",         collegeRoutes);
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
app.use("/api/branches",        branchRoutes);
app.use("/api/admin-permissions", adminPermissionsRoutes);
app.use("/api/performance",     performanceRoutes);
app.use("/api/students/promote", promotionRoutes);
app.use("/api/fees",             feereRemindersRoutes);
app.use("/api/academic/terms",    academicTermsRoutes);
app.use("/api/academic/years",     academicYearsRoutes);
app.use("/api/students/lifecycle", studentLifecycleRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/exams/v2", examsEnhancedRoutes);
app.use("/api/library/v2", libraryEnhancedRoutes);
app.use("/api/hr/payroll", hrPayrollRoutes);
app.use(cacheMiddleware(30));
app.use("/api/security", securityRoutes);
app.use("/api/reports", reportingRoutes);
app.use("/api/audit", auditComplianceRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/promotion",         promotionAdvancedRoutes);
app.use("/api/notifications",     notificationQueueRoutes);
app.use("/api/discounts",         discountsRoutes);
app.use("/api/billing",           billingRoutes);
app.use("/api/expenditures",      expendituresRoutes);
app.use("/api/exam-types",        examTypesRoutes);
app.use("/api/grades/compiled",   compiledResultsRoutes);
app.use("/api/upload",            uploadRoutes);
app.use("/api/classes",            classesRoutes);

app.use((req, res) => res.status(404).json({ message: "Not found" }));

Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

export default app;
export { upload };
