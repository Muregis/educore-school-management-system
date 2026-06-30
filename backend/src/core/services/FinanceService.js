import { ChartOfAccountsRepository, JournalEntriesRepository, JournalEntryLinesRepository } from '../repositories/FinanceRepository.js';
import { getManualExpenditures, getPayrollExpenditures } from '../../services/expenditure.service.js';
import { supabase } from '../../config/supabaseClient.js';

function isOptionalFinanceDataError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01'
    || error?.code === '42703'
    || error?.code === '22P02' // invalid UUID syntax
    || error?.code === 'PGRST205'
    || message.includes('does not exist')
    || message.includes('could not find the table')
    || message.includes('could not find the column')
    || message.includes('invalid input syntax for type uuid');
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
    const expenseCategoryAccounts = [
      {
        id: 'salaries-expense',
        school_id: schoolId,
        account_code: 'OP-5100',
        account_name: 'Salaries Expense',
        account_type: 'expense',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      },
      {
        id: 'utilities-expense',
        school_id: schoolId,
        account_code: 'OP-5200',
        account_name: 'Utilities Expense',
        account_type: 'expense',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      },
      {
        id: 'supplies-expense',
        school_id: schoolId,
        account_code: 'OP-5300',
        account_name: 'Supplies Expense',
        account_type: 'expense',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      },
      {
        id: 'maintenance-expense',
        school_id: schoolId,
        account_code: 'OP-5400',
        account_name: 'Maintenance Expense',
        account_type: 'expense',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      },
      {
        id: 'other-expenses',
        school_id: schoolId,
        account_code: 'OP-5500',
        account_name: 'Other Expenses',
        account_type: 'expense',
        normal_balance: 'debit',
        is_active: true,
        is_system: true,
        source: 'operational'
      }
    ];

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
      },
      ...expenseCategoryAccounts
    ];
  }

  async getAccounts(schoolId, type = null) {
    try {
      let savedResult;
      try {
        if (type) {
          savedResult = await this.chartOfAccountsRepository.findByType(schoolId, type);
        } else {
          const findAllResult = await this.chartOfAccountsRepository.findAll({ school_id: schoolId }, { limit: 1000 });
          savedResult = findAllResult?.data || [];
        }
      } catch (error) {
        if (!isOptionalFinanceDataError(error)) throw error;
        savedResult = [];
      }
      
      const savedAccounts = Array.isArray(savedResult) 
        ? savedResult 
        : [];
        
      const operationalAccounts = this.getOperationalAccounts(schoolId)
        .filter(account => !type || account.account_type === type);

      return [...operationalAccounts, ...savedAccounts];
    } catch (error) {
      console.error('[FinanceService.getAccounts] Error:', error);
      throw error;
    }
  }

  async getOperationalRows(schoolId, startDate = null, endDate = null) {
    try {
      if (!schoolId) return { payments: [], expenditures: [] };

      let paymentsQuery = supabase
        .from('payments')
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
        try {
          const result = await query;
          if (result.error) {
            if (isOptionalFinanceDataError(result.error)) return [];
            throw result.error;
          }
          return result.data || [];
        } catch (error) {
          if (isOptionalFinanceDataError(error)) return [];
          throw error;
        }
      };

      const [paymentsRows, manualExpenditures, payrollExpenditures] = await Promise.all([
        safeQuery(applyDateRange(paymentsQuery, 'payment_date')),
        getManualExpenditures(schoolId),
        getPayrollExpenditures(schoolId)
      ]);
      
      // Filter manual and payroll expenditures by date range
      const filterByDate = (items, dateField) => {
        if (!startDate && !endDate) return items;
        return items.filter(item => {
          const itemDate = item[dateField];
          if (!itemDate) return false;
          let isValid = true;
          if (startDate && itemDate < startDate) isValid = false;
          if (endDate && itemDate > endDate) isValid = false;
          return isValid;
        });
      };

      console.log('[FinanceService.getOperationalRows] Data counts (matching Reports page exactly):', {
        payments: paymentsRows.length,
        manualExpenditures: manualExpenditures.length,
        payrollExpenditures: payrollExpenditures.length,
        paymentsTotal: paymentsRows.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        manualTotal: manualExpenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        payrollTotal: payrollExpenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        paymentMethods: paymentsRows.reduce((acc, p) => {
          const method = (p.payment_method || 'unknown').toLowerCase();
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        }, {}),
        paymentMethodsByAmount: paymentsRows.reduce((acc, p) => {
          const method = (p.payment_method || 'unknown').toLowerCase();
          acc[method] = (acc[method] || 0) + Number(p.amount || 0);
          return acc;
        }, {}),
        dateRange: { startDate, endDate },
        samplePayments: paymentsRows.slice(0, 3).map(p => ({
          amount: p.amount,
          method: p.payment_method,
          status: p.status,
          date: p.payment_date
        }))
      });

      return {
        payments: paymentsRows,
        expenditures: [
          ...filterByDate(manualExpenditures, 'expense_date'),
          ...filterByDate(payrollExpenditures, 'expense_date')
        ]
      };
    } catch (error) {
      console.error('[FinanceService.getOperationalRows] Error:', error);
      throw error;
    }
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

    // Expense category-specific accounts
    const expenseCategoryMap = {
      'salaries-expense': ['Teachers Salary', 'Salary', 'Payroll'],
      'utilities-expense': ['Utilities', 'Water', 'Electricity', 'Internet'],
      'supplies-expense': ['Supplies', 'Stationery', 'Books'],
      'maintenance-expense': ['Maintenance', 'Repairs'],
      'other-expenses': ['Other']
    };

    if (expenseCategoryMap[account.id]) {
      const allowedCategories = expenseCategoryMap[account.id];
      expenditures.forEach(expense => {
        const category = (expense.category || '').toLowerCase();
        const normalizedAllowed = allowedCategories.map(c => c.toLowerCase());
        
        if (normalizedAllowed.some(allowed => category.includes(allowed))) {
          const amount = Number(expense.amount || 0);
          if (amount <= 0) return;
          transactions.push({
            id: `expense-${account.id}-${expense.expenditure_id || expense.id}`,
            transaction_date: expense.expense_date || expense.created_at,
            reference: expense.reference_number || `EXP-${expense.expenditure_id || expense.id}`,
            description: expense.description || expense.purpose || expense.item_name || expense.category || 'Expense',
            debit: amount,
            credit: 0,
            source_type: 'expenditure'
          });
        }
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
    try {
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
    } catch (error) {
      console.error('[FinanceService.applyRunningBalance] Error:', error);
      throw error;
    }
  }

  /**
   * Create chart of account
   */
  async createAccount(data, context = {}) {
    try {
      const existing = await this.chartOfAccountsRepository.findByCode(data.school_id, data.account_code);
      if (existing) {
        throw new Error('Account code already exists');
      }

      return await this.chartOfAccountsRepository.create(data, context);
    } catch (error) {
      console.error('[FinanceService.createAccount] Error:', error);
      throw error;
    }
  }

  /**
   * Create journal entry with balanced lines
   */
  async createJournalEntry(data, context = {}) {
    try {
      const { lines, ...entryData } = data;

      const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Journal entry must balance: debits must equal credits');
      }

      const entry = await this.journalEntriesRepository.create({
        ...entryData,
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: 'posted'
      }, context);

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
    } catch (error) {
      console.error('[FinanceService.createJournalEntry] Error:', error);
      throw error;
    }
  }

  /**
   * Get trial balance
   */
  async getTrialBalance(schoolId, asOfDate) {
    try {
      console.log('[FinanceService.getTrialBalance] Starting for schoolId:', schoolId);
      const accounts = await this.getAccounts(schoolId);
      let lines = [];
      try {
        lines = await this.journalEntryLinesRepository.findByAccount(schoolId, null, null, asOfDate);
      } catch (error) {
        if (!isOptionalFinanceDataError(error)) throw error;
      }

      const trialBalance = accounts.map(account => {
        const accountLines = lines.filter(l => l.account_id === account.id);
        const totalDebit = accountLines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        const totalCredit = accountLines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

        const netDebit = totalDebit - totalCredit;
        
        let debit = 0;
        let credit = 0;

        if (netDebit > 0) {
          debit = netDebit;
        } else if (netDebit < 0) {
          credit = Math.abs(netDebit);
        }

        return {
          ...account,
          debit: Number(debit.toFixed(2)),
          credit: Number(credit.toFixed(2)),
          debit_balance: Number(debit.toFixed(2)),
          credit_balance: Number(credit.toFixed(2))
        };
      });

      // Filter accounts first, then calculate totals from filtered results
      const filteredTrialBalance = trialBalance.filter(acc => acc.debit > 0 || acc.credit > 0);
      const totalDebits = filteredTrialBalance.reduce((sum, acc) => sum + Number(acc.debit || 0), 0);
      const totalCredits = filteredTrialBalance.reduce((sum, acc) => sum + Number(acc.credit || 0), 0);

      console.log('[FinanceService.getTrialBalance] Completed:', { totalDebits, totalCredits });

      return {
        accounts: filteredTrialBalance,
        total_debits: Number(totalDebits.toFixed(2)),
        total_credits: Number(totalCredits.toFixed(2)),
        is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
      };
    } catch (error) {
      console.error('[FinanceService.getTrialBalance] Error:', error);
      throw error;
    }
  }

  /**
   * Get income statement
   */
  async getIncomeStatement(schoolId, startDate, endDate) {
    try {
      console.log('[FinanceService.getIncomeStatement] Starting for schoolId:', schoolId, 'dates:', startDate, endDate);
      
      // Get operational data directly for income statement
      const { payments, expenditures } = await this.getOperationalRows(schoolId, startDate, endDate);
      
      // Break down payments by method for revenue breakdown
      const paymentsByMethod = payments.reduce((acc, p) => {
        const method = (p.payment_method || 'unknown').toLowerCase();
        acc[method] = (acc[method] || 0) + Number(p.amount || 0);
        return acc;
      }, {});
      
      // Break down expenditures by category
      const expendituresByCategory = expenditures.reduce((acc, e) => {
        const category = e.category || 'Other';
        acc[category] = (acc[category] || 0) + Number(e.amount || 0);
        return acc;
      }, {});
      
      const manualExpenditures = expenditures.filter(e => e.source_type === 'manual');
      const payrollExpenditures = expenditures.filter(e => e.source_type === 'payroll');
      
      console.log('[FinanceService.getIncomeStatement] Operational data:', {
        paymentsCount: payments.length,
        expendituresCount: expenditures.length,
        paymentsTotal: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        expendituresTotal: expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        paymentsByMethod,
        expendituresByCategory,
        manualExpendituresTotal: manualExpenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        payrollExpendituresTotal: payrollExpenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0),
      });

      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalExpenses = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const netIncome = totalRevenue - totalExpenses;

      // Build revenue breakdown by payment method
      const revenue = [];
      
      // Add individual payment method revenue lines
      if (paymentsByMethod.cash > 0) {
        revenue.push({
          id: 'cash-revenue',
          school_id: schoolId,
          account_code: 'OP-4100',
          account_name: 'Cash Payments',
          account_type: 'revenue',
          normal_balance: 'credit',
          is_active: true,
          is_system: true,
          source: 'operational',
          balance: paymentsByMethod.cash,
          amount: paymentsByMethod.cash
        });
      }
      
      if (paymentsByMethod.bank_transfer > 0) {
        revenue.push({
          id: 'bank-transfer-revenue',
          school_id: schoolId,
          account_code: 'OP-4200',
          account_name: 'Bank Transfer Payments',
          account_type: 'revenue',
          normal_balance: 'credit',
          is_active: true,
          is_system: true,
          source: 'operational',
          balance: paymentsByMethod.bank_transfer,
          amount: paymentsByMethod.bank_transfer
        });
      }
      
      if (paymentsByMethod.mpesa > 0 || paymentsByMethod.mpesa_manual > 0) {
        const mpesaTotal = (paymentsByMethod.mpesa || 0) + (paymentsByMethod.mpesa_manual || 0);
        revenue.push({
          id: 'mpesa-revenue',
          school_id: schoolId,
          account_code: 'OP-4300',
          account_name: 'M-Pesa Payments',
          account_type: 'revenue',
          normal_balance: 'credit',
          is_active: true,
          is_system: true,
          source: 'operational',
          balance: mpesaTotal,
          amount: mpesaTotal
        });
      }
      
      // Add other payment methods
      Object.keys(paymentsByMethod).forEach(method => {
        if (!['cash', 'bank_transfer', 'mpesa', 'mpesa_manual'].includes(method) && paymentsByMethod[method] > 0) {
          revenue.push({
            id: `other-${method}-revenue`,
            school_id: schoolId,
            account_code: 'OP-4400',
            account_name: `${method.charAt(0).toUpperCase() + method.slice(1)} Payments`,
            account_type: 'revenue',
            normal_balance: 'credit',
            is_active: true,
            is_system: true,
            source: 'operational',
            balance: paymentsByMethod[method],
            amount: paymentsByMethod[method]
          });
        }
      });

      // Build expense breakdown by category
      const expenses = [];
      
      // Add individual expense category lines
      Object.keys(expendituresByCategory).forEach(category => {
        if (expendituresByCategory[category] > 0) {
          expenses.push({
            id: `expense-${category.toLowerCase().replace(/\s+/g, '-')}`,
            school_id: schoolId,
            account_code: 'OP-5100',
            account_name: category,
            account_type: 'expense',
            normal_balance: 'debit',
            is_active: true,
            is_system: true,
            source: 'operational',
            balance: expendituresByCategory[category],
            amount: expendituresByCategory[category]
          });
        }
      });

      console.log('[FinanceService.getIncomeStatement] Completed:', { totalRevenue, totalExpenses, netIncome });

      return {
        revenue,
        expenses,
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_expenses: Number(totalExpenses.toFixed(2)),
        net_income: Number(netIncome.toFixed(2))
      };
    } catch (error) {
      console.error('[FinanceService.getIncomeStatement] Error:', error);
      throw error;
    }
  }

  /**
   * Calculate account balances
   */
  async calculateAccountBalances(accounts, startDate, endDate) {
    try {
      if (!accounts || accounts.length === 0) return [];
      
      const result = [];
      const schoolId = accounts[0]?.school_id;
      const operationalRows = schoolId
        ? await this.getOperationalRows(schoolId, startDate, endDate)
        : { payments: [], expenditures: [] };

      console.log('[FinanceService.calculateAccountBalances] Data received:', {
        schoolId,
        paymentsCount: operationalRows.payments.length,
        expendituresCount: operationalRows.expenditures.length,
        paymentsTotal: operationalRows.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        expendituresTotal: operationalRows.expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0),
      });

      for (const account of accounts) {
        let lines = [];
        // Only query database if account is NOT operational
        if (account.source !== 'operational') {
          try {
            lines = await this.journalEntryLinesRepository.findByAccount(
              account.school_id,
              account.id,
              startDate,
              endDate
            );
          } catch (error) {
            if (!isOptionalFinanceDataError(error)) throw error;
          }
        }

        const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
        const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
        const operationalTransactions = account.source === 'operational'
          ? this.buildOperationalTransactions(account, operationalRows.payments, operationalRows.expenditures)
          : [];
        const operationalDebit = operationalTransactions.reduce((sum, t) => sum + Number(t.debit || 0), 0);
        const operationalCredit = operationalTransactions.reduce((sum, t) => sum + Number(t.credit || 0), 0);

        let balance = 0;
        if (['revenue', 'liability', 'equity'].includes(String(account.account_type).toLowerCase())) {
          balance = (totalCredit + operationalCredit) - (totalDebit + operationalDebit);
        } else {
          balance = (totalDebit + operationalDebit) - (totalCredit + operationalCredit);
        }

        console.log(`[FinanceService.calculateAccountBalances] Account: ${account.account_name}`, {
          accountId: account.id,
          accountType: account.account_type,
          accountSource: account.source,
          journalDebit: totalDebit,
          journalCredit: totalCredit,
          operationalDebit,
          operationalCredit,
          finalBalance: Number(balance.toFixed(2)),
        });

        result.push({
          ...account,
          balance: Number(balance.toFixed(2)),
          amount: Number(balance.toFixed(2))
        });
      }

      return result;
    } catch (error) {
      console.error('[FinanceService.calculateAccountBalances] Error:', error);
      throw error;
    }
  }

  /**
   * Get balance sheet
   */
  async getBalanceSheet(schoolId, asOfDate) {
    try {
      console.log('[FinanceService.getBalanceSheet] Starting for schoolId:', schoolId, 'asOf:', asOfDate);
      
      // Use operational data directly for consistency with Income Statement
      const { payments, expenditures } = await this.getOperationalRows(schoolId, null, asOfDate);
      
      // Calculate cash/bank balance from payments
      const cashBalance = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      // Calculate total expenses from expenditures
      const totalExpenses = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      // Calculate total revenue from payments
      const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      // Build assets from operational data
      const assets = [
        {
          id: 'operating-cash',
          school_id: schoolId,
          account_code: 'OP-1000',
          account_name: 'Cash and Bank',
          account_type: 'asset',
          normal_balance: 'debit',
          is_active: true,
          is_system: true,
          source: 'operational',
          balance: cashBalance,
          amount: cashBalance
        }
      ];
      
      // Build liabilities (empty for now, could add from journal entries later)
      const liabilities = [];
      
      // Calculate retained earnings
      const retainedEarnings = Number((totalRevenue - totalExpenses).toFixed(2));
      
      // Build equity
      const equity = [
        {
          id: 'retained-earnings',
          school_id: schoolId,
          account_code: 'RE-0000',
          account_name: 'Retained Earnings',
          account_type: 'equity',
          normal_balance: 'credit',
          is_active: true,
          is_system: true,
          source: 'calculated',
          balance: retainedEarnings,
          amount: retainedEarnings
        }
      ];
      
      const totalAssets = assets.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const totalLiabilities = liabilities.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const totalEquity = equity.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

      console.log('[FinanceService.getBalanceSheet] Completed:', { totalAssets, totalLiabilities, totalEquity, retainedEarnings });

      return {
        assets,
        liabilities,
        equity,
        total_assets: Number(totalAssets.toFixed(2)),
        total_liabilities: Number(totalLiabilities.toFixed(2)),
        total_equity: Number(totalEquity.toFixed(2)),
        retained_earnings: retainedEarnings,
        is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
      };
    } catch (error) {
      console.error('[FinanceService.getBalanceSheet] Error:', error);
      throw error;
    }
  }

  /**
   * Get general ledger - transaction history by account
   */
  async getGeneralLedger(schoolId, accountId, startDate, endDate) {
    try {
      console.log('[FinanceService.getGeneralLedger] Starting for schoolId:', schoolId, 'accountId:', accountId);
      const allAccounts = await this.getAccounts(schoolId);
      
      let accounts;
      if (accountId) {
        const found = allAccounts.find(acc => acc.id === accountId);
        if (found) {
          accounts = [found];
        } else {
          // Check if it's an operational account first (starts with operating-)
          if (accountId.startsWith('operating-')) {
            // It's an operational account, no need to query DB
            accounts = [];
          } else {
            let dbAccount = null;
            try {
              dbAccount = await this.chartOfAccountsRepository.findById(accountId);
            } catch (error) {
              if (!isOptionalFinanceDataError(error)) throw error;
            }
            accounts = dbAccount ? [dbAccount] : [];
          }
        }
      } else {
        accounts = allAccounts;
      }
      
      if (!accounts || accounts.length === 0) {
        console.log('[FinanceService.getGeneralLedger] No accounts found');
        return { ledger: [], total_accounts: 0 };
      }

      const operationalRows = await this.getOperationalRows(schoolId, startDate, endDate);
      const ledger = [];
      
      for (const account of accounts) {
        if (!account) continue;

        let lines = [];
        // Only query database if account is NOT operational
        if (account.source !== 'operational') {
          try {
            lines = await this.journalEntryLinesRepository.findByAccount(
              schoolId,
              account.id,
              startDate,
              endDate
            );
          } catch (error) {
            if (!isOptionalFinanceDataError(error)) throw error;
          }
        }
        
        const journalTransactions = lines.map(line => ({
          id: line.id,
          transaction_date: line.journal_entries?.entry_date || line.created_at,
          reference: line.journal_entries?.entry_number || `JE-${line.journal_entry_id}`,
          description: line.description || line.journal_entries?.description || '',
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          reference_type: line.journal_entries?.reference_type,
          reference_id: line.journal_entries?.reference_id,
          source_type: 'journal'
        }));

        const operationalTransactions = account.source === 'operational'
          ? this.buildOperationalTransactions(account, operationalRows.payments, operationalRows.expenditures)
          : [];
        
        const transactions = [...journalTransactions, ...operationalTransactions];
        
        transactions.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
        const transactionsWithBalance = this.applyRunningBalance(account, transactions);
        
        ledger.push({
          account,
          transactions: transactionsWithBalance
        });
      }

      console.log('[FinanceService.getGeneralLedger] Completed, found', ledger.length, 'accounts');
      
      return {
        ledger,
        total_accounts: ledger.length
      };
    } catch (error) {
      console.error('[FinanceService.getGeneralLedger] Error:', error);
      throw error;
    }
  }
}
