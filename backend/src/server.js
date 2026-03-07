import app from "./app.js";
import { env } from "./config/env.js";
import { testDbConnection } from "./config/db.js";

async function start() {
  try {
    await testDbConnection();
    console.log("✅ Database connected");
    app.listen(env.port, () => {
      console.log(`🚀 EduCore backend running on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

start();