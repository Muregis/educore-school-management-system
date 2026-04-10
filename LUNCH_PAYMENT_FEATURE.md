# Lunch Payment Feature - EduCore

## Overview
This document outlines the design for optional lunch pricing in EduCore where schools can offer lunch as a separate, optional paid service (not included in tuition).

---

## Data Model

### 1. Add `lunch_fee` to `fee_structures` table

**SQL Migration:**
```sql
ALTER TABLE fee_structures ADD COLUMN lunch_fee DECIMAL(10,2) DEFAULT 0.00;
```

**Purpose:** Store the lunch fee per student per term/year for each class. If `lunch_fee = 0`, lunch is not offered.

---

### 2. Update `student_lunch_subscriptions` table (NEW)

Create a new table to track which students have opted into lunch:

```sql
CREATE TABLE student_lunch_subscriptions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  term VARCHAR(10) NOT NULL, -- "Term 1", "Term 2", "Term 3"
  academic_year SMALLINT NOT NULL,
  opted_in TINYINT(1) DEFAULT 0, -- 1=student eating lunch, 0=opted out
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_lunch_school FOREIGN KEY (school_id) REFERENCES schools(school_id),
  CONSTRAINT fk_student_lunch_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  UNIQUE KEY unique_student_term_year (school_id, student_id, term, academic_year),
  INDEX idx_lunch_school_term (school_id, term, academic_year)
) ENGINE=InnoDB;
```

### 3. Modify `invoices` table (if using per-term invoicing)

Add a breakdown line item for lunch:
```sql
ALTER TABLE invoices ADD COLUMN lunch_fee DECIMAL(10,2) DEFAULT 0.00;
```

Or create a new `invoice_items` table for granular tracking:
```sql
CREATE TABLE invoice_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('tuition','lunch','books','supplies','misc') DEFAULT 'tuition',
  description VARCHAR(200),
  amount DECIMAL(10,2) NOT NULL,
  quantity INT DEFAULT 1,
  CONSTRAINT fk_invoice_items FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id)
) ENGINE=InnoDB;
```

---

## API Endpoints

### 1. Get Lunch Fee for a Class
```
GET /api/fees/lunch-fee?className=Grade%207
```
**Response:**
```json
{
  "className": "Grade 7",
  "lunchFee": 2500.00,
  "offered": true,
  "term": "Term 2",
  "year": 2026
}
```

---

### 2. Get Student Lunch Subscription Status
```
GET /api/students/:studentId/lunch-subscription?term=Term%202&year=2026
```
**Response:**
```json
{
  "studentId": 42,
  "term": "Term 2",
  "year": 2026,
  "optedIn": true,  // true = student is subscribed to lunch
  "lunchFee": 2500.00,
  "startDate": "2026-04-13",
  "endDate": null,
  "status": "active"
}
```

---

### 3. Update Lunch Subscription (Student/Parent Self-Service)
```
POST /api/students/:studentId/lunch-subscription
```
**Body:**
```json
{
  "term": "Term 2",
  "year": 2026,
  "optedIn": true,  // true = opt in, false = opt out
  "startDate": "2026-04-13"
}
```
**Response:**
```json
{
  "message": "Lunch subscription updated",
  "subscription": { ... }
}
```

---

### 4. Bulk Update Lunch Subscriptions (Admin)
```
POST /api/lunch/batch-subscribe
```
**Body:**
```json
{
  "studentIds": [42, 51, 67],
  "term": "Term 2",
  "year": 2026,
  "optedIn": true
}
```

---

### 5. Generate Invoice with Lunch Fee
```
GET /api/invoices/student/:studentId?term=Term%202&year=2026
```
**Include logic to:**
- Get base tuition from fee_structures
- Check if lunch_fee is configured for the class
- Check if student has opted in via student_lunch_subscriptions
- Add lunch_fee to total only if opted_in = 1

