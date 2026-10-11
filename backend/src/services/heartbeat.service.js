import { supabase } from "../config/supabaseClient.js";
import { pgPool } from "../config/pg.js";
import { env } from "../config/env.js";

/**
 * Supabase Free Tier Anti-Pause & Liveness Keeper
 *
 * Supabase free projects pause automatically after 7 days of inactivity.
 * This worker issues a lightweight query every 24 hours to ensure:
 * 1. The database remains continuously active even during long school holidays (April, August, December).
 * 2. Schools never face 503 connection errors on term opening days.
 * 3. Admins can inspect health and last-ping timestamps in real time.
 */

let _heartbeatTimer = null;
let _lastHeartbeat = null;
let _lastHeartbeatError = null;
let _heartbeatCount = 0;

export async function pingDatabase() {
  const isLocalMode = env.databaseMode === "local";
  const startedAt = Date.now();

  try {
    if (isLocalMode) {
      await pgPool.query("SELECT 1 AS alive");
    } else if (supabase) {
      // Lightweight REST read on schools table
      const { data, error } = await supabase.from("schools").select("school_id").limit(1);
      if (error) throw new Error(error.message);
    } else {
      throw new Error("No database client configured");
    }

    const latencyMs = Date.now() - startedAt;
    _lastHeartbeat = {
      timestamp: new Date().toISOString(),
      latencyMs,
      status: "healthy",
      target: isLocalMode ? "local-postgres" : "supabase-cloud",
    };
    _lastHeartbeatError = null;
    _heartbeatCount++;

    console.log(`[Heartbeat] ✅ Database keep-alive ping successful (${latencyMs}ms) [#${_heartbeatCount}]`);
    return _lastHeartbeat;
  } catch (err) {
    _lastHeartbeatError = {
      timestamp: new Date().toISOString(),
      error: err.message,
    };
    console.warn(`[Heartbeat] ⚠️ Database keep-alive ping failed: ${err.message}`);
    return {
      timestamp: new Date().toISOString(),
      status: "degraded",
      error: err.message,
    };
  }
}

export function getHeartbeatStatus() {
  const intervalHours = 24;
  let nextScheduled = null;
  if (_lastHeartbeat?.timestamp) {
    const last = new Date(_lastHeartbeat.timestamp).getTime();
    nextScheduled = new Date(last + intervalHours * 60 * 60 * 1000).toISOString();
  }

  return {
    autoPausePrevented: true,
    freeTierProtectionActive: true,
    pingIntervalHours: intervalHours,
    totalPings: _heartbeatCount,
    lastPing: _lastHeartbeat,
    lastError: _lastHeartbeatError,
    nextPingDue: nextScheduled,
    databaseMode: env.databaseMode,
  };
}

export function startSupabaseHeartbeatWorker() {
  if (_heartbeatTimer) return;

  // Immediate ping on server startup
  pingDatabase().catch((e) => console.warn("[Heartbeat] Initial ping warning:", e.message));

  // Run every 24 hours (86,400,000 ms)
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  _heartbeatTimer = setInterval(() => {
    pingDatabase().catch((e) => console.warn("[Heartbeat] Scheduled ping warning:", e.message));
  }, INTERVAL_MS);

  console.log("[Heartbeat] 🛡️ Supabase Free-Tier Anti-Pause Worker started (pinging every 24h)");
}
