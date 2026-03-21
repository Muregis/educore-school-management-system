import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";

const router = Router();

// FIX: Route was nested as /health/health due to double path definition.
// app.js mounts this at /api/health, so this handler should be at "/"
router.get("/", async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Check via a simple table count
    const { count: schoolCount, error: schoolsError } = await supabase
      .from('schools')
      .select('school_id', { count: 'exact', head: true });
    
    const isConnected = !schoolsError;

    let lessonPlansTable = null;
    try {
      const { error: tableError } = await supabase
        .from('lesson_plans')
        .select('*', { count: 'exact', head: true });
      lessonPlansTable = !tableError;
    } catch {
      lessonPlansTable = false;
    }

    let activityLogsTable = null;
    try {
      const { error: tableError } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true });
      activityLogsTable = !tableError;
    } catch {
      activityLogsTable = false;
    }

    const payload = {
      ok: isConnected,
      db: 'supabase',
      lessonPlansTable,
      activityLogsTable,
      responseTimeMs: Date.now() - startTime
    };

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;