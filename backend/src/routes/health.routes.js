import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { env } from "../config/env.js";

const router = Router();

// Enhanced health check with service status monitoring
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
      mpesa: "checking..."
    }
  };

  try {
    // Check database connectivity
    const { data, error } = await supabase
      .from('schools')
      .select('school_id')
      .limit(1);
    
    healthCheck.services.database = error ? "error" : "healthy";
    healthCheck.services.supabase = error ? "error" : "healthy";
    
    if (error) {
      healthCheck.status = "degraded";
      healthCheck.database_error = error.message;
    }
  } catch (dbError) {
    healthCheck.services.database = "error";
    healthCheck.services.supabase = "error";
    healthCheck.status = "unhealthy";
    healthCheck.database_error = dbError.message;
  }

  // Check WhatsApp configuration from school settings
  try {
    const { data: schoolWa } = await supabase
      .from('schools')
      .select('whatsapp_business_number')
      .limit(1)
      .maybeSingle();
    
    if (schoolWa?.whatsapp_business_number) {
      healthCheck.services.whatsapp = "configured";
    } else {
      healthCheck.services.whatsapp = "not_configured";
      healthCheck.status = healthCheck.status === "healthy" ? "degraded" : healthCheck.status;
    }
  } catch {
    healthCheck.services.whatsapp = "error";
  }

  // Check Paystack configuration
  if (env.paystackSecretKey && env.paystackPublicKey) {
    healthCheck.services.paystack = "configured";
  } else {
    healthCheck.services.paystack = "not_configured";
    healthCheck.status = healthCheck.status === "healthy" ? "degraded" : healthCheck.status;
  }

  // Check M-Pesa configuration
  if (env.mpesaConsumerKey && env.mpesaConsumerSecret) {
    healthCheck.services.mpesa = "configured";
  } else {
    healthCheck.services.mpesa = "not_configured";
    healthCheck.status = healthCheck.status === "healthy" ? "degraded" : healthCheck.status;
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  healthCheck.memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
    total: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
    rss: Math.round(memUsage.rss / 1024 / 1024) + " MB"
  };

  const statusCode = healthCheck.status === "healthy" ? 200 : 
                   healthCheck.status === "degraded" ? 200 : 503;

  res.status(statusCode).json(healthCheck);
});

// Simple liveness probe for Kubernetes/container orchestration
router.get("/live", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString() 
  });
});

// Readiness probe - checks if application is ready to serve traffic
router.get("/ready", async (req, res) => {
  try {
    // Check if we can connect to database
    await supabase.from('schools').select('school_id').limit(1);
    
    res.status(200).json({ 
      status: "ready", 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: "not_ready", 
      timestamp: new Date().toISOString(),
      error: error.message 
    });
  }
});

export default router;