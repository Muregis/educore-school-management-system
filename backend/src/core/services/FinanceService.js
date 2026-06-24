import { ChartOfAccountsRepository, JournalEntriesRepository, JournalEntryLinesRepository } from '../repositories/FinanceRepository.js';

function isOptionalFinanceDataError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === '42703'
    || error?.code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('could not find the column');
}

/**
 * Finance Service
 * Implements enterprise-grade accounting functionality
 */
export class FinanceService {
  constructor() {
    this.chartOfAccountsRepository = new ChartOfAccountsRepository();
    this.journalEntriesRepository = new JournalEntriesRepository();
    this.journalEntryLinesRepository = new JournalEntryLinesRepository();
  }

  getOperationalAccounts(schoolId) {
    return [
      {
        id: 'operating-cash',
        school_id: schoolId,
        account_code: 'OP-1000',
        account_name: 'Cash and Bank',
        account_type: 'asset',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      },
      {
        id: 'fee-revenue',
        school_id: schoolId,
        account_code: 'OP-4000',
        account_name: 'Fee Revenue',
        account_type: 'revenue',
        normal_balance: 'credit',
        is_active: true,
        is_system: true,
        source: 'operational'
      },
      {
        id: 'operating-expenses',
        school_id: schoolId,
        account_code: 'OP-5000',
        account_name: 'Operating Expenses',
        account_type: 'expense',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      }
    ];
  }

  async getAccounts(schoolId, type = null) {
    let savedResult;
    try {
      savedResult = type
        ? await this.chartOfAccountsRepository.findByType(schoolId, type)
        : await this.chartOfAccountsRepository.findAll({ school_id: schoolId });
    } catch (error) {
      if (!isOptionalFinanceDataError(error)) throw error;
      savedResult = [];
    }
    const savedAccounts = Array.isArray(savedResult) ? savedResult : savedResult.data || [];
    const operationalAccounts = this.getOperationalAccounts(schoolId)
      .filter(account => !type || account.account_type === type);

    return [...operationalAccounts, ...savedAccounts];
  }

  async getOperationalRows(schoolId, startDate = null, endDate = null) {
    const paymentsQuery = this.chartOfAccountsRepository.client
      .from('payments')
      .select('*')
      .eq('school_id', schoolId);

    const expendituresQuery = this.chartOfAccountsRepository.client
      .from('expenditures')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_deleted', false);

    const applyDateRange = (query, column) => {
      let scopedQuery = query;
      if (startDate) scopedQuery = scopedQuery.gte(column, startDate);
      if (endDate) scopedQuery = scopedQuery.lte(column, endDate);
      return scopedQuery;
    };

    const safeQuery = async (query) => {
      const result = await query;
      if (result.error) {
        if (isOptionalFinanceDataError(result.error)) return [];
        throw result.error;
      }
      return result.data || [];
    };

    const [paymentsRows, expendituresRows] = await Promise.all([
      safeQuery(applyDateRange(paymentsQuery, 'payment_date')),
      safeQuery(applyDateRange(expendituresQuery, 'expense_date'))
    ]);

    const paidStatuses = new Set(['paid', 'completed', 'success', 'successful']);

    return {
      payments: paymentsRows.filter(payment => (
        !payment.status || paidStatuses.has(String(payment.status).toLowerCase())
      )),
      expenditures: expendituresRows
    };
  }

  buildOperationalTransactions(account, payments, expenditures) {
    const transactions = [];

    if (!account || account.id === 'operating-cash') {
      payments.forEach(payment => {
        const amount = Number(payment.amount || 0);
        if (amount <= 0) return;
        transactions.push({
          id: `payment-cash-${payment.payment_id || payment.id}`,
          transaction_date: payment.payment_date || payment.created_at,
          reference: payment.receipt_number || payment.reference_number || payment.mpesa_receipt_number || `PAY-${payment.payment_id || payment.id}`,
          description: `Payment received${payment.paid_by ? ` from ${payment.paid_by}` : ''}`,
          debit: amount,
          credit: 0,
          source_type: 'payment'
        });
      });

      expenditures.forEach(expense => {
        const amount = Number(expense.amount || 0);
        if (amount <= 0) return;
        transactions.push({
          id: `expense-cash-${expense.expenditure_id || expense.id}`,
          transaction_date: expense.expense_date || expense.created_at,
          reference: expense.reference_number || `EXP-${expense.expenditure_id || expense.id}`,
          description: expense.description || expense.purpose || expense.item_name || expense.category || 'Expense paid',
          debit: 0,
          credit: amount,
          source_type: 'expenditure'
        });
      });
    }

    if (!account || account.id === 'fee-revenue') {
      payments.forEach(payment => {
        const amount = Number(payment.amount || 0);
        if (amount <= 0) return;
        transactions.push({
          id: `payment-revenue-${payment.payment_id || payment.id}`,
          transaction_date: payment.payment_date || payment.created_at,
          reference: payment.receipt_number || payment.reference_number || payment.mpesa_receipt_number || `PAY-${payment.payment_id || payment.id}`,
          description: `Fee payment${payment.paid_by ? ` from ${payment.paid_by}` : ''}`,
          debit: 0,
          credit: amount,
          source_type: 'payment'
        });
      });
    }

    if (!account || account.id === 'operating-expenses') {
      expenditures.forEach(expense => {
        const amount = Number(expense.amount || 0);
        if (amount <= 0) return;
        transactions.push({
          id: `expense-${expense.expenditure_id || expense.id}`,
          transaction_date: expense.expense_date || expense.created_at,
          reference: expense.reference_number || `EXP-${expense.expenditure_id || expense.id}`,
          description: expense.description || expense.purpose || expense.item_name || expense.category || 'Expense',
          debit: amount,
          credit: 0,
          source_type: 'expenditure'
        });
      });
    }

    transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
    return transactions;
  }

