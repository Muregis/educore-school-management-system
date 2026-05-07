import { pgPool } from "../config/pg.js";

const SESSION_TTL_MINUTES = 10;
const SESSION_UPDATE_THROTTLE_MINUTES = 2;
let sessionsTableReady = false;

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

  await ensureUserSessionsTable();
  const sessionId = crypto.randomUUID();
  await pgPool.query(
    `
      INSERT INTO user_sessions (user_id, session_id, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${SESSION_TTL_MINUTES} minutes')
    `,
    [Number(userId), sessionId, req.get("User-Agent") || null, req.ip]
  );

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
    next();
  } catch (err) {
    console.error("[session] Session validation failed:", err);
    res.status(401).json({ message: "Session validation failed" });
  }
};

export async function cleanupExpiredSessions() {
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
