/**
 * Discount Service - Handles fee discount calculations
 * Supports sibling, staff, and custom discounts
 */

import { apiFetch } from "../lib/api";

const DISCOUNT_LABELS = {
  sibling_2nd: "Sibling (2nd child)",
  sibling_3rd: "Sibling (3rd child)",
  sibling_4th_plus: "Sibling (4th+ child)",
  staff_child: "Staff Child",
  scholarship: "Scholarship",
  bursary: "Bursary",
  custom: "Custom Discount"
};

/**
 * Calculate the discount amount for a student based on gross fee
 * @param {number} grossAmount - Total fee before discount
 * @param {number} discountValue - Discount percentage (0-100) or fixed amount
 * @param {string} discountValueType - 'percentage' or 'fixed'
 * @returns {object} - { discountAmount, netAmount, discountPercent }
 */
export function calculateDiscount(grossAmount, discountValue, discountValueType = 'percentage') {
  let discountAmount;
  let discountPercent;
  
  if (discountValueType === 'fixed') {
    discountAmount = discountValue;
    discountPercent = (discountAmount / grossAmount) * 100;
  } else {
    discountPercent = discountValue;
    discountAmount = (grossAmount * discountPercent) / 100;
  }
  
  const netAmount = grossAmount - discountAmount;

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    discountPercent: Math.round(discountPercent * 100) / 100,
    discountValueType,
    grossAmount
  };
}

/**
 * Get the best discount from a list of discounts
 * Only the highest discount applies (no stacking)
 * @param {Array} discounts - Array of discount objects
 * @param {number} baseFee - Base fee for comparing fixed vs percentage
 * @returns {object|null} - Best discount or null
 */
export function getBestDiscount(discounts, baseFee = 0) {
  if (!discounts || discounts.length === 0) return null;

  // Filter active discounts
  const activeDiscounts = discounts.filter(d => {
    if (!d.is_active) return false;
    if (d.expires_at && new Date(d.expires_at) < new Date()) return false;
    return true;
  });

  if (activeDiscounts.length === 0) return null;

  // Return highest discount, comparing fixed amounts vs percentages correctly
  return activeDiscounts.reduce((best, current) => {
    const currentValue = current.discount_value || current.discountPercent || 0;
    const bestValue = best.discount_value || best.discountPercent || 0;
    
    // If both are percentages, compare directly
    if (current.discount_value_type === 'percentage' && best.discount_value_type === 'percentage') {
      return currentValue > bestValue ? current : best;
    }
    
    // If current is fixed, convert best to equivalent amount for comparison
    if (current.discount_value_type === 'fixed') {
      const currentAmount = currentValue;
      const bestAmount = best.discount_value_type === 'fixed' ? bestValue : (baseFee * bestValue / 100);
      return currentAmount > bestAmount ? current : best;
    }
    
    // If best is fixed, convert current to equivalent amount for comparison
    if (best.discount_value_type === 'fixed') {
      const bestAmount = bestValue;
      const currentAmount = baseFee * currentValue / 100;
      return currentAmount > bestAmount ? current : best;
    }
    
    // Default to percentage comparison
    return currentValue > bestValue ? current : best;
  });
}

/**
 * Format discount for display
 * @param {string} discountType - Type of discount
 * @returns {string} - Human-readable label
 */
export function getDiscountLabel(discountType) {
  return DISCOUNT_LABELS[discountType] || discountType;
}

/**
 * Detect available discounts for a student (API call)
 * @param {number} studentId - Student ID
 * @param {string} token - Auth token
 * @returns {Promise<object>} - Detection results
 */
export async function detectDiscounts(studentId, token) {
  try {
    const data = await apiFetch(`/discounts/detect/${studentId}`, { token });
    return data;
  } catch (err) {
    console.error("Failed to detect discounts:", err);
    return { qualifies: [], existingDiscounts: [] };
  }
}

/**
 * Get active discounts for a student (API call)
 * @param {number} studentId - Student ID
 * @param {string} token - Auth token
 * @returns {Promise<Array>} - Array of active d, baseFeeiscounts
 */
export async function getStudentDiscounts(studentId, token) {
  try {
    const data = await apiFetch(`/discounts/student/${studentId}`, { token });
    return data || [];
  } catch (err) {
    console.error("Failed to get student discounts:", err);
    return [];
  }
}

/**
 * Calculate discount breakdown for a student's complete fee
 * IMPORTANT: Discount applies ONLY to base fee (tuition + activity + misc);
 * Transport, lunch, breakfast, and opening balance are NEVER discounted
 * 
 * @param {object} params - Fee calculation parameters
 * @param {number} params.baseFee - Base tuition fee (ONLY this is discounted)
 * @param {number} params.transportFee - Transport fee (NOT discounted)
 * @param {number} params.lunchFee - Lunch fee (NOT discounted)
 * @param {number} params.breakfastFee - Breakfast fee (NOT discounted)
 * @param {number} params.openingBalance - Opening balance (NOT discounted)
 * @param {Array} params.discounts - Student's active discounts
 * @returns {object} - Complete fee breakdown with discount
 */
export function calculateFeeWithDiscount({
  baseFee = 0,
  transportFee = 0,
  lunchFee = 0,
  breakfastFee = 0,
  openingBalance = 0,
  discounts = []
}) {
  const grossAmount = baseFee + transportFee + lunchFee + breakfastFee + openingBalance;
  const bestDiscount = getBestDiscount(discounts, baseFee);

  if (!bestDiscount) {
    return {
      grossAmount,
      discountAmount: 0,
      discountPercent: 0,
      netAmount: grossAmount,
      discountType: null,
      discountLabel: null,
      hasDiscount: false
    };
  }

  const discountValue = bestDiscount.discount_value || bestDiscount.discountPercent || 0;
  const discountValueType = bestDiscount.discount_value_type || 'percentage';
  
  let discountAmount;
  let discountPercent;
  
  // CRITICAL: Discount applies ONLY to base fee, not transport/meals/opening balance
  if (discountValueType === 'fixed') {
    discountAmount = discountValue;
    discountPercent = (discountAmount / baseFee) * 100;
  } else {
    discountPercent = discountValue;
    discountAmount = (baseFee * discountPercent) / 100;
  }
  
  const netBaseFee = baseFee - discountAmount;
  const netAmount = netBaseFee + transportFee + lunchFee + breakfastFee + openingBalance;

  return {
    grossAmount,
    discountAmount: Math.round(discountAmount * 100) / 100,
    discountPercent: Math.round(discountPercent * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    discountType: bestDiscount.discount_type || bestDiscount.type,
    discountLabel: getDiscountLabel(bestDiscount.discount_type || bestDiscount.type),
    discountId: bestDiscount.discount_id,
    discountValueType,
    hasDiscount: true
  };
}

/**
 * Get all students with active discounts (API call)
 * @param {string} token - Auth token
 * @returns {Promise<Array>} - Students with discounts
 */
export async function getAllDiscountedStudents(token) {
  try {
    const data = await apiFetch("/discounts/students", { token });
    return data || [];
  } catch (err) {
    console.error("Failed to get discounted students:", err);
    return [];
  }
}

export default {
  calculateDiscount,
  getBestDiscount,
  getDiscountLabel,
  detectDiscounts,
  getStudentDiscounts,
  calculateFeeWithDiscount,
  getAllDiscountedStudents,
  DISCOUNT_LABELS
};
