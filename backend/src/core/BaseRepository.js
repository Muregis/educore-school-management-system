import { supabase } from '../config/supabaseClient.js';

/**
 * Base Repository
 * Provides common database operations for all repositories
 * Implements repository pattern for consistent data access
 * Extends existing Supabase usage without breaking current code
 */
export class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.client = supabase;
  }

  /**
   * Find all records with optional filters
   */
  async findAll(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = 'created_at', order = 'asc' } = options;
    
    let query = this.client.from(this.tableName).select('*', { count: 'exact' });
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    // Apply sorting
    query = query.order(sort, { ascending: order === 'asc' });
    
    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  /**
   * Find single record by ID
   */
  async findById(id, options = {}) {
    const { select = '*' } = options;
    
    const { data, error } = await this.client
      .from(this.tableName)
      .select(select)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Find records by field
   */
  async findBy(field, value, options = {}) {
    const { select = '*' } = options;
    
    const { data, error } = await this.client
      .from(this.tableName)
      .select(select)
      .eq(field, value);
    
    if (error) throw error;
    return data || [];
  }

  /**
   * Create new record
   */
  async create(data, context = {}) {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  /**
   * Update record by ID
   */
  async update(id, data, context = {}) {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  /**
   * Soft delete record by ID
   */
  async softDelete(id, deletedBy = null) {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return result;
  }

  /**
   * Hard delete record by ID
   */
  async delete(id) {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }

  /**
   * Count records with optional filters
   */
  async count(filters = {}) {
    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: true });
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    const { count, error } = await query;
    
    if (error) throw error;
    return count || 0;
  }

  /**
   * Check if record exists
   */
  async exists(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('id')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  /**
   * Execute raw SQL query (for complex operations)
   */
  async executeSql(sql, params = []) {
    const { data, error } = await this.client.rpc('execute_sql', {
      sql_query: sql,
      params: params
    });
    
    if (error) throw error;
    return data;
  }
}
