import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import * as Sentry from "@sentry/node";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRequired } from "./middleware/auth.js";
import { validateSession } from "./middleware/validateSession.js";
import { tenantContext } from "./middleware/tenantContext.js";
import { tenantSecurityCheck } from "./middleware/tenantSecurity.js";
import { logTenantContext } from "./middleware/tenantLogger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { idempotency } from "./middleware/idempotency.js";
import { invalidateCacheOnMutation } from "./middleware/cacheInvalidation.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import publicRoutes from "./routes/public.routes.js";
import teacherAssignmentsRoutes from "./routes/teacherAssignments.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import studentsRoutes from "./routes/students.routes.js";
import collegeRoutes from "./routes/college.routes.js";
import teachersRoutes from "./routes/teachers.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import gradesRoutes from "./routes/grades.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import communicationRoutes from "./routes/communication.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import disciplineRoutes from "./routes/discipline.routes.js";
import transportRoutes from "./routes/transport.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import mpesaRoutes from "./routes/mpesa.routes.js";
import paystackRoutes from "./routes/paystack.routes.js";
import accountsRoutes from "./routes/accounts.routes.js";
import timetableRoutes from "./routes/timetable.routes.js";
import admissionsRoutes from "./routes/admissions.routes.js";
import invoicesRoutes from "./routes/invoices.routes.js";
import reportcardsRoutes from "./routes/reportcards.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import newApiRoutes from "./routes/newApi.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import libraryRoutes from "./routes/library.routes.js";
import analysisRoutes from "./routes/analysis.routes.js";
import activityRoutes from "./routes/activity.routes.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
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

app.use("/api/students", studentsRoutes);
app.use("/api/college", collegeRoutes);
app.use("/api/teachers", teachersRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/grades", gradesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/discipline", disciplineRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/mpesa", mpesaRoutes);
app.use("/api/paystack", paystackRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/admissions", admissionsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/reportcards", reportcardsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api", newApiRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/activity-logs", activityRoutes);

Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

export default app;
export { upload };
