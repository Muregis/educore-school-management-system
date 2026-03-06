import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

router.get("/sms-logs", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const [rows] = await pool.query(
      `SELECT sms_id, recipient, message, channel, status, sent_by_user_id, sent_at, created_at
       FROM sms_logs
       WHERE school_id = ? AND is_deleted = 0
       ORDER BY sms_id DESC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/sms-logs", async (req, res, next) => {
  try {
    const { schoolId, userId } = req.user;
    const { recipient, message, channel = "sms", status = "queued" } = req.body;

    if (!recipient || !message) {
      return res.status(400).json({ message: "recipient and message are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_by_user_id, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [schoolId, recipient, message, channel, status, userId]
    );

    res.status(201).json({ smsId: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.patch("/sms-logs/:id/status", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const [result] = await pool.query(
      `UPDATE sms_logs
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE sms_id = ? AND school_id = ?`,
      [status, id, schoolId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "SMS log not found" });
    }

    res.json({ updated: true });
  } catch (err) {
    next(err);
  }
});

export default router;
