import { PayrollPeriodsRepository, PayrollRepository } from '../repositories/HRRepository.js';
import { BaseRepository } from '../BaseRepository.js';

/**
 * HR Service
 * Implements HR and payroll management
 */
export class HRService {
  constructor() {
    this.payrollPeriodsRepository = new PayrollPeriodsRepository();
    this.payrollRepository = new PayrollRepository();
    this.hrStaffRepository = new BaseRepository('hr_staff');
  }

  /**
   * Create payroll period
   */
  async createPayrollPeriod(data, context = {}) {
    return await this.payrollPeriodsRepository.create(data, context);
  }

  /**
   * Set current payroll period
   */
  async setCurrentPayrollPeriod(id, schoolId, context = {}) {
    return await this.payrollPeriodsRepository.setCurrent(id, schoolId);
  }

  /**
   * Create payroll for staff
   */
  async createPayroll(data, context = {}) {
    // Calculate net pay
    const netPay = data.basic_salary + (data.allowances || 0) - (data.deductions || 0) - (data.paye || 0) - (data.nssf || 0) - (data.nhif || 0);

    const payrollData = {
      ...data,
      net_pay: netPay,
      status: 'draft'
    };

    return await this.payrollRepository.create(payrollData, context);
  }

  /**
   * Process payroll
   */
  async processPayroll(payrollId, context = {}) {
    return await this.payrollRepository.processPayroll(payrollId);
  }

  /**
   * Mark payroll as paid
   */
  async markPayrollAsPaid(payrollId, context = {}) {
    return await this.payrollRepository.markAsPaid(payrollId);
  }

  /**
   * Process payroll for period
   */
  async processPayrollForPeriod(payrollPeriodId, context = {}) {
    const currentPeriod = await this.payrollPeriodsRepository.findById(payrollPeriodId);
    if (!currentPeriod) {
      throw new Error('Payroll period not found');
    }

    if (currentPeriod.is_closed) {
      throw new Error('Payroll period is closed');
    }

    // Get all active staff
    const staff = await this.hrStaffRepository.findAll({
      school_id: currentPeriod.school_id,
      employment_status: 'active'
    });

    const createdPayrolls = [];
    for (const employee of staff.data) {
      // Create payroll for each staff member
      // In production, this would calculate based on salary, attendance, etc.
      const payroll = await this.createPayroll({
        school_id: currentPeriod.school_id,
        payroll_period_id: payrollPeriodId,
        staff_id: employee.id,
        basic_salary: employee.basic_salary || 0,
        allowances: 0,
        deductions: 0,
        paye: 0,
        nssf: 0,
        nhif: 0
      }, context);
      createdPayrolls.push(payroll);
    }

    return createdPayrolls;
  }

  /**
   * Get payroll summary for period
   */
  async getPayrollSummary(payrollPeriodId) {
    const payrolls = await this.payrollRepository.findByPeriod(payrollPeriodId);

    const totalBasicSalary = payrolls.reduce((sum, p) => sum + (p.basic_salary || 0), 0);
    const totalAllowances = payrolls.reduce((sum, p) => sum + (p.allowances || 0), 0);
    const totalDeductions = payrolls.reduce((sum, p) => sum + (p.deductions || 0), 0);
    const totalTax = payrolls.reduce((sum, p) => sum + (p.paye || 0), 0);
    const totalNetPay = payrolls.reduce((sum, p) => sum + (p.net_pay || 0), 0);

    return {
      total_staff: payrolls.length,
      total_basic_salary: totalBasicSalary,
      total_allowances: totalAllowances,
      total_deductions: totalDeductions,
      total_tax: totalTax,
      total_net_pay: totalNetPay
    };
  }

  /**
   * Get staff payroll history
   */
  async getStaffPayrollHistory(staffId) {
    return await this.payrollRepository.findByStaff(staffId);
  }
}
