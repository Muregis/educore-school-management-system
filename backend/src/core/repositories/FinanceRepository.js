import { BaseRepository } from '../BaseRepository.js';

/**
 * Chart of Accounts Repository
 */
export class ChartOfAccountsRepository extends BaseRepository {
  constructor() {
    super('chart_of_accounts');
  }

  async findByType(schoolId, accountType) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('school_id', schoolId)
      .eq('account_type', accountType)
      .eq('is_active', true)
      .order('account_code');
    
    if (error) throw error;
    return data || [];
  }

  async findByCode(schoolId, accountCode) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('school_id', schoolId)
      .eq('account_code', accountCode)
      .single();
    
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Journal Entries Repository
 */
export class JournalEntriesRepository extends BaseRepository {
  constructor() {
    super('journal_entries');
  }

  async findByDateRange(schoolId, startDate, endDate) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, journal_entry_lines(*, chart_of_accounts(*))')
      .eq('school_id', schoolId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async findByReference(schoolId, referenceType, referenceId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, journal_entry_lines(*)')
      .eq('school_id', schoolId)
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Journal Entry Lines Repository
 */
export class JournalEntryLinesRepository extends BaseRepository {
  constructor() {
    super('journal_entry_lines');
  }

  async findByAccount(schoolId, accountId, startDate, endDate) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, journal_entries(*)')
      .eq('account_id', accountId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    
    if (error) throw error;
    return data || [];
  }
}
