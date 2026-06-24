import { ChartOfAccountsRepository, JournalEntriesRepository, JournalEntryLinesRepository } from '../repositories/FinanceRepository.js';

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
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

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
    const accounts = await this.chartOfAccountsRepository.findAll({ school_id: schoolId, is_active: true });
    const lines = await this.journalEntryLinesRepository.findByAccount(schoolId, null, null, asOfDate);

    const trialBalance = accounts.data.map(account => {
      const accountLines = lines.filter(l => l.account_id === account.id);
      const totalDebit = accountLines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const totalCredit = accountLines.reduce((sum, l) => sum + (l.credit || 0), 0);

      let debit = 0;
      let credit = 0;

      if (account.account_type === 'asset' || account.account_type === 'expense') {
        debit = totalDebit - totalCredit;
      } else {
        credit = totalCredit - totalDebit;
      }

      return {
        ...account,
        debit: debit > 0 ? debit : 0,
        credit: credit > 0 ? credit : 0
      };
    });

    const totalDebits = trialBalance.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = trialBalance.reduce((sum, a) => sum + a.credit, 0);

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
    const revenueAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'revenue');
    const expenseAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'expense');

    const revenue = await this.calculateAccountBalances(revenueAccounts, startDate, endDate);
    const expenses = await this.calculateAccountBalances(expenseAccounts, startDate, endDate);

    const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
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

    for (const account of accounts) {
      const lines = await this.journalEntryLinesRepository.findByAccount(
        account.school_id,
        account.id,
        startDate,
        endDate
      );

      const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

      let balance = 0;
      if (account.account_type === 'revenue' || account.account_type === 'liability' || account.account_type === 'equity') {
        balance = totalCredit - totalDebit;
      } else {
        balance = totalDebit - totalCredit;
      }

      result.push({
        ...account,
        balance
      });
    }

    return result;
  }

  /**
   * Get balance sheet
   */
  async getBalanceSheet(schoolId, asOfDate) {
    const assetAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'asset');
    const liabilityAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'liability');
    const equityAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'equity');

    const assets = await this.calculateAccountBalances(assetAccounts, null, asOfDate);
    const liabilities = await this.calculateAccountBalances(liabilityAccounts, null, asOfDate);
    const equity = await this.calculateAccountBalances(equityAccounts, null, asOfDate);

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    // Calculate retained earnings (net income accumulated)
    const revenueAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'revenue');
    const expenseAccounts = await this.chartOfAccountsRepository.findByType(schoolId, 'expense');
    const revenue = await this.calculateAccountBalances(revenueAccounts, null, asOfDate);
    const expenses = await this.calculateAccountBalances(expenseAccounts, null, asOfDate);
    const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
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
    const accounts = accountId 
      ? [await this.chartOfAccountsRepository.findById(accountId)]
      : await this.chartOfAccountsRepository.findAll({ school_id: schoolId, is_active: true });
    
    const accountData = Array.isArray(accounts) ? accounts.data || accounts : [accounts];
    
    const ledger = [];
    
    for (const account of accountData) {
      const lines = await this.journalEntryLinesRepository.findByAccount(
        schoolId,
        account.id,
        startDate,
        endDate
      );
      
      const transactions = lines.map(line => ({
        id: line.id,
        date: line.journal_entries?.entry_date || line.created_at,
        entry_number: line.journal_entries?.entry_number || `JE-${line.journal_entry_id}`,
        description: line.description || line.journal_entries?.description || '',
        debit: line.debit || 0,
        credit: line.credit || 0,
        balance: 0, // Will calculate running balance
        reference_type: line.journal_entries?.reference_type,
        reference_id: line.journal_entries?.reference_id,
      }));
      
      // Calculate running balance
      let runningBalance = 0;
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      transactions.forEach(tx => {
        if (account.account_type === 'asset' || account.account_type === 'expense') {
          runningBalance += tx.debit - tx.credit;
        } else {
          runningBalance += tx.credit - tx.debit;
        }
        tx.balance = runningBalance;
      });
      
      ledger.push({
        account,
        transactions
      });
    }
    
    return {
      ledger,
      total_accounts: ledger.length
    };
  }
}
