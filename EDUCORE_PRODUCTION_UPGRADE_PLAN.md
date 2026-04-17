# EduCore Production-Safe System Upgrade
## Complete Full-Stack Architecture Redesign

## 🎯 EXECUTIVE SUMMARY

**Objective:** Transform EduCore from basic CRUD operations to a production-grade school management system with proper academic lifecycle management, financial tracking, and enterprise-grade security - **WITHOUT breaking existing functionality**.

**Approach:** Parallel architecture with dual-write systems, zero-downtime migration, and complete rollback capability.

---

## 📊 1. CURRENT SYSTEM ANALYSIS

### **Frontend Architecture**
- **Framework:** React SPA with component-based pages
- **State Management:** Local component state + props drilling
- **Routing:** Simple conditional rendering based on user role
- **Current Issues:**
  - Hardcoded academic year logic in `FeesPage.jsx` (term defaults to "Term 2")
  - No term transition workflows
  - Fee balance display shows only `invoice.balance` (no transaction history)
  - Student promotion UI completely missing
  - No admin dashboards for term management

### **Backend Architecture**
- **Framework:** Express.js with Supabase client
- **API Pattern:** REST endpoints with basic CRUD operations
- **Authentication:** JWT-based with role middleware
- **Current Issues:**
  - Academic year/term logic scattered across routes
  - Fee calculations done in frontend (`money()` utility)
  - No business logic layer for term transitions
  - Student promotion logic completely missing
  - Balance tracking relies on simple invoice fields

### **Database Architecture**
- **Platform:** PostgreSQL via Supabase
- **Multi-tenancy:** `school_id` foreign keys
- **Current Issues:**
  - `classes.academic_year` is SMALLINT (hardcoded years)
  - `invoices.term` and `payments.term` are VARCHAR (inconsistent)
  - No student enrollment history (students tied directly to classes)
  - Fee balance is just `total - amount_paid` (no transaction ledger)
  - No audit trails for financial changes
  - No term lifecycle states

### **Security & Permissions**
- **Current:** Basic role checking (`requireRoles` middleware)
- **Roles:** admin, teacher, finance, hr, librarian, parent, student
- **Issues:** No granular permissions, no term-based restrictions, no financial approval workflows

---

## 🏗️ 2. DATABASE DESIGN (NON-DESTRUCTIVE)

### **New Tables (Zero Impact on Existing Data)**

