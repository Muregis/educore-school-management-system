import { pgPool } from "../config/pg.js";

const SESSION_TTL_MINUTES = 10;
const SESSION_UPDATE_THROTTLE_MINUTES = 2;
let sessionsTableReady = false;
let sessionsBackend = "pg"; // "pg" | "memory"

// Fallback in case Postgres session storage isn't configured in production.
// This keeps login functional even when `PG_DATABASE_URL` / `DATABASE_URL` is missing.
const memorySessions = new Map(); // session_id -> session record

function getUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function isIntegerUserId(userId) {
  return Number.isInteger(Number(userId)) && String(userId) !== "";
}

async function ensureUserSessionsTable() {
  if (sessionsTableReady) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
      session_id TEXT UNIQUE NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_active
      ON user_sessions(user_id, session_id)
      WHERE is_active = true
  `);

  sessionsTableReady = true;
}

export async function createUserSession(req, userId) {
  if (!isIntegerUserId(userId)) return null;

  const sessionId = crypto.randomUUID();

  // Try Postgres-backed sessions first.
  try {
    await ensureUserSessionsTable();
    await pgPool.query(
      `
        INSERT INTO user_sessions (user_id, session_id, user_agent, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes')
      `,
      [Number(userId), sessionId, req.get("User-Agent") || null, req.ip]
    );
    sessionsBackend = "pg";
    return sessionId;
  } catch (err) {
    // If Postgres isn't configured (common on Render), fall back to in-memory sessions.
    sessionsBackend = "memory";
    console.error("[session] Postgres session store unavailable; using in-memory fallback:", err?.message || err);
  }

  const now = Date.now();
  memorySessions.set(sessionId, {
    user_id: Number(userId),
    session_id: sessionId,
    user_agent: req.get("User-Agent") || null,
    ip_address: req.ip,
    last_active: new Date(now),
    created_at: new Date(now),
    expires_at: new Date(now + SESSION_TTL_MINUTES * 60 * 1000),
    is_active: true
  });

  return sessionId;
}

export const validateSession = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const sessionId = req.headers["x-session-id"];

    if (!isIntegerUserId(userId)) {
      return next();
    }

    if (!sessionId) {
      return res.status(401).json({ message: "Session required" });
    }

    if (sessionsBackend === "memory") {
      const entry = memorySessions.get(sessionId);
      const now = Date.now();

      if (!entry || !entry.is_active || entry.user_id !== Number(userId) || entry.expires_at.getTime() <= now) {
        return res.status(401).json({ message: "Session expired or revoked" });
      }

      // Mirror throttle behavior: refresh expires_at only when last_active is old enough.
      const throttleMs = SESSION_UPDATE_THROTTLE_MINUTES * 60 * 1000;
      if (entry.last_active.getTime() < now - throttleMs) {
        entry.last_active = new Date(now);
        entry.expires_at = new Date(now + SESSION_TTL_MINUTES * 60 * 1000);
      }

      req.session = entry;
      return next();
    }

    // PG-backed validation
    try {
      await ensureUserSessionsTable();
      const result = await pgPool.query(
        `
          SELECT *
          FROM user_sessions
          WHERE session_id = $1
            AND user_id = $2
            AND is_active = true
            AND expires_at > NOW()
        `,
        [sessionId, Number(userId)]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Session expired or revoked" });
      }

      await pgPool.query(
        `
          UPDATE user_sessions
          SET last_active = NOW(),
              expires_at = NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes'
          WHERE session_id = $1
            AND last_active < NOW() - INTERVAL '${SESSION_UPDATE_THROTTLE_MINUTES} minutes'
        `,
        [sessionId]
      );

      req.session = result.rows[0];
      return next();
    } catch (err) {
      // If PG fails mid-flight, swap to memory and try again from the in-memory map.
      sessionsBackend = "memory";
      console.error("[session] Postgres session validation failed; switching to memory fallback:", err?.message || err);
      const entry = memorySessions.get(sessionId);
      const now = Date.now();
      if (!entry || !entry.is_active || entry.user_id !== Number(userId) || entry.expires_at.getTime() <= now) {
        return res.status(401).json({ message: "Session expired or revoked" });
      }
      req.session = entry;
      return next();
    }
  } catch (err) {
    console.error("[session] Session validation failed:", err);
    res.status(401).json({ message: "Session validation failed" });
  }
};

export async function cleanupExpiredSessions() {
  if (sessionsBackend === "memory") {
    const now = Date.now();
    for (const [sessionId, entry] of memorySessions.entries()) {
      if (!entry.is_active || entry.expires_at.getTime() <= now) {
        memorySessions.delete(sessionId);
      }
    }
    return;
  }

  await ensureUserSessionsTable();
  await pgPool.query(
    `
      UPDATE user_sessions
      SET is_active = false
      WHERE expires_at < NOW()
        AND is_active = true
    `
  );
}

export async function revokeUserSession(sessionId, userId = null) {
  if (!sessionId) return { revoked: false, user_id: null };

  if (sessionsBackend === "memory") {
    const entry = memorySessions.get(sessionId);
    if (!entry || !entry.is_active) return { revoked: false, user_id: null };
    if (userId != null && Number(userId) !== entry.user_id) return { revoked: false, user_id: null };
    entry.is_active = false;
    return { revoked: true, user_id: entry.user_id };
  }

  await ensureUserSessionsTable();
  const result = await pgPool.query(
    "UPDATE user_sessions SET is_active = false WHERE session_id = $1 RETURNING user_id",
    [sessionId]
  );

  if (result.rowCount === 0) return { revoked: false, user_id: null };
  return { revoked: true, user_id: result.rows[0].user_id };
}
