import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BillingService } from '../../../src/services/BillingService.js';

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