```sql
-- Academic Calendar Management
CREATE TABLE academic_years (
  academic_year_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  year_label VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','completed')),
  legacy_year_value SMALLINT NULL, -- Maps to classes.academic_year
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, year_label)
);

CREATE TABLE terms (
  term_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(academic_year_id),
  term_name VARCHAR(40) NOT NULL,
  term_order INTEGER NOT NULL, -- 1, 2, 3
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','locked')),
  legacy_term_value VARCHAR(40) NULL, -- Maps to invoices.term
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, academic_year_id, term_name)
);

-- Student Lifecycle Management
CREATE TABLE student_enrollments (
  enrollment_id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  class_id BIGINT NOT NULL REFERENCES classes(class_id),
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(academic_year_id),
  enrollment_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','withdrawn','graduated','transferred','promoted')),
  enrollment_type VARCHAR(20) DEFAULT 'regular' CHECK (enrollment_type IN ('regular','transfer','repeat')),
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, academic_year_id, is_current) -- Only one current enrollment per year
);

CREATE TABLE promotion_rules (
  rule_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  from_class_pattern VARCHAR(100) NOT NULL, -- 'Grade %' or specific class names
  to_class_pattern VARCHAR(100) NOT NULL,
  minimum_percentage DECIMAL(5,2) NULL,
  auto_promote BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE promotion_decisions (
  decision_id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  from_enrollment_id BIGINT NOT NULL REFERENCES student_enrollments(enrollment_id),
  to_class_id BIGINT NOT NULL REFERENCES classes(class_id),
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(academic_year_id),
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('promoted','repeat','withdrawn')),
  reason TEXT NULL,
  approved_by BIGINT NULL REFERENCES users(user_id),
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Ledger System
CREATE TABLE fee_balance_ledger (
  ledger_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(academic_year_id),
  term_id BIGINT NULL REFERENCES terms(term_id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('charge','payment','adjustment','carry_forward')),
  transaction_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL, -- Positive for charges, negative for payments
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(20) NOT NULL CHECK (reference_type IN ('invoice','payment','manual','term_carry')),
  reference_id BIGINT NOT NULL,
  description TEXT NULL,
  created_by BIGINT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fee_carry_forwards (
  carry_forward_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  student_id BIGINT NOT NULL REFERENCES students(student_id),
  from_term_id BIGINT NOT NULL REFERENCES terms(term_id),
  to_term_id BIGINT NOT NULL REFERENCES terms(term_id),
  amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(100) DEFAULT 'Unpaid balance carry forward',
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mapping Tables (Link old to new)
CREATE TABLE class_academic_year_mapping (
  mapping_id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(class_id),
  academic_year_id BIGINT NOT NULL REFERENCES academic_years(academic_year_id),
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_term_mapping (
  mapping_id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(invoice_id),
  term_id BIGINT NOT NULL REFERENCES terms(term_id),
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit & Migration Tracking
CREATE TABLE migration_checkpoints (
  checkpoint_id BIGSERIAL PRIMARY KEY,
  migration_phase VARCHAR(50) NOT NULL,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  checkpoint_data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE term_transitions (
  transition_id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES schools(school_id),
  term_id BIGINT NOT NULL REFERENCES terms(term_id),
  transition_type VARCHAR(20) NOT NULL CHECK (transition_type IN ('open','close','lock')),
  triggered_by BIGINT NOT NULL REFERENCES users(user_id),
  transition_data JSONB NULL, -- Store summary stats
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Safe Linking Strategy**
- All new tables reference existing tables via foreign keys
- No existing table modifications
- Legacy data remains intact
- New features work alongside old system

---

## 🔧 3. BACKEND ARCHITECTURE (PARALLEL SERVICES)

### **Service Layer Design**

```
backend/src/services/
├── academic/
│   ├── AcademicYearService.js      # Year management
│   ├── TermService.js              # Term lifecycle
│   └── TermTransitionService.js    # Open/close/lock terms
├── student/
│   ├── StudentEnrollmentService.js # Enrollment tracking
│   └── PromotionService.js         # Student advancement
├── finance/
│   ├── FeeBalanceService.js        # Ledger calculations
│   ├── FeeCarryForwardService.js   # Balance transfers
│   └── InvoiceService.js           # Enhanced invoicing
├── security/
│   ├── PermissionService.js        # Granular permissions
│   └── AuditService.js             # Activity tracking
└── sync/
    └── DualWriteService.js         # Old + new system sync
```

### **Key Service Classes**

#### **AcademicYearService.js**
```javascript
class AcademicYearService {
  // Create academic year from legacy data
  static async initializeFromLegacy(schoolId) {
    const legacyYears = await supabase
      .from('classes')
      .select('academic_year')
      .eq('school_id', schoolId)
      .neq('is_deleted', true);

    // Create academic_years entries
    // Link to existing classes via mapping table
  }

  // Get current academic year (new system)
  static async getCurrentYear(schoolId) {
    return await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single();
  }

  // Fallback to legacy system
  static async getCurrentYearLegacy(schoolId) {
    const { data } = await supabase
      .from('school_settings')
      .select('setting_value')
      .eq('school_id', schoolId)
      .eq('setting_key', 'academic_year')
      .single();
    return data?.setting_value;
  }
}
```

#### **TermTransitionService.js**
```javascript
class TermTransitionService {
  // Close current term (lock data, calculate balances)
  static async closeTerm(schoolId, termId, userId) {
    const client = await supabase.rpc('begin_transaction');
    
    try {
      // 1. Lock the term
      await client
        .from('terms')
        .update({ status: 'completed' })
        .eq('term_id', termId);

      // 2. Calculate unpaid balances
      const unpaidBalances = await this.calculateUnpaidBalances(schoolId, termId);
      
      // 3. Create carry-forward entries
      await this.createCarryForwards(client, schoolId, termId, unpaidBalances);
      
      // 4. Record transition
      await client
        .from('term_transitions')
        .insert({
          school_id: schoolId,
          term_id: termId,
          transition_type: 'close',
          triggered_by: userId,
          transition_data: { unpaidBalances }
        });

      await client.rpc('commit_transaction');
    } catch (error) {
      await client.rpc('rollback_transaction');
      throw error;
    }
  }

