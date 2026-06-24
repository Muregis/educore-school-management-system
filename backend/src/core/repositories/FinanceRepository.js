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
      .maybeSingle();
    
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
    let query = this.client
      .from(this.tableName)
      .select('*, journal_entry_lines(*, chart_of_accounts(*))')
      .eq('school_id', schoolId)
      .order('entry_date', { ascending: false });

    if (startDate) {
      query = query.gte('entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []).map(entry => ({
      ...entry,
      lines: entry.journal_entry_lines || []
    }));
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
    let query = this.client
      .from(this.tableName)
      .select('*, journal_entries!inner(*)')
      .eq('journal_entries.school_id', schoolId);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    if (startDate) {
      query = query.gte('journal_entries.entry_date', startDate);
    }

    if (endDate) {
      query = query.lte('journal_entries.entry_date', endDate);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }
}
