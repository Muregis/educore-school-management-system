/**
 * Balance Calculation Service
 * 
 * SINGLE SOURCE OF TRUTH for all student balance calculations.
 * Replaces duplicated calculation logic across frontend components.
 * 
 * Calculation Formula:
 * BALANCE = (Opening Balance + Expected Fees + Adjustments) - (Payments + Waivers)
 * 
 * Uses ledger-first approach for audit trail and consistency.
 */

import { apiFetch } from '../lib/api';

// Cache for balance calculations
const balanceCache = new Map();
const CACHE_DURATION = 60 * 1000; // 1 minute (shorter for financial data)

/**
 * Calculate student balance using ledger-first approach
 * 
 * @param {Object} params - Calculation parameters
 * @param {string} params.studentId - Student ID
 * @param {string} params.term - Academic term (optional, defaults to current)
 * @param {string} params.academicYear - Academic year (optional)
 * @param {string} params.token - Auth token
 * @param {boolean} params.useCache - Whether to use cached result
 * @returns {Promise<BalanceResult>} Balance calculation result
 */
export async function calculateStudentBalance({
  studentId,
  term = null,
  academicYear = null,
  token,
  useCache = true
}) {
  if (!studentId || !token) {
    return createEmptyBalance();
  }

  const cacheKey = `balance_${studentId}_${term}_${academicYear}`;
  
  if (useCache) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    // Method 1: Try ledger-based calculation (preferred)
    const ledgerResult = await calculateFromLedger(studentId, term, academicYear, token);
    
    if (ledgerResult && ledgerResult.success) {
      if (useCache) setCached(cacheKey, ledgerResult);
      return ledgerResult;
    }

    // Method 2: Fall back to invoice/payment summation
    const summationResult = await calculateFromSummation(studentId, term, academicYear, token);
    
    if (useCache) setCached(cacheKey, summationResult);
    return summationResult;

  } catch (err) {
    console.error('Balance calculation error:', err);
    return {
      ...createEmptyBalance(),
      error: err.message,
      calculationMethod: 'error'
    };
  }
}

/**
 * Calculate balance from fee_balance_ledger (immutable ledger approach)
 */