  // Open next term
  static async openTerm(schoolId, nextTermId, userId) {
    // Update term status
    // Create new enrollments for promoted students
    // Generate new invoices
  }
}
```

#### **FeeBalanceService.js**
```javascript
class FeeBalanceService {
  // Calculate balance from ledger (new system)
  static async getStudentBalance(schoolId, studentId, academicYearId = null) {
    let query = supabase
      .from('fee_balance_ledger')
      .select('balance_after')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId);
    }

    const { data } = await query;
    return data?.[0]?.balance_after || 0;
  }

  // Fallback to legacy calculation
  static async getStudentBalanceLegacy(schoolId, studentId) {
    const { data } = await supabase
      .from('invoices')
      .select('balance')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_deleted', false);

    return data?.reduce((sum, inv) => sum + parseFloat(inv.balance || 0), 0) || 0;
  }

  // Record transaction in ledger
  static async recordTransaction(params) {
    const {
      schoolId, studentId, academicYearId, termId,
      type, amount, referenceType, referenceId, description, userId
    } = params;

    // Get current balance
    const currentBalance = await this.getStudentBalance(schoolId, studentId, academicYearId);

    // Calculate new balance
    const newBalance = type === 'payment' 
      ? currentBalance - amount 
      : currentBalance + amount;

    // Insert ledger entry
    return await supabase
      .from('fee_balance_ledger')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        academic_year_id: academicYearId,
        term_id: termId,
        transaction_type: type,
        transaction_date: new Date(),
        amount: type === 'payment' ? -amount : amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        reference_type: referenceType,
        reference_id: referenceId,
        description,
        created_by: userId
      });
  }
}
```

#### **DualWriteService.js**
```javascript
class DualWriteService {
  // Write to both old and new systems
  static async createInvoice(invoiceData) {
    const client = await supabase.rpc('begin_transaction');
    
    try {
      // 1. Write to legacy invoices table
      const legacyInvoice = await client
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      // 2. Write to new ledger system
      const academicYear = await AcademicYearService.getCurrentYear(invoiceData.school_id);
      const currentTerm = await TermService.getCurrentTerm(invoiceData.school_id);
      
      await FeeBalanceService.recordTransaction({
        schoolId: invoiceData.school_id,
        studentId: invoiceData.student_id,
        academicYearId: academicYear?.academic_year_id,
        termId: currentTerm?.term_id,
        type: 'charge',
        amount: invoiceData.total,
        referenceType: 'invoice',
        referenceId: legacyInvoice.invoice_id,
        description: 'Invoice created',
        userId: invoiceData.created_by
      });

      await client.rpc('commit_transaction');
      return legacyInvoice;
    } catch (error) {
      await client.rpc('rollback_transaction');
      throw error;
    }
  }
}
```

### **API Endpoints**

#### **Academic Management APIs**
```javascript
// GET /api/academic/years - List academic years
// POST /api/academic/years - Create new year
// GET /api/academic/years/current - Get current year
// PUT /api/academic/years/:id/status - Update year status

// GET /api/academic/terms - List terms
// POST /api/academic/terms - Create term
// PUT /api/academic/terms/:id/status - Update term status
// POST /api/academic/terms/:id/close - Close term
// POST /api/academic/terms/:id/open - Open term
```

#### **Student Management APIs**
```javascript
// GET /api/students/:id/enrollments - Get enrollment history
// POST /api/students/:id/enrollments - Create enrollment
// GET /api/students/:id/promotion-eligibility - Check promotion status
// POST /api/students/:id/promote - Promote student
// GET /api/students/:id/balance - Get current balance (new system)
```

#### **Financial APIs**
```javascript
// GET /api/finance/ledger - Get ledger entries
// GET /api/finance/balance/:studentId - Get student balance
// POST /api/finance/carry-forward - Process carry forwards
// GET /api/finance/term-summary/:termId - Get term financial summary
```

### **Validation & Business Rules**

```javascript
// Term closure validation
const termClosureRules = {
  canCloseTerm: async (termId) => {
    // Check if all invoices are generated
    // Check if payments are reconciled
    // Check if grades are finalized
    return await Promise.all([
      checkInvoicesGenerated(termId),
      checkPaymentsReconciled(termId),
      checkGradesFinalized(termId)
    ]);
  }
};

