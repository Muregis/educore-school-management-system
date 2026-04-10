// src/server.js
console.log('[Server] Starting server.js...');
import app from "./app.js";
console.log('[Server] App imported successfully');
import { env } from "./config/env.js";
console.log('[Server] Env loaded, port:', env.port);
import { testDbConnection, applyDatabaseMigrations } from "./config/db.js";
console.log('[Server] DB module imported');

// Debug: Log all registered routes
function logRoutes() {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(Object.keys(middleware.route.methods)[0].toUpperCase() + ' ' + middleware.route.path);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = handler.route.path;
          const method = Object.keys(handler.route.methods)[0].toUpperCase();
          routes.push(method + ' ' + middleware.regexp.toString().replace('/^\\', '').replace('\\/?(?=\\/|$)/i', '') + path);
        }
      });
    }
  });
  console.log('📋 Registered routes:', routes.slice(0, 20));
}

// Debug: Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Direct test endpoint works' });
});

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

    try {
      await applyDatabaseMigrations();
    } catch (migrationErr) {
      console.error("❌ Database migration step failed:", migrationErr.message);
      console.error("Continuing startup, but MPesa reconciliation routes may still fail until the database schema is fixed.");
    }

    // Start the server regardless of DB status
    app.listen(env.port, () => {
      console.log(`🚀 EduCore backend running on http://localhost:${env.port}`);
      // Log registered routes after startup
      setTimeout(logRoutes, 1000);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    console.error("Full error:", err);
    process.exit(1);
  }
}

start();