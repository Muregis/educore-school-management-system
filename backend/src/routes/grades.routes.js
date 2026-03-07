import { Router } from "express";
import { pool } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
router.use(authRequired);

// placeholder for grading/results endpoints; detailed logic lives in reports.routes.js currently
// we might move or expand here during Sprint 4 (bulk entry, filters, etc.)

export default router;
