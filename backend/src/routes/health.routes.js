import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { env } from "../config/env.js";
import { runScheduledBackups } from "../services/backup.service.js";

const router = Router();

function overallFromServices(services) {
  const values = Object.values(services);
  if (values.some((v) => v === "outage" || v === "error")) return "outage";
  if (values.some((v) => v === "degraded" || v === "not_configured")) return "degraded";
  return "operational";
}

/** Public SaaS status — safe for status pages. GET /api/health/status */
router.get("/status", async (req, res) => {
  const services = {
    api: "operational",
    database: "operational",
    storage: "operational",
  };

  try {
    const { error } = await supabase.from("schools").select("school_id").limit(1);
    if (error) services.database = "outage";
  } catch {
    services.database = "outage";
  }

  try {
    if (env.supabaseUrl && env.supabaseServiceKey) {
      const { error } = await supabase.storage.listBuckets();
      if (error) services.storage = "degraded";
    } else {
      services.storage = "degraded";
    }
  } catch {
    services.storage = "degraded";
  }

  const overall = overallFromServices(services);
  const statusCode = overall === "outage" ? 503 : 200;

  res.status(statusCode).json({
    product: "EduCore",
    overall,
    services,
    uptime_target: "99.5%",
    timestamp: new Date().toISOString(),
  });
});

/** Liveness. GET /api/health/live */
router.get("/live", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/** Readiness — SLA probe target. GET /api/health/ready */
router.get("/ready", async (req, res) => {
  try {
    const { error } = await supabase.from("schools").select("school_id").limit(1);
    if (error) throw error;
    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "not_ready",
      timestamp: new Date().toISOString(),
    });
  }
});

/** Secure daily backup cron. POST /api/health/cron/backups */
router.post("/cron/backups", async (req, res) => {
  const secret = process.env.CRON_SECRET || env.cronSecret;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!secret || token !== secret) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  try {
    console.log("[cron] Scheduled tenant backups started");
    await runScheduledBackups();
    res.status(200).json({
      ok: true,
      message: "Scheduled backups finished",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron] backups failed:", err.message);
    res.status(500).json({
      ok: false,
      message: "Backup job failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/** Operator health detail. GET /api/health */
router.get("/", async (req, res) => {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      database: "checking...",
      supabase: "checking...",
      whatsapp: "checking...",
      paystack: "checking...",
      mpesa: "checking...",
    },
  };

  try {
    const { error } = await supabase.from("schools").select("school_id").limit(1);
    healthCheck.services.database = error ? "error" : "healthy";
    healthCheck.services.supabase = error ? "error" : "healthy";
    if (error) healthCheck.status = "degraded";
  } catch {
    healthCheck.services.database = "error";
    healthCheck.services.supabase = "error";
    healthCheck.status = "unhealthy";
  }

  try {
    const { data: schoolWa } = await supabase
      .from("schools")
      .select("whatsapp_business_number")
      .limit(1)
      .maybeSingle();
    if (schoolWa?.whatsapp_business_number) {
      healthCheck.services.whatsapp = "configured";
    } else {
      healthCheck.services.whatsapp = "not_configured";
      if (healthCheck.status === "healthy") healthCheck.status = "degraded";
    }
  } catch {
    healthCheck.services.whatsapp = "error";
  }

  if (env.paystackSecretKey && env.paystackPublicKey) {
    healthCheck.services.paystack = "configured";
  } else {
    healthCheck.services.paystack = "not_configured";
    if (healthCheck.status === "healthy") healthCheck.status = "degraded";
  }

  if (env.mpesaConsumerKey && env.mpesaConsumerSecret) {
    healthCheck.services.mpesa = "configured";
  } else {
    healthCheck.services.mpesa = "not_configured";
    if (healthCheck.status === "healthy") healthCheck.status = "degraded";
  }

  const memUsage = process.memoryUsage();
  healthCheck.memory = {
    rss_mb: Math.round(memUsage.rss / 1024 / 1024),
    heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
  };

  const statusCode = healthCheck.status === "unhealthy" ? 503 : 200;
  res.status(statusCode).json(healthCheck);
});

export default router;
