import { Router } from "express";
import { supabase } from "../config/supabaseClient.js";
import { authRequired } from "../middleware/auth.js";
import { requireRoles } from "../middleware/roles.js";
import { getExpenditureSummary, getManualExpenditures } from "../services/expenditure.service.js";

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

export default router;
