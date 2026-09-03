# Billing Implementation Plan

## Verified Live Schema (as of 2026-09-03)

| Table | Exists | Key Columns |
|-------|--------|-------------|
| `academic_years` | yes | `academic_year_id` (bigint PK), `school_id`, `year_label`, `start_date`, `end_date`, `is_current`, `is_closed` |
| `terms` | yes | `term_id` (bigint PK), `school_id`, `academic_year_id`, `term_name`, `term_order`, `start_date`, `end_date`, `status`, `is_current` |
| `fee_structures` | yes | `fee_structure_id` (bigint PK), `school_id`, `class_name`, `term`, `tuition`, `activity`, `misc`, `is_deleted` |
| `fee_items` | yes | `fee_item_id` (bigint PK), `school_id`, `fee_structure_id`, `item_name`, `item_type`, `amount`, `is_optional` |
| `students` | yes | `student_id` (bigint PK), `school_id`, `class_name`, `status`, `is_deleted`, `opening_balance`, `opening_balance_type`, `transport_base_fee`, `transport_direction`, `lunch_enabled`, `lunch_daily_rate`, `lunch_days`, `lunch_billing_type`, `breakfast_enabled`, `breakfast_daily_rate`, `breakfast_days`, `breakfast_billing_type`, `discount_value`, `discount_is_percentage`, `discount_type` |
| `student_services` | yes | `enrollment_id` (bigint PK), `school_id`, `student_id`, `service_type`, `transport_direction`, `daily_rate`, `is_active`, `start_date`, `end_date` |
| `student_discounts` | yes | `discount_id` (integer PK), `school_id`, `student_id`, `discount_type`, `discount_value`, `discount_value_type`, `is_active`, `expires_at` |
| `student_ledger` | yes | `ledger_id` (bigint PK), `school_id`, `student_id`, `transaction_type`, `amount`, `balance_after`, `reference_type`, `reference_id`, `description`, `receipt_number`, `created_at` |
| `fee_balance_ledger` | yes | `ledger_id` (bigint PK), `school_id`, `student_id`, `academic_year_id`, `term_id`, `transaction_type`, `transaction_date`, `amount`, `balance_before`, `balance_after`, `reference_type`, `reference_id`, `description`, `created_by`, `is_deleted`, `created_at` |
| `payments` | yes | `payment_id` (bigint PK), `school_id`, `student_id`, `fee_structure_id`, `amount`, `fee_type`, `status`, `term`, `payment_date`, `received_by_user_id` |
| `invoices` | yes | `invoice_id` (bigint PK), `school_id`, `student_id`, `term`, `academic_year`, `tuition`, `activity`, `transport`, `misc`, `lunch`, `total`, `amount_paid`, `balance`, `status` |
| `school_settings` | yes | `setting_id` (bigint PK), `school_id`, `setting_key`, `setting_value` |
| `discount_configs` | yes | `config_id` (integer PK), `school_id`, `discount_type`, `discount_value`, `is_active` |
| `payment_plans` | yes | `plan_id` (bigint PK), `school_id`, `student_id`, `invoice_id`, `total_amount`, `status` |
| `idempotency_keys` | **NO** | must create |
| `student_waivers` | **NO** | must create if waivers required |

## Existing Code to Reuse (Safe)

### `backend/src/services/feeBalanceCalculator.js`

Reuse these functions **as-is**:
- `toNumber(value)` — safe numeric coercion
- `round2(value)` — 2-decimal rounding
- `getOpeningBalanceImpact(student)` — opening balance with credit/owing logic
- `getStudentBaseFee(student, feeStructures)` — tuition + activity + misc from fee_structures
- `getStudentTransportFee(student)` — agreed override + direction logic
- `getStudentLunchFee(student, schoolSettings)` — agreed override + daily/termly logic
- `getStudentBreakfastFee(student, schoolSettings)` — agreed override + daily/termly logic
- `getBestDiscount(discounts, tuition)` — highest-value active discount, percentage vs fixed
- `calculateFeeWithDiscount({ baseFee, tuition, transportFee, lunchFee, breakfastFee, openingBalance, discounts })` — discount applied to tuition only
- `calculateStudentFeeBalance({ student, feeStructures, payments, discounts, schoolSettings })` — full balance formula

**Do not modify these functions.** They are the single source of truth for fee math and are used by Dashboard, Fees page, Reports, Analytics, Defaulters, Parent/Student portals.

## What Needs to Be Built

### 1. `idempotency_keys` table

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    response_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. `student_waivers` table (if waivers are required)

```sql
CREATE TABLE IF NOT EXISTS student_waivers (
    waiver_id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools(school_id),
    student_id BIGINT NOT NULL REFERENCES students(student_id),
    waiver_type VARCHAR(20) NOT NULL CHECK (waiver_type IN ('full', 'partial')),
    waiver_amount NUMERIC(12,2),
    waiver_percentage NUMERIC(5,2),
    term VARCHAR(40),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATE,
    created_by BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. `BillingService` (new file)

**File:** `backend/src/services/BillingService.js`

This is the only new service needed. It must:

1. **Select context** — use existing `TermService` and `AcademicYearService` for current term/year
2. **Retrieve students** — query active, non-deleted students
3. **Compute charges per student** — call existing `feeBalanceCalculator.js` functions, then enumerate source items
4. **Insert ledger entries** — write to `fee_balance_ledger` with sequential `balance_before`/`balance_after`
5. **Guarantee idempotency** — use `idempotency_keys` to prevent duplicate billing runs
6. **Log audit events** — use existing `logAuditEvent`

**Critical:** Do NOT modify `feeBalanceCalculator.js`. Do NOT modify `LedgerService.recordCharge()`. The new `BillingService` wraps the calculator and writes directly to `fee_balance_ledger`.

### 4. Billing API endpoint

**File:** `backend/src/routes/billing.routes.js`

Endpoints needed:
- `POST /api/billing/run` — execute billing for a term
- `POST /api/billing/dry-run` — compute charges without writing to ledger
- `GET /api/billing/status/:runId` — check billing run status

## Implementation Order

1. Create `idempotency_keys` table
2. Create `student_waivers` table (if required)
3. Create `BillingService.js`
4. Create `billing.routes.js`
5. Write tests
6. Validate in staging

## Data Safety

- **Billing is append-only.** It only inserts into `fee_balance_ledger` and `idempotency_keys`.
- **No existing data is modified.**
- **Re-running is safe** — idempotency keys prevent duplicates.
- **Do not run `LedgerService.reconcileLedger()` on live data** — it deletes and rebuilds.
