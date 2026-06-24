import { BaseRepository } from '../BaseRepository.js';
import { isMissingTableError } from '../../utils/missingTableError.js';

export class ChartOfAccountsRepository extends BaseRepository {
  constructor() {
    super('chart_of_accounts');
  }

  async findByType(schoolId, accountType) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('school_id', schoolId)
        .eq('account_type', accountType)
        .eq('is_active', true)
        .order('account_code');

      if (error) {
        if (isMissingTableError(error)) return [];
        console.error('[ChartOfAccountsRepository.findByType] Error:', error);
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('[ChartOfAccountsRepository.findByType] Error:', error);
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findByCode(schoolId, accountCode) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('account_code', accountCode)
        .maybeSingle();

      if (error) {
        if (isMissingTableError(error)) return null;
        console.error('[ChartOfAccountsRepository.findByCode] Error:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('[ChartOfAccountsRepository.findByCode] Error:', error);
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async findById(id) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (isMissingTableError(error)) return null;
        console.error('[ChartOfAccountsRepository.findById] Error:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('[ChartOfAccountsRepository.findById] Error:', error);
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }
}

export class JournalEntriesRepository extends BaseRepository {
  constructor() {
    super('journal_entries');
  }

  async findByDateRange(schoolId, startDate, endDate) {
    try {
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

      if (error) {
        if (isMissingTableError(error)) return [];
        console.error('[JournalEntriesRepository.findByDateRange] Error:', error);
        throw error;
      }
      return (data || []).map(entry => ({
        ...entry,
        lines: entry.journal_entry_lines || [],
        journal_entry_lines: entry.journal_entry_lines || []
      }));
    } catch (error) {
      console.error('[JournalEntriesRepository.findByDateRange] Error:', error);
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findByReference(schoolId, referenceType, referenceId) {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*, journal_entry_lines(*)')
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .single();

      if (error) {
        if (isMissingTableError(error)) return null;
        console.error('[JournalEntriesRepository.findByReference] Error:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('[JournalEntriesRepository.findByReference] Error:', error);
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }
}

export class JournalEntryLinesRepository extends BaseRepository {
  constructor() {
    super('journal_entry_lines');
  }

  async findByAccount(schoolId, accountId, startDate, endDate) {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*, journal_entries(*)')
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

      if (error) {
        if (isMissingTableError(error)) return [];
        console.error('[JournalEntryLinesRepository.findByAccount] Error:', error);
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('[JournalEntryLinesRepository.findByAccount] Error:', error);
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }
}
