import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();

function parseCsvRows(csvText) {
  const lines = String(csvText || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i]; });
    return obj;
  });
}

// Public Mpesa callback (no auth)
router.post("/mpesa/callback", async (req, res, next) => {
  try {
    const body = req.body || {};
    const schoolId = Number(body.schoolId || 1);
    const referenceNumber = body.TransID || body.referenceNumber;
    const amount = Number(body.TransAmount || body.amount || 0);
    const msisdn = body.MSISDN || body.phone || null;
    const billRef = body.BillRefNumber || body.admissionNumber || null;
    const transTime = String(body.TransTime || "");

    let paymentDate = new Date().toISOString().slice(0, 10);
    if (/^\d{14}$/.test(transTime)) {
      paymentDate = `${transTime.slice(0, 4)}-${transTime.slice(4, 6)}-${transTime.slice(6, 8)}`;
    }

    let studentId = null;
    if (billRef) {
      const [studentRows] = await pool.query(
        `SELECT student_id FROM students WHERE school_id = ? AND admission_number = ? AND is_deleted = 0 LIMIT 1`,
        [schoolId, billRef]
      );
      if (studentRows.length) studentId = studentRows[0].student_id;
    }

    const [result] = await pool.query(
      `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term)
       VALUES (?, ?, ?, 'tuition', 'mpesa', ?, ?, 'paid', 'Term 2')`,
      [schoolId, studentId, amount, referenceNumber, paymentDate]
    );

    await pool.query(
      `INSERT INTO sms_logs (school_id, recipient, message, channel, status, sent_at)
       VALUES (?, ?, ?, 'sms', 'sent', NOW())`,
      [schoolId, msisdn || "unknown", `Mpesa payment received: ${amount} (ref: ${referenceNumber})`]
    );

    res.json({ ok: true, paymentId: result.insertId });
  } catch (err) {
    next(err);
  }
});

// Bank reconciliation (admin/finance only)
router.post("/bank/reconcile", authRequired, requireRoles("admin", "finance"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : parseCsvRows(req.body?.csvText);

    if (!rows.length) {
      return res.status(400).json({ message: "No reconciliation rows provided" });
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const admission = row.admission_number || row.admissionNumber;
      const amount = Number(row.amount || 0);
      const reference = row.reference_number || row.referenceNumber || row.ref || null;
      const paymentDate = row.payment_date || row.paymentDate || new Date().toISOString().slice(0, 10);
      const feeType = row.fee_type || row.feeType || "tuition";
      const term = row.term || "Term 2";

      if (!admission || !amount) { skipped++; continue; }

      const [studentRows] = await pool.query(
        `SELECT student_id FROM students WHERE school_id = ? AND admission_number = ? AND is_deleted = 0 LIMIT 1`,
        [schoolId, admission]
      );

      if (!studentRows.length) { skipped++; continue; }

      await pool.query(
        `INSERT INTO payments (school_id, student_id, amount, fee_type, payment_method, reference_number, payment_date, status, term)
         VALUES (?, ?, ?, ?, 'bank', ?, ?, 'paid', ?)`,
        [schoolId, studentRows[0].student_id, amount, feeType, reference, paymentDate, term]
      );
      inserted++;
    }

    res.json({ ok: true, inserted, skipped, total: rows.length });
  } catch (err) {
    next(err);
  }
});

export default router;