/**
 * Build the students table update payload for fee settings.
 * Intentionally omits lunch_fee and transport_fee — those columns are not
 * present on all tenant schemas and caused PostgREST schema-cache 500s.
 *
 * @param {Record<string, unknown>} body - req.body from PATCH /students/:id/fees
 * @returns {Record<string, unknown>} fields safe to pass to supabase .update()
 */
export function buildStudentFeeUpdateData(body = {}) {
  const {
    outstanding_balance,
    breakfast_termly_fee,
    opening_balance,
    opening_balance_type,
    transport_direction,
    transport_base_fee,
    lunch_enabled,
    lunch_daily_rate,
    lunch_days,
    lunch_billing_type,
    breakfast_enabled,
    breakfast_daily_rate,
    breakfast_days,
    breakfast_billing_type,
    discount_type,
    discount_value,
    discount_is_percentage,
  } = body;

  const updateData = { updated_at: new Date().toISOString() };

  if (outstanding_balance !== undefined) {
    updateData.outstanding_balance = parseFloat(outstanding_balance) || 0;
  }
  if (breakfast_termly_fee !== undefined) {
    updateData.breakfast_termly_fee = parseFloat(breakfast_termly_fee) || 0;
  }
  if (opening_balance !== undefined) {
    updateData.opening_balance = parseFloat(opening_balance) || 0;
  }
  if (opening_balance_type !== undefined) {
    updateData.opening_balance_type = opening_balance_type || "owing";
  }
  if (transport_direction !== undefined) {
    updateData.transport_direction = transport_direction || "none";
  }
  if (transport_base_fee !== undefined) {
    updateData.transport_base_fee = parseFloat(transport_base_fee) || 0;
  }
  if (lunch_enabled !== undefined) {
    updateData.lunch_enabled = Boolean(lunch_enabled);
  }
  if (lunch_daily_rate !== undefined) {
    updateData.lunch_daily_rate = parseFloat(lunch_daily_rate) || 0;
  }
  if (lunch_days !== undefined) {
    updateData.lunch_days = parseInt(lunch_days, 10) || 0;
  }
  if (lunch_billing_type !== undefined) {
    updateData.lunch_billing_type = lunch_billing_type || "daily";
  }
  if (breakfast_enabled !== undefined) {
    updateData.breakfast_enabled = Boolean(breakfast_enabled);
  }
  if (breakfast_daily_rate !== undefined) {
    updateData.breakfast_daily_rate = parseFloat(breakfast_daily_rate) || 0;
  }
  if (breakfast_days !== undefined) {
    updateData.breakfast_days = parseInt(breakfast_days, 10) || 0;
  }
  if (breakfast_billing_type !== undefined) {
    updateData.breakfast_billing_type = breakfast_billing_type || "daily";
  }
  if (discount_type !== undefined) {
    updateData.discount_type = discount_type || null;
  }
  if (discount_value !== undefined) {
    updateData.discount_value = parseFloat(discount_value) || 0;
  }
  if (discount_is_percentage !== undefined) {
    updateData.discount_is_percentage = Boolean(discount_is_percentage);
  }

  return updateData;
}

/** Columns that must never be written via the fees PATCH (schema variance). */
export const FORBIDDEN_FEE_COLUMNS = Object.freeze(["lunch_fee", "transport_fee"]);