**Response:**
```json
{
  "invoiceId": 201,
  "studentId": 42,
  "studentName": "Jane Kipchoge",
  "admission": "STU-002",
  "className": "Grade 7",
  "term": "Term 2",
  "year": 2026,
  "items": [
    { "type": "tuition", "amount": 45000, "label": "Tuition" },
    { "type": "activity", "amount": 3000, "label": "Activity Fee" },
    { "type": "lunch", "amount": 5000, "label": "Lunch Subscription (20 school days)" },
    { "type": "misc", "amount": 2000, "label": "Miscellaneous" }
  ],
  "total": 55000,
  "amountPaid": 35000,
  "balanceDue": 20000,
  "dueDate": "2026-05-13"
}
```

---

## UI Components

### 1. Lunch Settings (Admin - Fee Management Page)

**Section: Lunch Configuration**
```
┌─ Lunch Settings ─────────────────────┐
│ Enable lunch program: [Toggle]        │
│                                       │
│ Grade 7:      Lunch Fee: [2500] KES  │
│ Grade 8:      Lunch Fee: [2500] KES  │
│ Grade 9:      Lunch Fee: [3000] KES  │
│ ...                                   │
│                                       │
│ [Save Settings]                       │
└───────────────────────────────────────┘
```

---

### 2. Lunch Opt-In (Parent/Student Portal)

**Location:** Student Profile → Lunch

```
┌─ Lunch Subscription ──────────────────┐
│ Current Term: Term 2 (2026)           │
│ Lunch Fee: KES 2,500 per term        │
│                                       │
│ □ Subscribe Jane to lunch             │
│   (Includes 20 school days)           │
│                                       │
│ Status: Not opted in                  │
│                                       │
│ [Subscribe Now] [Cancel]             │
└───────────────────────────────────────┘
```

---

### 3. Admin Bulk Lunch Management

**Location:** Admin → Students → Lunch Management

```
┌─ Bulk Lunch Subscription ─────────────┐
│ Term: [Term 2   ▼]                   │
│ Class: [All Classes ▼]               │
│ Action: [Subscribe to Lunch ▼]       │
│                                       │
│ Students: [ALL 47 | Selected 3]       │
│ □ Grade 7A (15 students)              │
│ □ Grade 7B (9 students)               │
│ □ Grade 7C (8 students)               │
│ ☑ Grade 8A (12 students)             │
│ □ Grade 8B (11 students)              │
│                                       │
│ [Apply to: 12 students]               │
└───────────────────────────────────────┘
```

---

### 4. Lunch Meal Tracking (Optional - Future)

For schools that want to track actual meal consumption:

```sql
CREATE TABLE lunch_meals_served (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  meal_date DATE NOT NULL,
  meal_type ENUM('breakfast','lunch','snack') DEFAULT 'lunch',
  served_by_teacher_id BIGINT UNSIGNED,
  notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meals_student FOREIGN KEY (student_id) REFERENCES students(student_id)
) ENGINE=InnoDB;
```

**UI:** Daily attendance register with "✓ Lunch Served" checkbox per student

---

## Invoice Calculation Logic

### Backend Implementation (Node.js/Express)

```javascript
// routes/fees.routes.js

router.get('/invoices/student/:studentId', requireAuth, async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { studentId } = req.params;
    const { term = "Term 2", year = new Date().getFullYear() } = req.query;

    // Get student info
    const { data: student } = await supabase
      .from('students')
      .select('*, className:class_id (name)')
      .eq('student_id', studentId)
      .single();

    // Get fee structure
    const { data: feeStruct } = await supabase
      .from('fee_structures')
      .select('tuition, activity, misc, lunch_fee')
      .eq('school_id', schoolId)
      .eq('className', student.className)
      .single();

    // Check lunch subscription
    const { data: lunchSub } = await supabase
      .from('student_lunch_subscriptions')
      .select('opted_in')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('academic_year', year)
      .single();

    // Build invoice items
    const items = [
      { type: 'tuition', amount: feeStruct.tuition, label: 'Tuition' },
      { type: 'activity', amount: feeStruct.activity, label: 'Activity Fee' },
      { type: 'misc', amount: feeStruct.misc, label: 'Miscellaneous' },
    ];

    // Add lunch only if opted in
    if (lunchSub?.opted_in && feeStruct.lunch_fee > 0) {
      items.push({
        type: 'lunch',
        amount: feeStruct.lunch_fee,
        label: `Lunch Subscription (${term})`
      });
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0);

    res.json({
      invoiceId: `INV-${studentId}-${term}-${year}`,
      studentId,
      items,
      total,
      balanceDue: total - (await getAmountPaid(studentId, term, year))
    });
  } catch (err) { next(err); }
});
```

