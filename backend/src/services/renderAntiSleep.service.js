import { env } from "../config/env.js";

/**
 * Render Free Tier Anti-Sleep Keeper
 *
 * Render spins down free web services after 15 minutes of inactivity.
 * When an idle service receives a request, it suffers a 50-second cold boot.
 *
 * This worker issues an external HTTP GET to the service's public URL every 12 minutes,
 * routing through Render's external load balancer to reset the 15-minute idle countdown
 * and keep the backend permanently responsive for school users and M-Pesa callbacks.
 */

let _antiSleepTimer = null;
let _lastPing = null;
let _totalPings = 0;
const INTERVAL_MS = 12 * 60 * 1000; // 12 minutes (Render sleeps at 15m)

function resolveTargetUrl() {
  const url = env.renderExternalUrl || process.env.RENDER_EXTERNAL_URL;
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export async function pingRender() {
  const baseUrl = resolveTargetUrl();
  if (!baseUrl) {
    return {
      status: "idle",
      message: "No public URL configured (running in local mode)",
    };
  }

  const endpoint = `${baseUrl}/api/health/live`;
  const startedAt = Date.now();

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "User-Agent": "EduCore-AntiSleep-Worker/1.0",
      },
    });

    const latencyMs = Date.now() - startedAt;
    _lastPing = {
      timestamp: new Date().toISOString(),
      status: res.status,
      latencyMs,
      endpoint,
    };
    _totalPings++;

    console.log(`[Render Anti-Sleep] ⏰ Self-ping sent to ${endpoint} (${res.status} OK, ${latencyMs}ms) [#${_totalPings}]`);
    return _lastPing;
  } catch (err) {
    _lastPing = {
      timestamp: new Date().toISOString(),
      status: "error",
      error: err.message,
      endpoint,
    };
    console.warn(`[Render Anti-Sleep] ⚠️ Self-ping warning for ${endpoint}: ${err.message}`);
    return _lastPing;
  }
}

export function getRenderKeepAliveStatus() {
  const targetUrl = resolveTargetUrl();
  let nextScheduled = null;

  if (_lastPing?.timestamp) {
    const lastTime = new Date(_lastPing.timestamp).getTime();
    nextScheduled = new Date(lastTime + INTERVAL_MS).toISOString();
  }

  return {
    antiSleepActive: Boolean(targetUrl),
    targetUrl: targetUrl || "Not detected (set RENDER_EXTERNAL_URL)",
    pingIntervalMinutes: 12,
    totalPings: _totalPings,
    lastPing: _lastPing,
    nextPingDue: nextScheduled,
  };
}

export function startRenderAntiSleepWorker() {
  if (_antiSleepTimer) return;

  const targetUrl = resolveTargetUrl();
  if (!targetUrl) {
    console.log("[Render Anti-Sleep] ℹ️ Local environment detected. Anti-sleep worker will activate automatically when deployed on Render.");
    return;
  }

  console.log(`[Render Anti-Sleep] 🚀 Anti-Sleep worker activated for ${targetUrl} (pinging every 12 minutes)`);

  // Initial ping 60 seconds after boot to confirm connectivity
  setTimeout(() => {
    pingRender().catch(() => {});
  }, 60 * 1000);

  // Scheduled interval
  _antiSleepTimer = setInterval(() => {
    pingRender().catch(() => {});
  }, INTERVAL_MS);
}
