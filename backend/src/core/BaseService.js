/**
 * Base Service
 * Provides common business logic operations for all services
 * Implements service layer pattern for consistent business logic
 * Extends existing service pattern without breaking current code
 */
export class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Find all records with optional filters
   */
  async findAll(filters = {}, options = {}) {
    return await this.repository.findAll(filters, options);
  }

  /**
   * Find single record by ID
   */
  async findById(id, options = {}) {
    const record = await this.repository.findById(id, options);
    if (!record) {
      throw new Error(`${this.repository.tableName} not found`);
    }
    return record;
  }

  /**
   * Create new record
   */
  async create(data, context = {}) {
    const enrichedData = {
      ...data,
      created_at: new Date().toISOString(),
      created_by: context.userId || null,
      updated_at: new Date().toISOString(),
      updated_by: context.userId || null
    };
    
    return await this.repository.create(enrichedData);
  }

  /**
   * Update record by ID
   */
  async update(id, data, context = {}) {
    const enrichedData = {
      ...data,
      updated_at: new Date().toISOString(),
      updated_by: context.userId || null
    };
    
    const record = await this.repository.update(id, enrichedData);
    return record;
  }

  /**
   * Soft delete record by ID
   */
  async softDelete(id, context = {}) {
    return await this.repository.softDelete(id, context.userId);
  }

  /**
   * Hard delete record by ID
   */
  async delete(id) {
    return await this.repository.delete(id);
  }

  /**
   * Count records
   */
  async count(filters = {}) {
    return await this.repository.count(filters);
  }
}