---

## Fee Waiver/Exceptions

For special cases (needy students, scholarship recipients):

```sql
CREATE TABLE lunch_fee_waivers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  school_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  term VARCHAR(10) NOT NULL,
  academic_year SMALLINT NOT NULL,
  waiver_type ENUM('full','partial') DEFAULT 'full',
  waiver_percentage INT DEFAULT 100, -- for partial waivers
  reason VARCHAR(200),
  approvedBy_user_id BIGINT UNSIGNED,
  approvalDate TIMESTAMP,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waiver_student FOREIGN KEY (student_id) REFERENCES students(student_id),
  UNIQUE KEY unique_waiver (school_id, student_id, term, academic_year)
) ENGINE=InnoDB;
```

**Logic:** When generating invoice, check waivers and reduce lunch_fee accordingly.

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [x] Add lunch_fee column to fee_structures
- [x] Create student_lunch_subscriptions table
- [x] Backend API endpoints for lunch management
- [ ] Unit tests for lunch fee calculation

### Phase 2: Parent Portal (Week 2)
- [ ] Lunch subscription UI on student profile
- [ ] Parent self-service lunch opt-in/opt-out
- [ ] Notification: "Lunch subscription updated"

### Phase 3: Admin Tools (Week 3)
- [ ] Bulk lunch subscription management
- [ ] Lunch settings (enable/disable, set fees per class)
- [ ] Reports: "Students with/without lunch"

### Phase 4: Reporting & Analytics (Week 4)
- [ ] Invoice generation with lunch fees
- [ ] Lunch fee collection tracking
- [ ] Analytics: "Lunch fee outstanding by class"

### Phase 5: Meal Tracking (Optional - Future)
- [ ] Daily lunch registration
- [ ] Meal attendance reports
- [ ] Parent notifications: "Lunch served today: Jane ate lunch"

---

## Testing Scenarios

1. **Scenario A: Student opts into lunch**
   - Fee structure: Tuition 50000, Lunch 2500
   - Student subscribed = Invoice total 52500
   - Student not subscribed = Invoice total 50000

2. **Scenario B: Lunch fee waived**
   - Fee structure: Tuition 50000, Lunch 2500
   - Waiver: Full waiver on lunch
   - Invoice total: 50000

3. **Scenario C: School has no lunch program**
   - Fee structure: lunch_fee = 0 (NULL)
   - Invoice: tuition only, no lunch option shown

---

## Security & Permissions

- **Parent**: Can only view/edit lunch subscription for their own child
- **Finance**: Can view all lunch subscriptions and payments
- **Admin**: Full control: CRUD on lunch settings, fees, waivers, subscriptions
- **Teacher**: Read-only access to lunch subscriptions (for classroom context)

---

## Implementation Notes

1. **Default behavior**: If lunch_fee = 0, lunch is not offered (feature disabled for that class)
2. **Backward compatibility**: Existing schools without lunch = automatic lunch_fee = 0
3. **Invoice format**: Lunch fee appears as separate line item for clarity
4. **Payment tracking**: Lunch payments tracked separately in payments table via item_type
5. **Refunds**: If student opts out mid-term, handle proration based on days attended

---

## Configuration Example (SQL)

```sql
-- Enable lunch for Grade 7 at KES 2,500 per term
UPDATE fee_structures 
SET lunch_fee = 2500.00 
WHERE className = 'Grade 7';

-- Enable lunch for all classes
UPDATE fee_structures SET lunch_fee = 2500.00;

-- Disable lunch for Grade 8C
UPDATE fee_structures SET lunch_fee = 0 WHERE className = 'Grade 8C';
```

---

## Next Steps

1. Review this design with your finance/admin team
2. Create database migrations for Phase 1
3. Implement backend API endpoints
4. Build parent portal UI
5. Test with sample data
6. Deploy and collect feedback

