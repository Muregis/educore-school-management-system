import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";

const router = Router();
router.use(authRequired);

router.get("/routes", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
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

    const { data: inserted, error } = await supabase
      .from('transport_routes')
      .insert({
        school_id: schoolId,
        route_name: routeName,
        driver_name: driverName,
        vehicle_number: vehicleNumber,
        fee,
        status
      })
      .select('transport_id')
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: "Route name already exists for this school" });
      }
      throw error;
    }

    res.status(201).json({ transportId: inserted.transport_id });
  } catch (err) {
    next(err);
  }
});

router.get("/assignments", async (req, res, next) => {
  try {
    const { schoolId } = req.user;
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

    const { data: inserted, error } = await supabase
      .from('student_transport')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        transport_id: transportId,
        start_date: startDate,
        end_date: endDate,
        status
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: "Student already assigned to this route on that date" });
      }
      throw error;
    }

    res.status(201).json({ assignmentId: inserted.id });
  } catch (err) {
    next(err);
  }
});

export default router;