// Promotion validation
const promotionRules = {
  canPromoteStudent: async (studentId, fromClass, toClass) => {
    const rules = await getPromotionRules(fromClass, toClass);
    const performance = await getStudentPerformance(studentId);
    
    return rules.every(rule => 
      performance.meetsCriteria(rule)
    );
  }
};
```

---

## 🎨 4. FRONTEND REDESIGN (ADMIN EXPERIENCE)

### **New UI Components**

#### **TermManagementPage.jsx**
```jsx
function TermManagementPage({ auth }) {
  const [currentTerm, setCurrentTerm] = useState(null);
  const [upcomingTerms, setUpcomingTerms] = useState([]);
  const [termStats, setTermStats] = useState({});

  useEffect(() => {
    loadTermData();
  }, []);

  const loadTermData = async () => {
    const [termRes, statsRes] = await Promise.all([
      apiFetch('/api/academic/terms/current'),
      apiFetch('/api/academic/terms/stats')
    ]);
    
    setCurrentTerm(termRes.data);
    setTermStats(statsRes.data);
  };

  const handleCloseTerm = async () => {
    if (!confirm('This will lock the term and carry forward unpaid balances. Continue?')) return;
    
    try {
      await apiFetch(`/api/academic/terms/${currentTerm.term_id}/close`, {
        method: 'POST'
      });
      toast.success('Term closed successfully');
      loadTermData();
    } catch (error) {
      toast.error('Failed to close term');
    }
  };

  return (
    <div className="term-management">
      <div className="term-header">
        <h2>Term Management</h2>
        <div className="term-status">
          <Badge status={currentTerm?.status}>
            {currentTerm?.term_name} - {currentTerm?.status}
          </Badge>
        </div>
      </div>

      <div className="term-actions">
        {currentTerm?.status === 'active' && (
          <Btn onClick={handleCloseTerm} variant="danger">
            Close Current Term
          </Btn>
        )}
      </div>

      <div className="term-stats-grid">
        <StatCard 
          title="Active Students" 
          value={termStats.activeStudents} 
        />
        <StatCard 
          title="Unpaid Balance" 
          value={`$${termStats.unpaidBalance}`} 
        />
        <StatCard 
          title="Pending Promotions" 
          value={termStats.pendingPromotions} 
        />
      </div>

      <TermClosureChecklist termId={currentTerm?.term_id} />
    </div>
  );
}
```

#### **StudentPromotionPage.jsx**
```jsx
function StudentPromotionPage({ auth }) {
  const [students, setStudents] = useState([]);
  const [promotionRules, setPromotionRules] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');

  const loadPromotionData = async () => {
    const [studentsRes, rulesRes] = await Promise.all([
      apiFetch('/api/students/promotion-eligible'),
      apiFetch('/api/promotion/rules')
    ]);
    
    setStudents(studentsRes.data);
    setPromotionRules(rulesRes.data);
  };

  const handleBulkPromote = async (studentIds) => {
    try {
      await apiFetch('/api/students/bulk-promote', {
        method: 'POST',
        body: { studentIds, approvedBy: auth.user.user_id }
      });
      toast.success('Students promoted successfully');
      loadPromotionData();
    } catch (error) {
      toast.error('Promotion failed');
    }
  };

  return (
    <div className="promotion-page">
      <div className="promotion-header">
        <h2>Student Promotions</h2>
        <div className="class-filter">
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(cls => (
              <option key={cls.class_id} value={cls.class_name}>
                {cls.class_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <PromotionRulesDisplay rules={promotionRules} />
      
      <StudentPromotionTable 
        students={students}
        onPromote={handleBulkPromote}
        selectedClass={selectedClass}
      />
    </div>
  );
}
```

#### **EnhancedFeesPage.jsx** (Backward Compatible)
```jsx
function EnhancedFeesPage({ auth, ...props }) {
  const [useNewSystem, setUseNewSystem] = useState(false);
  const [ledgerView, setLedgerView] = useState(false);

  // Check if new system is available
  useEffect(() => {
    checkNewSystemAvailability();
  }, []);

  const checkNewSystemAvailability = async () => {
    try {
      await apiFetch('/api/finance/ledger/_check');
      setUseNewSystem(true);
    } catch {
      // New system not available, use legacy
    }
  };

  const getStudentBalance = async (studentId) => {
    if (useNewSystem) {
      const res = await apiFetch(`/api/finance/balance/${studentId}`);
      return res.data.balance;
    } else {
      // Use existing logic
      return props.students.find(s => s.student_id === studentId)?.balance || 0;
    }
  };

  return (
    <div className="fees-page">
      {/* Existing tabs */}
      <div className="fee-tabs">
        <button 
          className={tab === 'payments' ? 'active' : ''} 
          onClick={() => setTab('payments')}
        >
          Payments
        </button>
        <button 
          className={tab === 'structures' ? 'active' : ''} 
          onClick={() => setTab('structures')}
        >
          Fee Structures
        </button>
        
        {/* New tabs (only show if new system available) */}
        {useNewSystem && (
          <>
            <button 
              className={tab === 'ledger' ? 'active' : ''} 
              onClick={() => setTab('ledger')}
            >
              Transaction Ledger
            </button>
            <button 
              className={tab === 'term-summary' ? 'active' : ''} 
              onClick={() => setTab('term-summary')}
            >
              Term Summary
            </button>
          </>
        )}
      </div>

      {/* Render appropriate component based on tab */}
      {tab === 'ledger' && <FeeLedgerView />}
      {tab === 'term-summary' && <TermFinancialSummary />}
      {/* ... existing tab content ... */}
    </div>
  );
}
```

### **Gradual UI Rollout Strategy**

1. **Phase 1:** Add new pages alongside existing ones
   - New pages don't affect existing functionality
   - Admin can access via new menu items

2. **Phase 2:** Enhance existing pages with optional features
   - Add "View Ledger" buttons to existing fee pages
   - Show "New System Available" banners

3. **Phase 3:** Replace legacy views
   - Update default views to use new system
   - Keep legacy views accessible via settings

### **Mobile Responsiveness**
- New admin features work on tablets
- Progressive enhancement for mobile
- Touch-friendly term management workflows

---

## 🔐 5. PERMISSIONS & ROLES (ENTERPRISE SECURITY)

### **Enhanced Role Definitions**

```javascript
const ROLES = {
  SUPER_ADMIN: {
    level: 100,
    permissions: ['*'], // All permissions
    scope: 'system-wide'
  },
  
  SCHOOL_ADMIN: {
    level: 80,
    permissions: [
      'academic.manage',
      'students.manage',
      'finance.approve',
      'reports.view',
      'term.close',
      'promotion.approve'
    ],
    scope: 'school'
  },
  
  ACCOUNTANT: {
    level: 60,
    permissions: [
      'finance.view',
      'finance.create_payments',
      'finance.adjust_balances',
      'reports.financial',
      'term.view_summary'
    ],
    scope: 'school'
  },
  
  TEACHER: {
    level: 40,
    permissions: [
      'students.view_class',
      'grades.manage',
      'attendance.manage',
      'reports.class'
    ],
    scope: 'class'
  }
};
```

### **Granular Permissions System**

#### **PermissionService.js**
```javascript
class PermissionService {
  static PERMISSIONS = {
    // Academic Management
    'academic.view': 'View academic calendar',
    'academic.manage': 'Create/edit academic years and terms',
    'term.close': 'Close academic terms',
    'term.open': 'Open new terms',
    
    // Student Management
    'students.view': 'View student information',
    'students.manage': 'Create/edit student records',
    'enrollment.view': 'View enrollment history',
    'enrollment.manage': 'Manage student enrollments',
    'promotion.view': 'View promotion status',
    'promotion.approve': 'Approve student promotions',
    
    // Financial Management
    'finance.view': 'View financial data',
    'finance.create_payments': 'Record payments',
    'finance.adjust_balances': 'Adjust student balances',
    'finance.approve_adjustments': 'Approve balance adjustments',
    'ledger.view': 'View transaction ledger',
    
    // Reporting
    'reports.view': 'View reports',
    'reports.financial': 'View financial reports',
    'reports.academic': 'View academic reports'
  };

  static async checkPermission(userId, permission, resourceId = null) {
    const user = await this.getUserWithPermissions(userId);
    
    // Super admin bypass
    if (user.role === 'superadmin') return true;
    
    // Check role-based permissions
    if (!user.permissions.includes(permission)) return false;
    
    // Check resource-level access
    return await this.checkResourceAccess(user, permission, resourceId);
  }

  static async checkResourceAccess(user, permission, resourceId) {
    // School scope check
    if (user.scope === 'school' && resourceId) {
      const resourceSchoolId = await this.getResourceSchoolId(resourceId);
      return resourceSchoolId === user.school_id;
    }
    
    // Class scope check for teachers
    if (user.scope === 'class' && permission.includes('class')) {
      return await this.checkClassAccess(user.user_id, resourceId);
    }
    
    return true;
  }
}
```

### **Enhanced Middleware**

#### **advancedAuth.js**
```javascript
export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const hasPermission = await PermissionService.checkPermission(
        req.user.user_id, 
        permission,
        req.params.resourceId || req.body.resourceId
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Insufficient permissions",
          required: permission 
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireTermAccess(action) {
  return async (req, res, next) => {
    const termId = req.params.termId || req.body.termId;
    
    if (!termId) return next();
    
    // Check if term is locked for certain actions
    if (action === 'modify' && await TermService.isTermLocked(termId)) {
      return res.status(403).json({ message: "Term is locked" });
    }
    
    // Check if user can perform action on this term
    const canAccess = await PermissionService.checkTermAccess(
      req.user.user_id, 
      action, 
      termId
    );
    
    if (!canAccess) {
      return res.status(403).json({ message: "Cannot perform this action on locked term" });
    }
    
    next();
  };
}
```

### **Frontend Permission Enforcement**

#### **PermissionGuard.jsx**
```jsx
function PermissionGuard({ permission, children, fallback = null }) {
  const [hasPermission, setHasPermission] = useState(null);
  
  useEffect(() => {
    checkPermission();
  }, [permission]);
  
  const checkPermission = async () => {
    try {
      await apiFetch(`/api/permissions/check/${permission}`);
      setHasPermission(true);
    } catch {
      setHasPermission(false);
    }
  };
  
  if (hasPermission === null) return <div>Loading...</div>;
  if (!hasPermission) return fallback;
  
  return children;
}

// Usage
<PermissionGuard permission="term.close">
  <Btn onClick={closeTerm}>Close Term</Btn>
</PermissionGuard>
```

#### **Conditional UI Rendering**
```jsx
function AdminDashboard({ auth }) {
  return (
    <div className="dashboard">
      <PermissionGuard permission="academic.manage">
        <AcademicManagementCard />
      </PermissionGuard>
      
      <PermissionGuard permission="finance.approve">
        <FinancialApprovalCard />
      </PermissionGuard>
      
      <PermissionGuard permission="promotion.approve">
        <PromotionApprovalCard />
      </PermissionGuard>
    </div>
  );
}
```

### **Audit Logging**

#### **AuditService.js**
```javascript
class AuditService {
  static async logActivity(params) {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent
    } = params;
    
    await supabase
      .from('audit_log')
      .insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: JSON.stringify(details),
        ip_address: ipAddress,
        user_agent: userAgent,
        timestamp: new Date()
      });
  }
}

// Automatic audit logging middleware
export function auditLog(action) {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      // Log after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AuditService.logActivity({
          userId: req.user?.user_id,
          action,
          resourceType: req.route?.path?.split('/')[2], // Extract from URL
          resourceId: req.params?.id,
          details: { method: req.method, body: req.body },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }).catch(console.error); // Don't fail request on audit error
      }
      
      originalSend.call(this, data);
    };
    next();
  };
}
```

---

## 🚀 6. MIGRATION STRATEGY (ZERO-DOWNTIME)

### **Phase 1: Silent Introduction (1-2 days)**

#### **Goals:**
- Introduce new tables and services
- Start collecting data in parallel
- Zero impact on existing functionality

#### **Steps:**
1. **Deploy new database schema**
   ```sql
   -- Run parallel_architecture_migration.sql
   -- Creates all new tables
   ```

2. **Deploy new backend services**
   - Add new route files
   - Deploy service classes
   - Keep existing routes unchanged

3. **Initialize academic data**
   ```sql
   -- Run safe_data_migration.sql
   -- Populates new tables from existing data
   ```

4. **Enable read-only access**
   - New APIs available for reading
   - Old APIs continue working
   - Admin can view new features

#### **Validation:**
```sql
-- Check data consistency
SELECT 
  (SELECT COUNT(*) FROM students WHERE NOT is_deleted) as legacy_students,
  (SELECT COUNT(*) FROM student_enrollments WHERE is_current) as new_enrollments;

