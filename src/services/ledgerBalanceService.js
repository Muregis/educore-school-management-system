/**
 * Ledger-First Balance Service
 * 
 * Implements proper double-entry ledger for financial transactions.
 * Every financial operation creates an immutable ledger entry.
 * 
 * This replaces ad-hoc balance calculations with a proper accounting system.
 */

import { apiFetch } from '../lib/api';

const LEDGER_CACHE = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds for financial data

/**
 * Transaction types in the ledger
 */
export const TRANSACTION_TYPES = {
  OPENING_BALANCE: 'opening_balance',  // Starting balance from onboarding
  FEE_CHARGE: 'fee_charge',            // Tuition, activity, misc fees
  TRANSPORT_CHARGE: 'transport_charge', // Transport enrollment
  LUNCH_CHARGE: 'lunch_charge',       // Lunch enrollment
  PAYMENT: 'payment',                  // Money received
  WAIVER: 'waiver',                   // Fee forgiveness
  ADJUSTMENT: 'adjustment',            // Manual corrections
  CARRY_FORWARD: 'carry_forward',      // From previous term
  REFUND: 'refund'                     // Money returned
};

/**
 * Get student balance from ledger (ledger-first approach)
 * 
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.term - Optional term filter
 * @param {string} params.academicYear - Optional year filter
 * @param {string} params.token
 * @returns {Promise<LedgerBalance>}
 */
