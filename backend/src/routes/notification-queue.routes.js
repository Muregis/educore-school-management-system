import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { NotificationService } from "../services/NotificationService.js";

const router = Router();
router.use(authRequired);

/**
 * POST /api/notifications/queue - Queue a notification
 */
router.post("/queue", requireRoles("admin", "finance", "director"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { recipientType, message, channel = "sms", scheduledAt, metadata } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }
    
    const notification = await NotificationService.queueNotification(schoolId, {
      recipientType,
      message,
      channel,
      scheduledAt,
      metadata
    });
    
    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/fee-reminder - Send fee reminder
 */
router.post("/fee-reminder", requireRoles("admin", "finance", "director"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId, amount, channel = "sms" } = req.body;
    
    if (!studentId || !amount) {
      return res.status(400).json({ 
        message: "studentId and amount are required" 
      });
    }
    
    const result = await NotificationService.sendFeeReminder(
      schoolId,
      studentId,
      amount,
      channel
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/bulk-fee-reminders - Send bulk fee reminders
 */
router.post("/bulk-fee-reminders", requireRoles("admin", "finance", "director"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { minBalance = 100, channel = "sms", dryRun = false } = req.body;
    
    const result = await NotificationService.sendBulkFeeReminders(
      schoolId,
      { minBalance, channel, dryRun }
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifications/queue - List queued notifications
 */
router.get("/queue", requireRoles("admin", "finance", "director"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { status = "pending", limit = 50 } = req.query;
    
    const { data: notifications, error } = await require("../config/db.js").database
      .from("notification_queue")
      .select("*")
      .eq("school_id", schoolId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(Number(limit));
    
    if (error) throw error;
    
    res.json(notifications || []);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/process-queue - Process pending notifications
 */
router.post("/process-queue", requireRoles("admin", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { limit = 50 } = req.body;
    
    const result = await NotificationService.processNotificationQueue(
      schoolId,
      limit
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifications/students-with-balances - Get students with outstanding balances
 */
router.get("/students-with-balances", requireRoles("admin", "finance", "director"), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { minBalance = 100 } = req.query;
    
    const students = await NotificationService.getStudentsWithOutstandingBalances(
      schoolId,
      minBalance
    );
    
    res.json(students);
  } catch (err) {
    next(err);
  }
});

export default router;
