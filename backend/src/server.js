// src/server.js
import app from "./app.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./config/db.js";
import { testPgConnection } from "./config/pg.js";

async function start() {
  try {
    // MySQL connection (fallback / legacy)
    try {
      await testDbConnection();
      console.log("✅ MySQL database connected (fallback ready)");
    } catch (mysqlErr) {
      console.warn("⚠️ MySQL connection failed, but continuing (hybrid mode)", mysqlErr.message);
    }

    // Supabase / PostgreSQL connection (primary target)
    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      console.warn(
        "⚠️ Supabase credentials missing in .env (SUPABASE_URL and SUPABASE_SERVICE_KEY required) — skipping connection test"
      );
    } else {
      try {
        await testPgConnection();
        console.log("✅ PostgreSQL (Supabase) database connected successfully");
      } catch (pgErr) {
        console.error("❌ Supabase connection failed:", pgErr.message);
        // Do NOT exit — continue with MySQL fallback / hybrid mode
        console.warn("Continuing in hybrid mode (MySQL only until Supabase is fixed)");
      }
    }

    // Start the server regardless of DB status
    app.listen(env.port, () => {
      console.log(`🚀 EduCore backend running on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    console.error("Full error:", err);
    process.exit(1);
  }
}

start();