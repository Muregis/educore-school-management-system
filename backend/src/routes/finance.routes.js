import { Router } from "express";
import { FinanceService } from "../core/services/FinanceService.js";

const router = Router();
const financeService = new FinanceService();

function isMissingFinanceTable(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === '42703'
    || error?.code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('could not find the column');
}

function handleFinanceError(res, error, emptyResult) {
  console.error('[Finance Error]', error);
  if (isMissingFinanceTable(error)) {
    return res.json(emptyResult);
  }
  res.error('FINANCE_ERROR', error.message || 'Unknown finance error', {}, 500);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function resolveReportPeriod(query) {
  if (query.start_date || query.end_date) {
    return {
      startDate: query.start_date || null,
      endDate: query.end_date || null
    };
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (query.period === 'ytd') {
    return {
      startDate: `${year}-01-01`,
      endDate: formatDate(now)
    };
  }

  if (query.period === 'prev_year') {
    return {
      startDate: `${year - 1}-01-01`,
      endDate: `${year - 1}-12-31`
    };
  }

  if (query.period === 'current') {
    return {
      startDate: formatDate(new Date(Date.UTC(year, month, 1))),
      endDate: formatDate(new Date(Date.UTC(year, month + 1, 0)))
    };
  }

  return {
    startDate: null,
    endDate: null
  };
}

// Create chart of account
router.post("/accounts", async (req, res) => {
  try {
    const data = {
      ...req.body,
      school_id: req.user.schoolId
    };
    const result = await financeService.createAccount(data, { userId: req.user.id });
    res.status(201).json(result);
  } catch (error) {
    res.error('FINANCE_ERROR', error.message, {}, 400);
  }
});

// Get chart of accounts
router.get("/accounts", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { type } = req.query;
    const accounts = await financeService.getAccounts(schoolId, type);
    res.json(accounts);
  } catch (error) {
    handleFinanceError(res, error, []);
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
    res.status(201).json(result);
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
    res.json(entries);
  } catch (error) {
    handleFinanceError(res, error, []);
  }
});

// Get trial balance
router.get("/reports/trial-balance", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { as_of_date } = req.query;
    const result = await financeService.getTrialBalance(schoolId, as_of_date);
    res.json(result);
  } catch (error) {
    handleFinanceError(res, error, { accounts: [], total_debits: 0, total_credits: 0, is_balanced: true });
  }
});

// Get income statement
router.get("/reports/income-statement", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { startDate, endDate } = resolveReportPeriod(req.query);
    const result = await financeService.getIncomeStatement(schoolId, startDate, endDate);
    res.json(result);
  } catch (error) {
    handleFinanceError(res, error, { revenue: [], expenses: [], total_revenue: 0, total_expenses: 0, net_income: 0 });
  }
});

// Get balance sheet
router.get("/reports/balance-sheet", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { as_of_date } = req.query;
    const result = await financeService.getBalanceSheet(schoolId, as_of_date);
    res.json(result);
  } catch (error) {
    handleFinanceError(res, error, { assets: [], liabilities: [], equity: [], total_assets: 0, total_liabilities: 0, total_equity: 0, retained_earnings: 0, is_balanced: true });
  }
});

// Get account ledger for the General Ledger page
router.get("/ledger/account", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { account_id, start_date, end_date } = req.query;
    const result = await financeService.getGeneralLedger(schoolId, account_id, start_date, end_date);
    const ledger = result.ledger?.[0] || { account: null, transactions: [] };
    res.json(ledger);
  } catch (error) {
    handleFinanceError(res, error, { account: null, transactions: [] });
  }
});

// Get general ledger
router.get("/reports/general-ledger", async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { account_id, start_date, end_date } = req.query;
    const result = await financeService.getGeneralLedger(schoolId, account_id, start_date, end_date);
    res.json(result);
  } catch (error) {
    handleFinanceError(res, error, { ledger: [], total_accounts: 0 });
  }
});

export default router;
