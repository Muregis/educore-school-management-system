// src/server.js
import app from "./app.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./config/db.js";

async function start() {
  try {
    // Supabase-only database connection
    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      console.error(
        "❌ Supabase credentials missing in .env (SUPABASE_URL and SUPABASE_SERVICE_KEY required)"
      );
      process.exit(1);
    }
    
    try {
      await testDbConnection();
      console.log("✅ Supabase database connected successfully");
    } catch (dbErr) {
      console.error("❌ Supabase connection failed:", dbErr.message);
      process.exit(1);
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