-- Verify balances match
SELECT 
  i.student_id,
  i.balance as legacy_balance,
  COALESCE(l.balance_after, 0) as new_balance
FROM invoices i
LEFT JOIN fee_balance_ledger l ON l.student_id = i.student_id
  AND l.reference_type = 'invoice'
  AND l.reference_id = i.invoice_id;
```

### **Phase 2: Dual-Write Activation (1 week)**

#### **Goals:**
- Start writing to both systems
- Validate data consistency
- Prepare for feature rollout

#### **Steps:**
1. **Enable dual-write for new operations**
   ```javascript
   // Modify existing routes to use DualWriteService
   router.post('/payments', async (req, res) => {
     const result = await DualWriteService.createPayment(req.body);
     res.json(result);
   });
   ```

2. **Implement data synchronization**
   - Sync script to copy missing data
   - Validation checks every hour

3. **Configure promotion rules**
   - Set up school-specific rules
   - Test promotion logic

4. **Train administrators**
   - New UI walkthrough
   - Permission assignments

#### **Monitoring:**
- Data consistency alerts
- Performance monitoring
- Error rate tracking

### **Phase 3: Gradual Feature Rollout (2-4 weeks)**

#### **Goals:**
- Enable new features incrementally
- Gather user feedback
- Maintain rollback capability

#### **Steps:**
1. **Week 1: Academic Management**
   - Enable term management UI
   - Train on term closure process

2. **Week 2: Student Promotions**
   - Enable promotion workflows
   - Monitor approval processes

3. **Week 3: Enhanced Financials**
   - Enable ledger view
   - Train on balance carry-forward

4. **Week 4: Full Migration**
   - Switch default views to new system
   - Deprecate legacy features

#### **Rollback Triggers:**
- Data inconsistency > 1%
- Performance degradation > 20%
- User-reported critical issues

### **Phase 4: Legacy Deprecation (1 month)**

#### **Goals:**
- Remove old system dependencies
- Optimize performance
- Full feature utilization

#### **Steps:**
1. **Remove dual-write overhead**
2. **Archive legacy tables**
3. **Update all references**
4. **Performance optimization**

---

## 🛡️ 7. ROLLBACK PLAN

### **Immediate Rollback (5 minutes)**

#### **Database Rollback:**
```sql
-- Drop all new tables (safe, no data loss)
DROP TABLE IF EXISTS term_transitions;
DROP TABLE IF EXISTS migration_checkpoints;
DROP TABLE IF EXISTS invoice_term_mapping;
DROP TABLE IF EXISTS class_academic_year_mapping;
DROP TABLE IF EXISTS fee_carry_forwards;
DROP TABLE IF EXISTS fee_balance_ledger;
DROP TABLE IF EXISTS promotion_decisions;
DROP TABLE IF EXISTS promotion_rules;
DROP TABLE IF EXISTS student_enrollments;
DROP TABLE IF EXISTS terms;
DROP TABLE IF EXISTS academic_years;
```

#### **Application Rollback:**
```javascript
// Revert route changes
const paymentRoutes = process.env.USE_NEW_SYSTEM === 'true' 
  ? newPaymentRoutes 
  : legacyPaymentRoutes;