export async function getLedgerBalance({
  studentId,
  term = null,
  academicYear = null,
  token
}) {
  if (!studentId || !token) {
    return createEmptyLedgerBalance();
  }

  const cacheKey = `ledger_${studentId}_${term}_${academicYear}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Fetch all ledger entries for student
    const result = await apiFetch(
      `/students/${studentId}/ledger?term=${term || ''}&academic_year=${academicYear || ''}`,
      { token }
    );

    const entries = result?.entries || result || [];

    // Group by transaction type
    const byType = groupByType(entries);

    // Calculate running balance
    let runningBalance = 0;
    const entriesWithBalance = entries.map(entry => {
      const amount = parseFloat(entry.amount) || 0;
      const isDebit = isDebitType(entry.transaction_type);
      
      if (isDebit) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }

      return {
        ...entry,
        running_balance: runningBalance,
        is_debit: isDebit
      };
    });

    // Calculate totals
    const totalDebits = sumByType(byType, 'debit');
    const totalCredits = sumByType(byType, 'credit');

    const balance = {
      success: true,
      student_id: studentId,
      term,
      academic_year: academicYear,
      
      // Core figures
      opening_balance: sumType(byType, TRANSACTION_TYPES.OPENING_BALANCE),
      total_charges: sumType(byType, TRANSACTION_TYPES.FEE_CHARGE) + 
                     sumType(byType, TRANSACTION_TYPES.TRANSPORT_CHARGE) +
                     sumType(byType, TRANSACTION_TYPES.LUNCH_CHARGE),
      total_payments: sumType(byType, TRANSACTION_TYPES.PAYMENT),
      total_waivers: sumType(byType, TRANSACTION_TYPES.WAIVER),
      total_adjustments: sumType(byType, TRANSACTION_TYPES.ADJUSTMENT),
      carry_forward: sumType(byType, TRANSACTION_TYPES.CARRY_FORWARD),
      total_refunds: sumType(byType, TRANSACTION_TYPES.REFUND),
      
      // Final balance (positive = owes, negative = credit)
      balance: totalDebits - totalCredits,
      
      // Breakdown
      by_type: byType,
      entries: entriesWithBalance,
      entry_count: entries.length,
      
      // Status
      is_overpaid: totalCredits > totalDebits,
      is_paid: totalCredits >= totalDebits,
      
      // Metadata
      calculated_at: new Date().toISOString(),
      method: 'ledger_first'
    };

    setCached(cacheKey, balance);
    return balance;

  } catch (err) {
    console.error('Ledger balance error:', err);
    return {
      ...createEmptyLedgerBalance(),
      error: err.message,
      success: false
    };
  }
}

/**
 * Add opening balance for new student onboarding
 * 
 * @param {Object} params
 * @param {string} params.studentId
 * @param {number} params.amount - Opening balance amount
 * @param {string} params.notes - Reason/notes
 * @param {string} params.token
 * @returns {Promise<Object>} Created ledger entry
 */
export async function addOpeningBalance({
  studentId,
  amount,
  notes = 'Opening balance from onboarding',
  token
}) {
  return addLedgerEntry({
    studentId,
    transactionType: TRANSACTION_TYPES.OPENING_BALANCE,
    amount: Math.abs(amount),
    description: notes,
    reference: `ONBOARD_${Date.now()}`,
    token
  });
}

/**
 * Add fee charge to ledger
 */
export async function addFeeCharge({
  studentId,
  amount,
  feeType = 'tuition',
  term,
  academicYear,
  invoiceId = null,
  token
}) {
  const typeMap = {
    tuition: TRANSACTION_TYPES.FEE_CHARGE,
    transport: TRANSACTION_TYPES.TRANSPORT_CHARGE,
    lunch: TRANSACTION_TYPES.LUNCH_CHARGE,
    activity: TRANSACTION_TYPES.FEE_CHARGE,
    misc: TRANSACTION_TYPES.FEE_CHARGE
  };

  return addLedgerEntry({
    studentId,
    transactionType: typeMap[feeType] || TRANSACTION_TYPES.FEE_CHARGE,
    amount: Math.abs(amount),
    description: `${feeType} fee - ${term} ${academicYear}`,
    reference: invoiceId ? `INV_${invoiceId}` : null,
    metadata: { fee_type: feeType, term, academic_year: academicYear, invoice_id: invoiceId },
    token
  });
}

/**
 * Record payment in ledger
 */
export async function recordPayment({
  studentId,
  amount,
  paymentMethod,
  paymentId,
  reference,
  token
}) {
  return addLedgerEntry({
    studentId,
    transactionType: TRANSACTION_TYPES.PAYMENT,
    amount: Math.abs(amount),
    description: `Payment via ${paymentMethod}`,
    reference: reference || `PAY_${paymentId}`,
    metadata: { payment_method: paymentMethod, payment_id: paymentId },
    token
  });
}

/**
 * Apply fee waiver
 */
export async function applyWaiver({
  studentId,
  amount,
  reason,
  approvedBy,
  token
}) {
  return addLedgerEntry({
    studentId,
    transactionType: TRANSACTION_TYPES.WAIVER,
    amount: Math.abs(amount),
    description: `Waiver: ${reason}`,
    reference: `WAIVER_${Date.now()}`,
    metadata: { reason, approved_by: approvedBy },
    token
  });
}

/**
 * Carry forward balance from previous term
 */
export async function carryForwardBalance({
  studentId,
  amount,
  fromTerm,
  fromYear,
  toTerm,
  toYear,
  token
}) {
  return addLedgerEntry({
    studentId,
    transactionType: TRANSACTION_TYPES.CARRY_FORWARD,
    amount: Math.abs(amount),
    description: `Balance carried forward from ${fromTerm} ${fromYear}`,
    reference: `CF_${fromTerm}_${fromYear}`,
    metadata: { from_term: fromTerm, from_year: fromYear, to_term: toTerm, to_year: toYear },
    token
  });
}

/**
 * Core function: Add entry to ledger
 */
async function addLedgerEntry({
  studentId,
  transactionType,
  amount,
  description,
  reference = null,
  metadata = {},
  token
}) {
  const payload = {
    student_id: studentId,
    transaction_type: transactionType,
    amount,
    description,
    reference,
    metadata,
    transaction_date: new Date().toISOString()
  };

  try {
    const result = await apiFetch('/ledger/entries', {
      method: 'POST',
      body: payload,
      token
    });

    // Clear cache for this student
    clearStudentCache(studentId);

    return result;
  } catch (err) {
    console.error('Failed to add ledger entry:', err);
    throw err;
  }
}

/**
 * Transport fee calculation with multiplier
 * 
 * @param {number} baseFee - Full two-way fee
 * @param {string} direction - 'one_way' or 'two_way'
 * @returns {number} Calculated fee
 */
export function calculateTransportFee(baseFee, direction = 'two_way') {
  const base = parseFloat(baseFee) || 0;
  
  if (direction === 'one_way') {
    return Math.round(base * 0.6 * 100) / 100; // 60% for one-way
  }
  
  return base; // 100% for two-way
}

/**
 * Lunch fee calculation
 * 
 * @param {number} dailyRate - Daily lunch rate
 * @param {number} days - Number of days (default: term days)
 * @returns {number} Calculated fee
 */
export function calculateLunchFee(dailyRate, days = 66) { // ~66 school days per term
  return Math.round((parseFloat(dailyRate) || 0) * days * 100) / 100;
}

/**
 * Format balance for display
 */
export function formatLedgerBalance(balance, currency = 'KES') {
  const num = parseFloat(balance) || 0;
  const absBalance = Math.abs(num);
  
  const formatted = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(absBalance);
  
  if (num < 0) {
    return `${formatted} CR`; // Credit
  } else if (num > 0) {
    return `${formatted} DR`; // Debit (owes)
  }
  
  return formatted;
}

/**
 * Get balance status for UI
 */
export function getBalanceStatus(balance) {
  const num = parseFloat(balance) || 0;
  
  if (num < 0) return { label: 'Credit', color: '#22c55e', tone: 'success' };
  if (num === 0) return { label: 'Paid', color: '#22c55e', tone: 'success' };
  if (num <= 1000) return { label: 'Small Balance', color: '#3b82f6', tone: 'info' };
  if (num <= 5000) return { label: 'Balance Due', color: '#f59e0b', tone: 'warning' };
  return { label: 'Overdue', color: '#ef4444', tone: 'danger' };
}

// ==================== INTERNAL HELPERS ====================

function groupByType(entries) {
  return entries.reduce((acc, entry) => {
    const type = entry.transaction_type || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(entry);
    return acc;
  }, {});
}

function sumByType(byType, category) {
  if (category === 'debit') {
    const debitTypes = [
      TRANSACTION_TYPES.OPENING_BALANCE,
      TRANSACTION_TYPES.FEE_CHARGE,
      TRANSACTION_TYPES.TRANSPORT_CHARGE,
      TRANSACTION_TYPES.LUNCH_CHARGE,
      TRANSACTION_TYPES.CARRY_FORWARD,
      TRANSACTION_TYPES.ADJUSTMENT
    ];
    return debitTypes.reduce((sum, type) => sum + sumType(byType, type), 0);
  }
  
  if (category === 'credit') {
    const creditTypes = [
      TRANSACTION_TYPES.PAYMENT,
      TRANSACTION_TYPES.WAIVER,
      TRANSACTION_TYPES.REFUND
    ];
    return creditTypes.reduce((sum, type) => sum + sumType(byType, type), 0);
  }
  
  return 0;
}

function sumType(byType, transactionType) {
  const entries = byType[transactionType] || [];
  return entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
}

function isDebitType(transactionType) {
  const debitTypes = [
    TRANSACTION_TYPES.OPENING_BALANCE,
    TRANSACTION_TYPES.FEE_CHARGE,
    TRANSACTION_TYPES.TRANSPORT_CHARGE,
    TRANSACTION_TYPES.LUNCH_CHARGE,
    TRANSACTION_TYPES.CARRY_FORWARD
  ];
  return debitTypes.includes(transactionType);
}

function createEmptyLedgerBalance() {
  return {
    success: false,
    student_id: null,
    term: null,
    academic_year: null,
    opening_balance: 0,
    total_charges: 0,
    total_payments: 0,
    total_waivers: 0,
    total_adjustments: 0,
    carry_forward: 0,
    total_refunds: 0,
    balance: 0,
    by_type: {},
    entries: [],
    entry_count: 0,
    is_overpaid: false,
    is_paid: false,
    calculated_at: null,
    method: 'ledger_first',
    error: null
  };
}

// ==================== CACHE MANAGEMENT ====================

function getCached(key) {
  const cached = LEDGER_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  LEDGER_CACHE.delete(key);
  return null;
}

function setCached(key, data) {
  LEDGER_CACHE.set(key, { data, timestamp: Date.now() });
}

export function clearStudentCache(studentId) {
  for (const key of LEDGER_CACHE.keys()) {
    if (key.includes(`_${studentId}_`)) {
      LEDGER_CACHE.delete(key);
    }
  }
}

export function clearAllLedgerCache() {
  LEDGER_CACHE.clear();
}

// Auto-clear old cache entries
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, cached] of LEDGER_CACHE.entries()) {
      if (now - cached.timestamp > CACHE_TTL) {
        LEDGER_CACHE.delete(key);
      }
    }
  }, CACHE_TTL);
}

const ledgerBalanceService = {
  getLedgerBalance,
  addOpeningBalance,
  addFeeCharge,
  recordPayment,
  applyWaiver,
  carryForwardBalance,
  calculateTransportFee,
  calculateLunchFee,
  formatLedgerBalance,
  getBalanceStatus,
  TRANSACTION_TYPES,
  clearStudentCache,
  clearAllLedgerCache
};

export { ledgerBalanceService };
export default ledgerBalanceService;
