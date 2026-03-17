import { Router } from "express";
import { pgPool } from "../config/pg.js";
import { supabase } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/routes", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    // OLD: const [rows] = await pool.query(
    // OLD:   `SELECT transport_id, route_name, driver_name, vehicle_number, fee, status
    // OLD:    FROM transport_routes
    // OLD:    WHERE school_id = ? AND is_deleted = 0
    // OLD:    ORDER BY transport_id DESC`,
    // OLD:   [schoolId]
    // OLD: );
    const { data: rows, error } = await supabase
      .from("transport_routes")
      .select("transport_id, route_name, driver_name, vehicle_number, fee, status")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("transport_id", { ascending: false });
    if (error) throw error;
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

router.post("/routes", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { routeName, driverName = null, vehicleNumber = null, fee = 0, status = "active" } = req.body;

    if (!routeName) {
      return res.status(400).json({ message: "routeName is required" });
    }

    const { rows } = await pgPool.query(
      `INSERT INTO transport_routes (school_id, route_name, driver_name, vehicle_number, fee, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [schoolId, routeName, driverName, vehicleNumber, fee, status]
    );

    res.status(201).json({ transportId: rows[0].id });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Route name already exists for this school" });
    }
    next(err);
  }
});

router.get("/assignments", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    // OLD: const { rows } = await pgPool.query(
    // OLD:   `SELECT id, student_id, transport_id, start_date, end_date, status
    // OLD:    FROM student_transport
    // OLD:    WHERE school_id = $1 AND is_deleted = false
    // OLD:    ORDER BY id DESC`,
    // OLD:   [schoolId]
    // OLD: );
    // OLD: res.json(rows);

    const { data: rows, error } = await supabase
      .from("student_transport")
      .select("id, student_id, transport_id, start_date, end_date, status")
      .eq("school_id", schoolId)
      .eq("is_deleted", false)
      .order("id", { ascending: false });
    if (error) throw error;
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

router.post("/assignments", requireRoles("admin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, transportId, startDate, endDate = null, status = "active" } = req.body;

    if (!studentId || !transportId || !startDate) {
      return res.status(400).json({ message: "studentId, transportId, startDate are required" });
    }

    const { rows } = await pgPool.query(
      `INSERT INTO student_transport (school_id, student_id, transport_id, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [schoolId, studentId, transportId, startDate, endDate, status]
    );

    res.status(201).json({ assignmentId: rows[0].id });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Student already assigned to this route on that date" });
    }
    next(err);
  }
});

export default router;