async function calculateFromLedger(studentId, term, academicYear, token) {
  try {
    // Fetch all ledger entries for student
    const result = await apiFetch(
      `/students/${studentId}/ledger?term=${term || ''}&academic_year=${academicYear || ''}`,
      { token }
    );

    if (!result || !result.entries) {
      throw new Error('No ledger data available');
    }

    const entries = result.entries || [];
    const student = result.student || {};

    // Categorize transactions
    const charges = entries.filter(e => e.transaction_type === 'charge');
    const payments = entries.filter(e => e.transaction_type === 'payment');
    const adjustments = entries.filter(e => e.transaction_type === 'adjustment');
    const waivers = entries.filter(e => e.transaction_type === 'waiver');
    const carryForwards = entries.filter(e => e.transaction_type === 'carry_forward');

    // Calculate totals
    const openingBalance = student.opening_balance || 0;
    
    const totalExpected = charges.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalAdjustments = adjustments.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPayments = payments.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalWaivers = waivers.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalCarryForward = carryForwards.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Final balance calculation
    const grossExpected = openingBalance + totalExpected + totalAdjustments + totalCarryForward;
    const totalCredits = totalPayments + totalWaivers;
    const balance = grossExpected - totalCredits;

    return {
      success: true,
      studentId,
      term,
      academicYear,
      
      // Core balance figures
      openingBalance,
      totalExpected,
      totalAdjustments,
      totalCarryForward,
      grossExpected,
      
      totalPayments,
      totalWaivers,
      totalCredits,
      
      balance, // Positive = owes money, Negative = credit/overpaid
      
      // Status
      isPaid: balance <= 0,
      isOverpaid: balance < 0,
      overpaymentAmount: balance < 0 ? Math.abs(balance) : 0,
      
      // Metadata
      calculationMethod: 'ledger',
      entryCount: entries.length,
      lastUpdated: new Date().toISOString(),
      
      // Detailed breakdown
      details: {
        charges: charges.map(e => ({
          date: e.transaction_date,
          description: e.description,
          amount: e.amount,
          reference: e.reference
        })),
        payments: payments.map(e => ({
          date: e.transaction_date,
          description: e.description,
          amount: e.amount,
          reference: e.reference,
          method: e.payment_method
        })),
        adjustments: adjustments.map(e => ({
          date: e.transaction_date,
          description: e.description,
          amount: e.amount,
          reason: e.reason
        }))
      }
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Calculate balance from invoices and payments (summation fallback)
 */
async function calculateFromSummation(studentId, term, academicYear, token) {
  try {
    // Fetch student data
    const studentResult = await apiFetch(`/students/${studentId}`, { token });
    const student = studentResult?.data || studentResult || {};

    // Fetch invoices
    const invoicesResult = await apiFetch(
      `/students/${studentId}/invoices?term=${term || ''}&academic_year=${academicYear || ''}`,
      { token }
    );
    const invoices = (invoicesResult?.data || invoicesResult || []).filter(i => i.status !== 'cancelled');

    // Fetch payments
    const paymentsResult = await apiFetch(
      `/students/${studentId}/payments?term=${term || ''}&academic_year=${academicYear || ''}`,
      { token }
    );
    const payments = paymentsResult?.data || paymentsResult || [];

    // Calculate
    const openingBalance = student.opening_balance || 0;
    const totalExpected = invoices.reduce((sum, i) => sum + (i.total || i.amount || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Calculate balance
    const balance = (openingBalance + totalExpected) - totalPayments;

    return {
      success: true,
      studentId,
      term,
      academicYear,
      
      openingBalance,
      totalExpected,
      totalAdjustments: 0, // Not tracked in summation method
      totalCarryForward: 0,
      grossExpected: openingBalance + totalExpected,
      
      totalPayments,
      totalWaivers: 0, // Not tracked in summation method
      totalCredits: totalPayments,
      
      balance,
      
      isPaid: balance <= 0,
      isOverpaid: balance < 0,
      overpaymentAmount: balance < 0 ? Math.abs(balance) : 0,
      
      calculationMethod: 'summation',
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      lastUpdated: new Date().toISOString(),
      
      details: {
        invoices: invoices.map(i => ({
          id: i.invoice_id || i.id,
          date: i.invoice_date || i.date,
          description: i.description || 'School Fees',
          amount: i.total || i.amount,
          status: i.status
        })),
        payments: payments.map(p => ({
          id: p.payment_id || p.id,
          date: p.payment_date || p.date,
          description: p.description || 'Payment',
          amount: p.amount,
          method: p.payment_method || p.method
        }))
      }
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Calculate balances for multiple students (batch operation)
 */
export async function calculateBatchBalances({
  studentIds,
  term = null,
  academicYear = null,
  token
}) {
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    return {};
  }

  // Process in batches of 10 to avoid overwhelming the API
  const batchSize = 10;
  const results = {};

  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(studentId =>
      calculateStudentBalance({ studentId, term, academicYear, token })
        .then(balance => ({ studentId, balance, success: true }))
        .catch(err => ({ 
          studentId, 
          balance: createEmptyBalance(), 
          success: false, 
          error: err.message 
        }))
    );

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ studentId, balance }) => {
      results[studentId] = balance;
    });
  }

  return results;
}

/**
 * Get class/school summary statistics
 */
export async function getBalanceSummary({
  classId = null,
  term = null,
  academicYear = null,
  token
}) {
  if (!token) return null;

  try {
    const endpoint = classId 
      ? `/classes/${classId}/balance-summary?term=${term || ''}&academic_year=${academicYear || ''}`
      : `/school/balance-summary?term=${term || ''}&academic_year=${academicYear || ''}`;

    const result = await apiFetch(endpoint, { token });
    return result?.data || result;

  } catch (err) {
    console.error('Balance summary error:', err);
    return null;
  }
}

/**
 * Format balance for display
 */
export function formatBalance(balance, currency = 'KES') {
  const numBalance = Number(balance);
  
  if (isNaN(numBalance)) return `${currency} 0.00`;
  
  const absBalance = Math.abs(numBalance);
  const formatted = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(absBalance);
  
  if (numBalance < 0) {
    return `${formatted} (Credit)`;
  } else if (numBalance > 0) {
    return `${formatted} (Owing)`;
  }
  
  return formatted;
}

/**
 * Get balance status color for UI
 */
export function getBalanceStatusColor(balance) {
  const numBalance = Number(balance);
  
  if (numBalance < 0) return '#22c55e'; // Green - credit/overpaid
  if (numBalance === 0) return '#22c55e'; // Green - paid
  if (numBalance <= 1000) return '#3b82f6'; // Blue - small balance
  if (numBalance <= 5000) return '#f59e0b'; // Yellow - medium balance
  return '#ef4444'; // Red - large balance
}

/**
 * Get balance status text
 */
export function getBalanceStatusText(balance) {
  const numBalance = Number(balance);
  
  if (numBalance < 0) return 'Overpaid';
  if (numBalance === 0) return 'Paid in Full';
  if (numBalance <= 1000) return 'Small Balance';
  if (numBalance <= 5000) return 'Balance Due';
  return 'Large Balance';
}

// ==================== INTERNAL HELPERS ====================

function createEmptyBalance() {
  return {
    success: false,
    studentId: null,
    term: null,
    academicYear: null,
    openingBalance: 0,
    totalExpected: 0,
    totalAdjustments: 0,
    totalCarryForward: 0,
    grossExpected: 0,
    totalPayments: 0,
    totalWaivers: 0,
    totalCredits: 0,
    balance: 0,
    isPaid: false,
    isOverpaid: false,
    overpaymentAmount: 0,
    calculationMethod: 'none',
    entryCount: 0,
    lastUpdated: null,
    details: { charges: [], payments: [], adjustments: [] }
  };
}

function getCached(key) {
  const cached = balanceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  balanceCache.delete(key);
  return null;
}

function setCached(key, data) {
  balanceCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clear all cached balances (call when payments are made)
 */
export function clearBalanceCache() {
  balanceCache.clear();
}

/**
 * Clear cache for specific student
 */
export function clearStudentBalanceCache(studentId) {
  // Clear all entries for this student
  for (const key of balanceCache.keys()) {
    if (key.startsWith(`balance_${studentId}`)) {
      balanceCache.delete(key);
    }
  }
}

// Auto-clear cache periodically (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, cached] of balanceCache.entries()) {
      if (now - cached.timestamp > CACHE_DURATION) {
        balanceCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export default {
  calculateStudentBalance,
  calculateBatchBalances,
  getBalanceSummary,
  formatBalance,
  getBalanceStatusColor,
  getBalanceStatusText,
  clearBalanceCache,
  clearStudentBalanceCache
};
