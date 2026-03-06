import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

router.get("/health", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, dbTime: rows[0].now });
  } catch (err) {
    next(err);
  }
});

export default router;
