import app from "./app.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./config/db.js";
import { testPgConnection } from "./config/pg.js";

async function start() {
  try {
    console.log("⚠️ Skipping PostgreSQL connection test - need correct Supabase credentials");
    // await testPgConnection();
    // console.log("✅ PostgreSQL database connected");
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