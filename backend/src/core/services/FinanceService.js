import { ChartOfAccountsRepository, JournalEntriesRepository, JournalEntryLinesRepository } from '../repositories/FinanceRepository.js';
import { getManualExpenditures, getPayrollExpenditures } from '../../services/expenditure.service.js';
import { supabase } from '../../config/supabaseClient.js';

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
        .eq('status', 'paid')
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

        const netDebit = (totalDebit + operationalDebit) - (totalCredit + operationalCredit);
        
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

      const totalDebits = trialBalance.reduce((sum, acc) => sum + Number(acc.debit || 0), 0);
      const totalCredits = trialBalance.reduce((sum, acc) => sum + Number(acc.credit || 0), 0);

      console.log('[FinanceService.getTrialBalance] Completed:', { totalDebits, totalCredits });

      return {
        accounts: trialBalance.filter(acc => acc.debit > 0 || acc.credit > 0),
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
      const revenueAccounts = await this.getAccounts(schoolId, 'revenue');
      const expenseAccounts = await this.getAccounts(schoolId, 'expense');

      const revenue = await this.calculateAccountBalances(revenueAccounts, startDate, endDate);
      const expenses = await this.calculateAccountBalances(expenseAccounts, startDate, endDate);

      const totalRevenue = revenue.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const totalExpenses = expenses.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const netIncome = totalRevenue - totalExpenses;

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

      for (const account of accounts) {
        let lines = [];
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
      const assetAccounts = await this.getAccounts(schoolId, 'asset');
      const liabilityAccounts = await this.getAccounts(schoolId, 'liability');
      const equityAccounts = await this.getAccounts(schoolId, 'equity');

      const assets = await this.calculateAccountBalances(assetAccounts, null, asOfDate);
      const liabilities = await this.calculateAccountBalances(liabilityAccounts, null, asOfDate);
      const equity = await this.calculateAccountBalances(equityAccounts, null, asOfDate);

      const totalAssets = assets.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const totalLiabilities = liabilities.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const totalEquity = equity.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

      const revenueAccounts = await this.getAccounts(schoolId, 'revenue');
      const expenseAccounts = await this.getAccounts(schoolId, 'expense');
      const revenue = await this.calculateAccountBalances(revenueAccounts, null, asOfDate);
      const expenses = await this.calculateAccountBalances(expenseAccounts, null, asOfDate);
      const totalRevenue = revenue.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const totalExpenses = expenses.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const retainedEarnings = Number((totalRevenue - totalExpenses).toFixed(2));

      const finalTotalEquity = Number((totalEquity + retainedEarnings).toFixed(2));

      console.log('[FinanceService.getBalanceSheet] Completed:', { totalAssets, totalLiabilities, finalTotalEquity, retainedEarnings });

      return {
        assets,
        liabilities,
        equity,
        total_assets: Number(totalAssets.toFixed(2)),
        total_liabilities: Number(totalLiabilities.toFixed(2)),
        total_equity: finalTotalEquity,
        retained_earnings: retainedEarnings,
        is_balanced: Math.abs(totalAssets - (totalLiabilities + finalTotalEquity)) < 0.01
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
          let dbAccount = null;
          try {
            dbAccount = await this.chartOfAccountsRepository.findById(accountId);
          } catch (error) {
            if (!isOptionalFinanceDataError(error)) throw error;
          }
          accounts = dbAccount ? [dbAccount] : [];
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
