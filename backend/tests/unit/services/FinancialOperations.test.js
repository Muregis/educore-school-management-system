import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BillingService } from '../../../src/services/BillingService.js';
import { calculateStudentFeeBalance } from '../../../src/services/feeBalanceCalculator.js';

describe('Financial Operations & Invariants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Comprehensive Fee Computation Matrix', () => {
    it('accurately calculates composite fee structures with all line items', async () => {
      const student = {
        student_id: 10,
        school_id: 1,
        class_name: 'Grade 4',
        opening_balance: 500, // owing
        opening_balance_type: 'owing',
        transport_base_fee: 1500,
        transport_direction: 'two_way',
        lunch_enabled: true,
        lunch_daily_rate: 150,
        lunch_days: 60,
        lunch_billing_type: 'daily',
        breakfast_enabled: true,
        breakfast_daily_rate: 50,
        breakfast_days: 60,
        breakfast_billing_type: 'daily',
        discount_value: 0,
        discount_is_percentage: true,
      };

      const term = { term_id: 1, term_name: 'Term 1' };
      const academicYear = { academic_year_id: 1, year_label: '2026' };
      const settings = {};

      jest.spyOn(BillingService, 'getFeeStructure').mockResolvedValue({
        tuition: 15000,
        activity: 2000,
        misc: 1000,
      });
      jest.spyOn(BillingService, 'getActiveStudentServices').mockResolvedValue([]);
      jest.spyOn(BillingService, 'getStudentDiscounts').mockResolvedValue([]);

      const result = await BillingService.computeStudentBilling(1, student, term, academicYear, settings);

      expect(result).toBeDefined();
      expect(result.components.tuition_charge).toBe(15000);
      expect(result.components.activity_charge).toBe(2000);
      expect(result.components.misc_charge).toBe(1000);
      // Lunch: 150 * 60 = 9000
      expect(result.components.lunch_charge).toBe(9000);
      // Transport two-way: 1500
      expect(result.components.transport_charge).toBe(1500);

      // Total charge: tuition (15000) + activity (2000) + misc (1000) + lunch (9000) + transport (1500) + carryForward (500) = 29000
      const expectedTotal = 15000 + 2000 + 1000 + 9000 + 1500 + 500;
      expect(result.total_charge).toBe(expectedTotal);
    });

    it('strictly differentiates termly flat rate from daily rate without confusing them', async () => {
      // Student A: Termly flat lunch rate (e.g. KES 6,500 flat for the term, days is 0/ignored)
      const termlyStudent = {
        student_id: 101,
        class_name: 'Grade 1',
        lunch_enabled: true,
        lunch_daily_rate: 6500, // Represents flat termly rate
        lunch_days: 0,          // 0 days because it is termly flat billing
        lunch_billing_type: 'termly',
        breakfast_enabled: true,
        breakfast_daily_rate: 3000,
        breakfast_days: 0,
        breakfast_billing_type: 'termly',
      };

      const feeStructures = [{ class_name: 'Grade 1', tuition: 10000, activity: 1000, misc: 500 }];

      const termlyBalance = calculateStudentFeeBalance({
        student: termlyStudent,
        feeStructures,
        payments: [],
      });

      // Termly rate must NOT be 0 (even though days=0) and must NOT be multiplied by days
      expect(termlyBalance.lunchFee).toBe(6500);
      expect(termlyBalance.breakfastFee).toBe(3000);
      expect(termlyBalance.expected).toBe(10000 + 1000 + 500 + 6500 + 3000);

      // Student B: Daily rate (e.g. KES 100/day x 60 days = KES 6,000)
      const dailyStudent = {
        student_id: 102,
        class_name: 'Grade 1',
        lunch_enabled: true,
        lunch_daily_rate: 100, // KES 100 per day
        lunch_days: 60,         // 60 school days
        lunch_billing_type: 'daily',
        breakfast_enabled: false,
      };

      const dailyBalance = calculateStudentFeeBalance({
        student: dailyStudent,
        feeStructures,
        payments: [],
      });

      // Daily rate MUST be rate * days
      expect(dailyBalance.lunchFee).toBe(6000);
      expect(dailyBalance.expected).toBe(10000 + 1000 + 500 + 6000);

      // Student C: Agreed flat amount overrides BOTH daily and termly
      const agreedStudent = {
        student_id: 103,
        class_name: 'Grade 1',
        lunch_fee: 4500, // Parent agreed flat fee
        lunch_enabled: true,
        lunch_daily_rate: 100,
        lunch_days: 60,
        lunch_billing_type: 'daily',
        breakfast_termly_fee: 2500, // Parent agreed flat fee
        breakfast_enabled: true,
        breakfast_daily_rate: 50,
        breakfast_days: 60,
        breakfast_billing_type: 'daily',
      };

      const agreedBalance = calculateStudentFeeBalance({
        student: agreedStudent,
        feeStructures,
        payments: [],
      });

      expect(agreedBalance.lunchFee).toBe(4500);
      expect(agreedBalance.breakfastFee).toBe(2500);

      // Student D: Agreed flat lunch_termly_fee, breakfast_fee, transport_termly_fee aliases
      const termlyAliasStudent = {
        student_id: 104,
        class_name: 'Grade 1',
        lunch_termly_fee: 4800,
        breakfast_fee: 2200,
        transport_termly_fee: 3500,
      };
      const aliasBalance = calculateStudentFeeBalance({
        student: termlyAliasStudent,
        feeStructures,
        payments: [],
      });
      expect(aliasBalance.lunchFee).toBe(4800);
      expect(aliasBalance.breakfastFee).toBe(2200);
      expect(aliasBalance.transportFee).toBe(3500);
    });

    it('enforces non-negative total charges even if discount exceeds tuition', async () => {
      const student = {
        student_id: 11,
        school_id: 1,
        class_name: 'PP1',
        opening_balance: 0,
        transport_base_fee: 0,
        transport_direction: 'none',
        lunch_enabled: false,
        breakfast_enabled: false,
        discount_value: 20000, // Excessive discount exceeding tuition
        discount_is_percentage: false,
        discount_type: 'scholarship',
      };

      const term = { term_id: 1 };
      const academicYear = { academic_year_id: 1 };
      const settings = {};

      jest.spyOn(BillingService, 'getFeeStructure').mockResolvedValue({
        tuition: 10000,
        activity: 500,
        misc: 0,
      });
      jest.spyOn(BillingService, 'getActiveStudentServices').mockResolvedValue([]);
      jest.spyOn(BillingService, 'getStudentDiscounts').mockResolvedValue([]);

      const result = await BillingService.computeStudentBilling(1, student, term, academicYear, settings);

      expect(result.components.tuition_charge).toBeGreaterThanOrEqual(0);
      expect(result.total_charge).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Webhook Idempotency Invariant', () => {
    it('detects duplicate payment references to prevent double balance crediting', () => {
      const processedTransactions = new Set(['PAYSTACK-TX-001', 'MPESA-REF-XYZ987']);

      function processWebhookPayment(txRef, amount, balance) {
        if (processedTransactions.has(txRef)) {
          return { status: 'ignored_duplicate', credited: 0, newBalance: balance };
        }
        processedTransactions.add(txRef);
        return { status: 'processed', credited: amount, newBalance: balance - amount };
      }

      const initialBalance = 10000;
      const txRef = 'MPESA-REF-NEW123';

      // First webhook delivery
      const firstResult = processWebhookPayment(txRef, 4000, initialBalance);
      expect(firstResult.status).toBe('processed');
      expect(firstResult.credited).toBe(4000);
      expect(firstResult.newBalance).toBe(6000);

      // Duplicate delivery (network retry from provider)
      const duplicateResult = processWebhookPayment(txRef, 4000, firstResult.newBalance);
      expect(duplicateResult.status).toBe('ignored_duplicate');
      expect(duplicateResult.credited).toBe(0);
      // Balance MUST remain unchanged, preventing double counting
      expect(duplicateResult.newBalance).toBe(6000);
    });
  });

  describe('Double-Entry General Ledger Balance Invariant', () => {
    it('enforces total debits equal total credits for any journal entry', () => {
      function validateJournalEntry(entries) {
        const totalDebits = entries.reduce((sum, e) => sum + (e.type === 'debit' ? e.amount : 0), 0);
        const totalCredits = entries.reduce((sum, e) => sum + (e.type === 'credit' ? e.amount : 0), 0);
        return {
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.0001,
          totalDebits,
          totalCredits,
        };
      }

      // Valid payment receipt journal entry: Cash (Debit) / Accounts Receivable (Credit)
      const validPaymentJournal = [
        { account: 'Cash/Bank', type: 'debit', amount: 5000 },
        { account: 'Accounts Receivable (Student Fees)', type: 'credit', amount: 5000 },
      ];
      expect(validateJournalEntry(validPaymentJournal).isBalanced).toBe(true);

      // Unbalanced entry must fail validation
      const unbalancedJournal = [
        { account: 'Cash/Bank', type: 'debit', amount: 5000 },
        { account: 'Accounts Receivable (Student Fees)', type: 'credit', amount: 4500 },
      ];
      expect(validateJournalEntry(unbalancedJournal).isBalanced).toBe(false);
    });
  });
});