// Feature flags
const FEATURES = {
  newAcademicSystem: process.env.ENABLE_NEW_ACADEMIC === 'true',
  ledgerSystem: process.env.ENABLE_LEDGER === 'true',
  dualWrite: process.env.ENABLE_DUAL_WRITE === 'true'
};
```

### **Partial Rollback Options**

#### **Disable New Features Only:**
```javascript
// Keep data, disable UI
const featureFlags = {
  showNewTermManagement: false,
  showLedgerView: false,
  useNewBalanceCalculation: false
};
```

#### **Data Synchronization Issues:**
```javascript
// Re-sync from legacy system
class RollbackService {
  static async resyncFromLegacy() {
    // Clear new data
    await supabase.from('fee_balance_ledger').delete();
    
    // Re-import from legacy
    await MigrationService.importLegacyData();
  }
}
```

### **Gradual Rollback (1-7 days)**

#### **Phase Rollback:**
- **Phase 4 → Phase 3:** Re-enable legacy UI
- **Phase 3 → Phase 2:** Disable new features, keep dual-write
- **Phase 2 → Phase 1:** Disable dual-write, keep read-only access

#### **Data Preservation:**
- All legacy data remains intact
- New data archived, not deleted
- Migration logs preserved for analysis

### **Emergency Procedures**

#### **Complete System Restore:**
1. **Stop application**
2. **Restore database backup** (taken before migration)
3. **Deploy previous application version**
4. **Verify system functionality**

#### **Data Recovery:**
```sql
-- If new data needs to be preserved
CREATE TABLE archived_ledger AS 
SELECT * FROM fee_balance_ledger;

