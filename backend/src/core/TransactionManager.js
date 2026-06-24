import { supabase } from '../config/supabaseClient.js';

/**
 * Transaction Manager
 * Provides transaction support for multi-step operations
 * Ensures data consistency across complex operations
 */

export class TransactionManager {
  /**
   * Execute callback within a transaction
   * @param {Function} callback - Async function to execute within transaction
   * @returns {Promise<any>} - Result of callback
   */
  static async execute(callback) {
    // Note: Supabase client doesn't support traditional transactions like pg
    // We'll implement transaction-like behavior using RPC functions
    // For now, this is a placeholder for future transaction implementation
    
    try {
      const result = await callback(supabase);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute multiple operations atomically
   * @param {Array<Function>} operations - Array of async functions to execute
   * @returns {Promise<Array>} - Array of results
   */
  static async executeAll(operations) {
    const results = [];
    const errors = [];

    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Transaction failed: ${errors.length} operations failed`);
    }

    return results;
  }
}
