import { Router } from "express";
// OLD: import { pool } from "../config/db.js";
import { supabase } from "../config/supabaseClient.js";

const router = Router();

  router.get("/health", async (req, res, next) => {
    try {
      // Check Supabase connectivity with a simple query
      const startTime = Date.now();
      const { data: nowData, error: nowError } = await supabase
        .rpc('get_current_timestamp');
      const dbTime = nowError ? null : nowData;
      
      // Alternative: check via a simple table count
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('school_id', { count: 'exact', head: true });
      
      const isConnected = !schoolsError && schoolsData !== undefined;

    let lessonPlansTable = null;
    try {
      const { data: t, error: tableError } = await supabase
        .from('lesson_plans')
        .select('*', { count: 'exact', head: true });
      lessonPlansTable = !tableError;
    } catch {
      lessonPlansTable = false;
    }

    let activityLogsTable = null;
    try {
      const { data: t, error: tableError } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true });
      activityLogsTable = !tableError;
    } catch {
      activityLogsTable = false;
    }

    const payload = {
      ok: isConnected,
      dbTime: dbTime,
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
