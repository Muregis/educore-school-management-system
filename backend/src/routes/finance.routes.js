import { Router } from "express";
import { FinanceService } from "../core/services/FinanceService.js";

const router = Router();
const financeService = new FinanceService();

// Create chart of account
router.post("/accounts", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await financeService.createAccount(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 400);
  }
});

// Get chart of accounts
router.get("/accounts", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { type } = req.query;
    const accounts = type 
      ? await financeService.chartOfAccountsRepository.findByType(schoolId, type)
      : await financeService.chartOfAccountsRepository.findAll({ school_id: schoolId });
    res.success(accounts);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 500);
  }
});

// Create journal entry
router.post("/journal-entries", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await financeService.createJournalEntry(data, { userId: req.user.id });
    res.success(result, {}, 201);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 400);
  }
});

// Get journal entries
router.get("/journal-entries", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { start_date, end_date } = req.query;
    const entries = await financeService.journalEntriesRepository.findByDateRange(schoolId, start_date, end_date);
    res.success(entries);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 500);
  }
});

// Get trial balance
router.get("/reports/trial-balance", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { as_of_date } = req.query;
    const result = await financeService.getTrialBalance(schoolId, as_of_date);
    res.success(result);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 500);
  }
});

// Get income statement
router.get("/reports/income-statement", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { start_date, end_date } = req.query;
    const result = await financeService.getIncomeStatement(schoolId, start_date, end_date);
    res.success(result);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 500);
  }
});

export default router;
