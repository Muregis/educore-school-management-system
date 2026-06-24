import { BaseRepository } from '../BaseRepository.js';

/**
 * Payroll Periods Repository
 */
export class PayrollPeriodsRepository extends BaseRepository {
  constructor() {
    super('payroll_periods');
  }

  async findCurrent(schoolId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async setCurrent(id, schoolId) {
    await this.client
      .from(this.tableName)
      .update({ is_current: false })
      .eq('school_id', schoolId);
    
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ is_current: true })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

/**
 * Payroll Repository
 */
export class PayrollRepository extends BaseRepository {
  constructor() {
    super('payroll');
  }

  async findByPeriod(payrollPeriodId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, hr_staff(*)')
      .eq('payroll_period_id', payrollPeriodId)
      .order('created_at');
    
    if (error) throw error;
    return data || [];
  }

  async findByStaff(staffId) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, payroll_periods(*)')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async processPayroll(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ 
        status: 'processed',
        processed_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async markAsPaid(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({ 
        status: 'paid',
        paid_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}