  applyRunningBalance(account, transactions) {
    let runningBalance = 0;
    return transactions.map(tx => {
      if (account.account_type === 'asset' || account.account_type === 'expense') {
        runningBalance += Number(tx.debit || 0) - Number(tx.credit || 0);
      } else {
        runningBalance += Number(tx.credit || 0) - Number(tx.debit || 0);
      }

      return {
        ...tx,
        running_balance: runningBalance,
        balance: runningBalance
      };
    });
  }

  /**
   * Create chart of account
   */
  async createAccount(data, context = {}) {
    // Validate account code uniqueness
    const existing = await this.chartOfAccountsRepository.findByCode(data.school_id, data.account_code);
    if (existing) {
      throw new Error('Account code already exists');
    }

    return await this.chartOfAccountsRepository.create(data, context);
  }

  /**
   * Create journal entry with balanced lines
   */
  async createJournalEntry(data, context = {}) {
    const { lines, ...entryData } = data;

    // Validate debits equal credits
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('Journal entry must balance: debits must equal credits');
    }

    // Create journal entry
    const entry = await this.journalEntriesRepository.create({
      ...entryData,
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: 'posted'
    }, context);

    // Create journal entry lines
    for (const line of lines) {
      await this.journalEntryLinesRepository.create({
        journal_entry_id: entry.id,
        account_id: line.account_id,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description,
        line_number: line.line_number
      }, context);
    }