-- Restore from archive if needed
INSERT INTO fee_balance_ledger 
SELECT * FROM archived_ledger;
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Pre-Migration (Week 1)**
- [ ] Database schema review and approval
- [ ] Backend service development and testing
- [ ] Frontend component development
- [ ] Permission system configuration
- [ ] Migration script testing on staging
- [ ] Rollback procedure documentation
- [ ] Admin training materials

### **Migration Weekend**
- [ ] Database backup verification
- [ ] Schema deployment
- [ ] Data migration execution
- [ ] Service deployment
- [ ] Basic functionality testing
- [ ] Monitoring setup

### **Post-Migration (Month 1)**
- [ ] Data consistency validation (daily)
- [ ] Performance monitoring
- [ ] User feedback collection
- [ ] Feature rollout scheduling
- [ ] Legacy system monitoring

### **Full Transition (Month 2-3)**
- [ ] Complete feature rollout
- [ ] Legacy system decommissioning
- [ ] Performance optimization
- [ ] Documentation updates

---

## 🎯 SUCCESS METRICS

### **Technical Metrics**
- **Data Consistency:** >99.9% match between old and new systems
- **Performance:** <10% degradation during dual-write
- **Uptime:** 99.9% during migration
- **Error Rate:** <0.1% for new features

### **Business Metrics**
- **Term Closure Time:** Reduced by 50%
- **Balance Accuracy:** 100% reconciliation
- **Admin Productivity:** Increased by 30%
- **User Satisfaction:** >90% positive feedback

---

## 📞 SUPPORT & MONITORING

### **Monitoring Dashboard**
- Real-time data consistency checks
- Performance metrics
- Error tracking and alerting
- User adoption analytics

### **Support Procedures**
- **Level 1:** Automated monitoring alerts
- **Level 2:** Manual data consistency checks
- **Level 3:** Engineering team intervention
- **Level 4:** Emergency rollback procedures

This comprehensive upgrade plan transforms EduCore from a basic CRUD system to a production-grade school management platform with enterprise-level features, all while maintaining 100% backward compatibility and zero-downtime operation.</content>
<parameter name="filePath">c:\Users\mureg\OneDrive\Desktop\educore\EDUCORE_PRODUCTION_UPGRADE_PLAN.md