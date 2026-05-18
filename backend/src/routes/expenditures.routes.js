import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import {
  getExpenditureSummary,
  getManualExpenditures,
  approveExpenditure,
  rejectExpenditure,
  getExpendituresByStatus,
  getFilteredExpenditures,
  getExpendituresByDateRange,
  getExpendituresByCategory,
  getApprovalStatistics,
  getCategoryAnalytics,
  getMonthlyTrendAnalytics,
} from "../services/expenditure.service.js";

const router = Router();
router.use(authRequired);

const EXPENSE_ROLES = ["admin", "finance", "hr", "director", "superadmin"];

router.get("/", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const rows = await getManualExpenditures(schoolId);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/summary", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const summary = await getExpenditureSummary(schoolId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId, userId, user_id: legacyUserId } = req.user;
    const {
      expenseDate,
      category,
      itemName,
      description,
      amount,
      paymentMethod,
      vendorName,
      paidToName,
      purpose,
      referenceNumber,
      notes,
      mpesaCode,
      receiptUrl,
    } = req.body;

    const numericAmount = Number(amount || 0);
    if (!expenseDate || !category || !itemName || !numericAmount) {
      return res.status(400).json({ message: "expenseDate, category, itemName and amount are required" });
    }

    const { data, error } = await supabase
      .from("expenditures")
      .insert({
        school_id: schoolId,
        expense_date: expenseDate,
        category,
        item_name: itemName,
        description: description || null,
        amount: numericAmount,
        payment_method: paymentMethod || "cash",
        vendor_name: vendorName || null,
        paid_to_name: paidToName || vendorName || null,
        purpose: purpose || itemName,
        reference_number: referenceNumber || null,
        notes: notes || null,
        mpesa_code: mpesaCode || null,
        receipt_url: receiptUrl || null,
        approval_status: "pending",
        created_by: userId || legacyUserId || null,
        released_by_user_id: userId || legacyUserId || null,
        released_by_name: req.user?.name || req.user?.full_name || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      expenseDate,
      category,
      itemName,
      description,
      amount,
      paymentMethod,
      vendorName,
      paidToName,
      purpose,
      referenceNumber,
      notes,
      mpesaCode,
      receiptUrl,
    } = req.body;

    const numericAmount = Number(amount || 0);
    if (!expenseDate || !category || !itemName || !numericAmount) {
      return res.status(400).json({ message: "expenseDate, category, itemName and amount are required" });
    }

    const { data, error } = await supabase
      .from("expenditures")
      .update({
        expense_date: expenseDate,
        category,
        item_name: itemName,
        description: description || null,
        amount: numericAmount,
        payment_method: paymentMethod || "cash",
        vendor_name: vendorName || null,
        paid_to_name: paidToName || vendorName || null,
        purpose: purpose || itemName,
        reference_number: referenceNumber || null,
        notes: notes || null,
        mpesa_code: mpesaCode || null,
        receipt_url: receiptUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("school_id", schoolId)
      .eq("expenditure_id", req.params.id)
      .eq("is_deleted", false)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "Expense not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { error } = await supabase
      .from("expenditures")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("school_id", schoolId)
      .eq("expenditure_id", req.params.id)
      .eq("is_deleted", false);

    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// Approval Workflow Routes

router.post("/:id/approve", requireRoles("admin", "finance", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId, user_id: legacyUserId } = req.user;
    const approverId = userId || legacyUserId;
    const approved = await approveExpenditure(schoolId, req.params.id, approverId);
    res.json(approved);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reject", requireRoles("admin", "finance", "director", "superadmin"), async (req, res, next) => {
  try {
    const { schoolId, userId, user_id: legacyUserId } = req.user;
    const { rejectionReason } = req.body;
    const rejectorId = userId || legacyUserId;
    const rejected = await rejectExpenditure(schoolId, req.params.id, rejectionReason, rejectorId);
    res.json(rejected);
  } catch (err) {
    next(err);
  }
});

// Filtering Routes

router.get("/by-status/:status", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(req.params.status)) {
      return res.status(400).json({ message: "Invalid status. Must be pending, approved, or rejected" });
    }
    const expenses = await getExpendituresByStatus(schoolId, req.params.status);
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.get("/by-category/:category", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const expenses = await getExpendituresByCategory(schoolId, decodeURIComponent(req.params.category));
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.get("/filtered", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const {
      category,
      paymentMethod,
      approvalStatus,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      limit,
      offset,
    } = req.query;

    const filters = {
      category: category ? decodeURIComponent(category) : undefined,
      paymentMethod: paymentMethod ? decodeURIComponent(paymentMethod) : undefined,
      approvalStatus: approvalStatus ? decodeURIComponent(approvalStatus) : undefined,
      startDate,
      endDate,
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      search: search ? decodeURIComponent(search) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };

    const expenses = await getFilteredExpenditures(schoolId, filters);
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

router.get("/date-range/:startDate/:endDate", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const expenses = await getExpendituresByDateRange(schoolId, req.params.startDate, req.params.endDate);
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// Analytics Routes

router.get("/analytics/approval-stats", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const stats = await getApprovalStatistics(schoolId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/category/:startDate/:endDate", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const analytics = await getCategoryAnalytics(schoolId, req.params.startDate, req.params.endDate);
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/monthly-trend", requireRoles(...EXPENSE_ROLES), async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { monthsBack } = req.query;
    const analytics = await getMonthlyTrendAnalytics(schoolId, monthsBack ? Number(monthsBack) : 12);
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

export default router;