    return entry;
  }

  /**
   * Get trial balance
   */
  async getTrialBalance(schoolId, asOfDate) {
    const accounts = await this.getAccounts(schoolId);
    const lines = await this.journalEntryLinesRepository.findByAccount(schoolId, null, null, asOfDate);
    const { payments, expenditures } = await this.getOperationalRows(schoolId, null, asOfDate);

    const trialBalance = accounts.map(account => {
      const accountLines = lines.filter(l => l.account_id === account.id);
      const totalDebit = accountLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredit = accountLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
      const operationalTransactions = account.source === 'operational'
        ? this.buildOperationalTransactions(account, payments, expenditures)
        : [];
      const operationalDebit = operationalTransactions.reduce((sum, t) => sum + Number(t.debit || 0), 0);
      const operationalCredit = operationalTransactions.reduce((sum, t) => sum + Number(t.credit || 0), 0);

      let debit = 0;
      let credit = 0;

      if (account.account_type === 'asset' || account.account_type === 'expense') {
        debit = totalDebit + operationalDebit - totalCredit - operationalCredit;
      } else {
        credit = totalCredit + operationalCredit - totalDebit - operationalDebit;
      }

      return {
        ...account,
        debit: debit > 0 ? debit : 0,
        credit: credit > 0 ? credit : 0,
        debit_balance: debit > 0 ? debit : 0,
        credit_balance: credit > 0 ? credit : 0
      };
    });

    const totalDebits = trialBalance.reduce((sum, a) => sum + Number(a.debit || 0), 0);
    const totalCredits = trialBalance.reduce((sum, a) => sum + Number(a.credit || 0), 0);

    return {
      accounts: trialBalance,
      total_debits: totalDebits,
      total_credits: totalCredits,
      is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
    };
  }

  /**
   * Get income statement
   */
  async getIncomeStatement(schoolId, startDate, endDate) {
    const revenueAccounts = await this.getAccounts(schoolId, 'revenue');
    const expenseAccounts = await this.getAccounts(schoolId, 'expense');

    const revenue = await this.calculateAccountBalances(revenueAccounts, startDate, endDate);
    const expenses = await this.calculateAccountBalances(expenseAccounts, startDate, endDate);

    const totalRevenue = revenue.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenue,
      expenses,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome
    };
  }

  /**
   * Calculate account balances
   */
  async calculateAccountBalances(accounts, startDate, endDate) {
    const result = [];
    const schoolId = accounts[0]?.school_id;
    const operationalRows = schoolId
      ? await this.getOperationalRows(schoolId, startDate, endDate)
      : { payments: [], expenditures: [] };

    for (const account of accounts) {
      const lines = await this.journalEntryLinesRepository.findByAccount(
        account.school_id,
        account.id,
        startDate,
        endDate
      );

      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
      const operationalTransactions = account.source === 'operational'
        ? this.buildOperationalTransactions(account, operationalRows.payments, operationalRows.expenditures)
        : [];
      const operationalDebit = operationalTransactions.reduce((sum, t) => sum + Number(t.debit || 0), 0);
      const operationalCredit = operationalTransactions.reduce((sum, t) => sum + Number(t.credit || 0), 0);

      let balance = 0;
      if (account.account_type === 'revenue' || account.account_type === 'liability' || account.account_type === 'equity') {
        balance = totalCredit + operationalCredit - totalDebit - operationalDebit;
      } else {
        balance = totalDebit + operationalDebit - totalCredit - operationalCredit;
      }

      result.push({
        ...account,
        balance,
        amount: balance
      });
    }

    return result;
  }

  /**
   * Get balance sheet
   */
  async getBalanceSheet(schoolId, asOfDate) {
    const assetAccounts = await this.getAccounts(schoolId, 'asset');
    const liabilityAccounts = await this.getAccounts(schoolId, 'liability');
    const equityAccounts = await this.getAccounts(schoolId, 'equity');

    const assets = await this.calculateAccountBalances(assetAccounts, null, asOfDate);
    const liabilities = await this.calculateAccountBalances(liabilityAccounts, null, asOfDate);
    const equity = await this.calculateAccountBalances(equityAccounts, null, asOfDate);

    const totalAssets = assets.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalEquity = equity.reduce((sum, a) => sum + Number(a.balance || 0), 0);

    // Calculate retained earnings (net income accumulated)
    const revenueAccounts = await this.getAccounts(schoolId, 'revenue');
    const expenseAccounts = await this.getAccounts(schoolId, 'expense');
    const revenue = await this.calculateAccountBalances(revenueAccounts, null, asOfDate);
    const expenses = await this.calculateAccountBalances(expenseAccounts, null, asOfDate);
    const totalRevenue = revenue.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const retainedEarnings = totalRevenue - totalExpenses;

    return {
      assets,
      liabilities,
      equity,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity + retainedEarnings,
      retained_earnings: retainedEarnings,
      is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + retainedEarnings)) < 0.01
    };
  }

  /**
   * Get general ledger - transaction history by account
   */
  async getGeneralLedger(schoolId, accountId, startDate, endDate) {
    const allAccounts = await this.getAccounts(schoolId);
    const accounts = accountId
      ? [allAccounts.find(account => account.id === accountId) || await this.chartOfAccountsRepository.findById(accountId)].filter(Boolean)
      : allAccounts;
    
    const accountData = Array.isArray(accounts) ? accounts.data || accounts : [accounts];
    const operationalRows = await this.getOperationalRows(schoolId, startDate, endDate);
    
    const ledger = [];
    
    for (const account of accountData) {
      const lines = await this.journalEntryLinesRepository.findByAccount(
        schoolId,
        account.id,
        startDate,
        endDate
      );
      
      const journalTransactions = lines.map(line => ({
        id: line.id,
        transaction_date: line.journal_entries?.entry_date || line.created_at,
        reference: line.journal_entries?.entry_number || `JE-${line.journal_entry_id}`,
        description: line.description || line.journal_entries?.description || '',
        debit: line.debit || 0,
        credit: line.credit || 0,
        reference_type: line.journal_entries?.reference_type,
        reference_id: line.journal_entries?.reference_id,
        source_type: 'journal'
      }));
      const operationalTransactions = account.source === 'operational'
        ? this.buildOperationalTransactions(account, operationalRows.payments, operationalRows.expenditures)
        : [];
      const transactions = [...journalTransactions, ...operationalTransactions];
      
      // Calculate running balance
      transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
      const transactionsWithBalance = this.applyRunningBalance(account, transactions);
      
      ledger.push({
        account,
        transactions: transactionsWithBalance
      });
    }
    
    return {
      ledger,
      total_accounts: ledger.length
    };
  }
}
