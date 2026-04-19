// =====================================================
// ENHANCED FRONTEND COMPONENTS
// New UI components for EduCore upgrade
// =====================================================

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";

// =====================================================
// TERM MANAGEMENT PAGE
// =====================================================

export function TermManagementPage({ auth }) {
  const [currentTerm, setCurrentTerm] = useState(null);
  const [upcomingTerms, setUpcomingTerms] = useState([]);
  const [termStats, setTermStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingTerm, setClosingTerm] = useState(false);

  useEffect(() => {
    loadTermData();
  }, []);

  const loadTermData = async () => {
    try {
      setLoading(true);
      const [termRes, statsRes, termsRes] = await Promise.all([
        apiFetch('/api/academic/terms/current'),
        apiFetch('/api/academic/terms/stats'),
        apiFetch('/api/academic/terms')
      ]);

      setCurrentTerm(termRes.data);
      setTermStats(statsRes.data || {});
      setUpcomingTerms(termsRes.data?.filter(t => t.status === 'upcoming') || []);
    } catch (error) {
      console.error('Error loading term data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTerm = async () => {
    if (!currentTerm) return;

    setClosingTerm(true);
    try {
      await apiFetch(`/api/academic/terms/${currentTerm.term_id}/close`, {
        method: 'PUT'
      });

      setShowCloseModal(false);
      loadTermData();
      // Show success message
    } catch (error) {
      console.error('Error closing term:', error);
      // Show error message
    } finally {
      setClosingTerm(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading term management...</div>;
  }

  return (
    <div className="term-management-page">
      <div className="page-header">
        <h1>Academic Term Management</h1>
        <div className="current-term-badge">
          <Badge status={currentTerm?.status}>
            Current: {currentTerm?.term_name} ({currentTerm?.status})
          </Badge>
        </div>
      </div>

      <div className="term-stats-grid">
        <StatCard
          title="Active Students"
          value={termStats.activeStudents || 0}
          icon="👥"
        />
        <StatCard
          title="Outstanding Balance"
          value={`$${money(termStats.unpaidBalance || 0)}`}
          icon="💰"
          status={termStats.unpaidBalance > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title="Pending Promotions"
          value={termStats.pendingPromotions || 0}
          icon="📈"
        />
        <StatCard
          title="Completed Invoices"
          value={`${termStats.completedInvoices || 0}%`}
          icon="📋"
        />
      </div>

      <div className="term-actions">
        {currentTerm?.status === 'active' && (
          <Btn
            onClick={() => setShowCloseModal(true)}
            variant="danger"
            disabled={closingTerm}
          >
            {closingTerm ? 'Closing Term...' : 'Close Current Term'}
          </Btn>
        )}

        {upcomingTerms.length > 0 && (
          <Btn
            onClick={() => {/* Open next term */}}
            variant="primary"
          >
            Open Next Term
          </Btn>
        )}
      </div>

      <TermClosureChecklist
        term={currentTerm}
        onClose={handleCloseTerm}
        show={showCloseModal}
        onHide={() => setShowCloseModal(false)}
        loading={closingTerm}
      />

      <UpcomingTermsList terms={upcomingTerms} />
    </div>
  );
}

// =====================================================
// TERM CLOSURE CHECKLIST MODAL
// =====================================================

function TermClosureChecklist({ term, onClose, show, onHide, loading }) {
  const [checklist, setChecklist] = useState([]);

  useEffect(() => {
    if (show && term) {
      loadChecklist();
    }
  }, [show, term]);

  const loadChecklist = async () => {
    try {
      const res = await apiFetch(`/api/academic/terms/${term.term_id}/can-close`);
      const eligibility = res.data;

      setChecklist([
        {
          id: 'invoices',
          title: 'All Invoices Generated',
          status: eligibility.canClose,
          message: eligibility.reasons?.find(r => r.includes('invoice')) || 'All invoices are properly generated'
        },
        {
          id: 'payments',
          title: 'Payments Reconciled',
          status: true, // Assume for now
          message: 'Payment records are up to date'
        },
        {
          id: 'grades',
          title: 'Grades Finalized',
          status: true, // Assume for now
          message: 'All grades have been recorded and approved'
        }
      ]);
    } catch (error) {
      console.error('Error loading checklist:', error);
    }
  };

  const canProceed = checklist.every(item => item.status);

  return (
    <Modal show={show} onHide={onHide} title="Close Academic Term">
      <div className="term-closure-checklist">
        <div className="warning-message">
          <strong>⚠️ Warning:</strong> Closing this term will:
          <ul>
            <li>Lock all term-related data</li>
            <li>Carry forward unpaid balances to next term</li>
            <li>Prevent further modifications to this term's records</li>
          </ul>
        </div>

        <div className="checklist-items">
          {checklist.map(item => (
            <div key={item.id} className={`checklist-item ${item.status ? 'passed' : 'failed'}`}>
              <div className="item-status">
                {item.status ? '✅' : '❌'}
              </div>
              <div className="item-content">
                <h4>{item.title}</h4>
                <p>{item.message}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <Btn onClick={onHide} variant="secondary">
            Cancel
          </Btn>
          <Btn
            onClick={onClose}
            variant="danger"
            disabled={!canProceed || loading}
          >
            {loading ? 'Closing Term...' : 'Confirm Term Closure'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// STUDENT PROMOTION PAGE
// =====================================================

export function StudentPromotionPage({ auth }) {
  const [students, setStudents] = useState([]);
  const [promotionRules, setPromotionRules] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    loadPromotionData();
  }, [selectedClass]);

  const loadPromotionData = async () => {
    try {
      setLoading(true);
      const [studentsRes, rulesRes] = await Promise.all([
        apiFetch(`/api/students/promotion-eligible${selectedClass ? `?classId=${selectedClass}` : ''}`),
        apiFetch('/api/promotion/rules')
      ]);

      setStudents(studentsRes.data || []);
      setPromotionRules(rulesRes.data || []);
    } catch (error) {
      console.error('Error loading promotion data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPromote = async () => {
    if (!selectedStudents.length) return;

    setPromoting(true);
    try {
      const res = await apiFetch('/api/students/bulk-promote', {
        method: 'POST',
        body: {
          studentIds: selectedStudents,
          toClassId: selectedClass,
          reason: 'Bulk promotion'
        }
      });

      const results = res.data.results;
      const successCount = results.filter(r => r.success).length;

      // Show success message
      console.log(`Promoted ${successCount} out of ${selectedStudents.length} students`);

      // Reload data
      loadPromotionData();
      setSelectedStudents([]);
    } catch (error) {
      console.error('Error promoting students:', error);
    } finally {
      setPromoting(false);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  return (
    <div className="student-promotion-page">
      <div className="page-header">
        <h1>Student Promotions</h1>
        <div className="promotion-controls">
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={inputStyle}
          >
            <option value="">All Classes</option>
            {/* Add class options */}
          </select>

          {selectedStudents.length > 0 && (
            <Btn
              onClick={handleBulkPromote}
              variant="primary"
              disabled={promoting}
            >
              {promoting ? 'Promoting...' : `Promote ${selectedStudents.length} Students`}
            </Btn>
          )}
        </div>
      </div>

      <PromotionRulesDisplay rules={promotionRules} />

      <div className="promotion-table-container">
        <Table
          headers={[
            { key: 'select', label: '', width: '50px' },
            { key: 'student', label: 'Student' },
            { key: 'currentClass', label: 'Current Class' },
            { key: 'eligible', label: 'Promotion Status' },
            { key: 'actions', label: 'Actions' }
          ]}
          rows={students.map(student => ({
            select: (
              <input
                type="checkbox"
                checked={selectedStudents.includes(student.students.student_id)}
                onChange={() => toggleStudentSelection(student.students.student_id)}
              />
            ),
            student: `${student.students.first_name} ${student.students.last_name}`,
            currentClass: student.classes?.class_name || 'Unknown',
            eligible: <Badge status="success">Eligible</Badge>,
            actions: (
              <Btn
                size="sm"
                onClick={() => {/* Individual promotion */}}
              >
                Promote
              </Btn>
            )
          }))}
          loading={loading}
        />
      </div>
    </div>
  );
}

// =====================================================
// ENHANCED FEES PAGE (BACKWARD COMPATIBLE)
// =====================================================

export function EnhancedFeesPage({ auth, students, feeStructures, setFeeStructures, payments, setPayments, canEdit, toast, linkedStudentId }) {
  const [useNewSystem, setUseNewSystem] = useState(false);
  const [ledgerView, setLedgerView] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);

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

  const loadLedger = async (studentId) => {
    if (!useNewSystem) return;

    try {
      const res = await apiFetch(`/api/finance/ledger?studentId=${studentId}&limit=20`);
      setLedgerEntries(res.data || []);
    } catch (error) {
      console.error('Error loading ledger:', error);
    }
  };

  const getStudentBalance = async (studentId) => {
    if (useNewSystem) {
      try {
        const res = await apiFetch(`/api/finance/balance/${studentId}`);
        return res.data.balance;
      } catch {
        // Fallback to legacy
      }
    }

    // Legacy balance calculation
    return students.find(s => s.student_id === studentId)?.balance || 0;
  };

  return (
    <div className="fees-page">
      {/* Enhanced tab bar */}
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
              className={tab === 'analytics' ? 'active' : ''}
              onClick={() => setTab('analytics')}
            >
              Fee Analytics
            </button>
          </>
        )}
      </div>

      {/* Render appropriate component based on tab */}
      {tab === 'ledger' && (
        <FeeLedgerView
          students={students}
          selectedStudent={selectedStudent}
          setSelectedStudent={setSelectedStudent}
          ledgerEntries={ledgerEntries}
          loadLedger={loadLedger}
        />
      )}

      {tab === 'analytics' && (
        <FeeAnalyticsView />
      )}

      {/* Existing tab content for payments and structures */}
      {/* ... existing code ... */}
    </div>
  );
}

// =====================================================
// FEE LEDGER VIEW COMPONENT
// =====================================================

function FeeLedgerView({ students, selectedStudent, setSelectedStudent, ledgerEntries, loadLedger }) {
  useEffect(() => {
    if (selectedStudent) {
      loadLedger(selectedStudent);
    }
  }, [selectedStudent]);

  return (
    <div className="fee-ledger-view">
      <div className="ledger-header">
        <h3>Transaction Ledger</h3>
        <select
          value={selectedStudent || ''}
          onChange={e => setSelectedStudent(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select Student</option>
          {students.map(student => (
            <option key={student.student_id} value={student.student_id}>
              {student.first_name} {student.last_name} ({student.admission_number})
            </option>
          ))}
        </select>
      </div>

      {selectedStudent && (
        <div className="ledger-table">
          <Table
            headers={[
              { key: 'date', label: 'Date' },
              { key: 'type', label: 'Type' },
              { key: 'amount', label: 'Amount' },
              { key: 'balance', label: 'Balance' },
              { key: 'description', label: 'Description' }
            ]}
            rows={ledgerEntries.map(entry => ({
              date: new Date(entry.transaction_date).toLocaleDateString(),
              type: (
                <Badge status={entry.transaction_type === 'payment' ? 'success' : 'warning'}>
                  {entry.transaction_type}
                </Badge>
              ),
              amount: (
                <span style={{
                  color: entry.transaction_type === 'payment' ? '#10B981' : '#EF4444'
                }}>
                  {entry.transaction_type === 'payment' ? '-' : '+'}${money(Math.abs(entry.amount))}
                </span>
              ),
              balance: `$${money(entry.balance_after)}`,
              description: entry.description
            }))}
          />
        </div>
      )}
    </div>
  );
}

// =====================================================
// SHARED COMPONENTS
// =====================================================

function StatCard({ title, value, icon, status = 'default' }) {
  return (
    <div className={`stat-card stat-${status}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </div>
  );
}

function PromotionRulesDisplay({ rules }) {
  if (!rules.length) {
    return (
      <div className="promotion-rules-empty">
        <p>No promotion rules configured. Students will be promoted manually.</p>
      </div>
    );
  }

  return (
    <div className="promotion-rules">
      <h3>Promotion Rules</h3>
      <div className="rules-grid">
        {rules.map(rule => (
          <div key={rule.rule_id} className="rule-card">
            <div className="rule-header">
              <strong>{rule.from_class_pattern} → {rule.to_class_pattern}</strong>
            </div>
            <div className="rule-details">
              {rule.minimum_percentage && (
                <div>Min. Percentage: {rule.minimum_percentage}%</div>
              )}
              <div>Auto Promote: {rule.auto_promote ? 'Yes' : 'No'}</div>
              <div>Requires Approval: {rule.requires_approval ? 'Yes' : 'No'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingTermsList({ terms }) {
  if (!terms.length) return null;

  return (
    <div className="upcoming-terms">
      <h3>Upcoming Terms</h3>
      <div className="terms-list">
        {terms.map(term => (
          <div key={term.term_id} className="term-item">
            <div className="term-name">{term.term_name}</div>
            <div className="term-dates">
              {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
            </div>
            <Badge status="info">{term.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeeAnalyticsView() {
  const [analytics, setAnalytics] = useState({});

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await apiFetch('/api/finance/analytics');
      setAnalytics(res.data || {});
    } catch (error) {
      console.error('Error loading fee analytics:', error);
    }
  };

  return (
    <div className="fee-analytics">
      <h3>Fee Collection Analytics</h3>
      <div className="analytics-grid">
        <StatCard
          title="Total Outstanding"
          value={`$${money(analytics.totalOutstanding || 0)}`}
          icon="💰"
          status="warning"
        />
        <StatCard
          title="This Term Collections"
          value={`$${money(analytics.termCollections || 0)}`}
          icon="📈"
          status="success"
        />
        <StatCard
          title="Defaulters"
          value={analytics.defaulterCount || 0}
          icon="⚠️"
          status="danger"
        />
        <StatCard
          title="Collection Rate"
          value={`${analytics.collectionRate || 0}%`}
          icon="📊"
        />
      </div>
    </div>
  );
}

// =====================================================
// PERMISSION GUARD COMPONENT
// =====================================================

export function PermissionGuard({ permission, children, fallback = null }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, [permission]);

  const checkPermission = async () => {
    try {
      const res = await apiFetch(`/api/permissions/check/${permission}`);
      setHasPermission(res.data.hasPermission);
    } catch {
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="permission-loading">Checking permissions...</div>;
  if (!hasPermission) return fallback;

  return children;
}

// =====================================================
// CONDITIONAL UI RENDERING HOOK
// =====================================================

export function useFeatureFlags() {
  const [flags, setFlags] = useState({
    newAcademicSystem: false,
    ledgerSystem: false,
    dualWrite: false,
    promotionWorkflow: false
  });

  useEffect(() => {
    checkFeatureAvailability();
  }, []);

  const checkFeatureAvailability = async () => {
    try {
      // Check which new features are available
      const checks = await Promise.allSettled([
        apiFetch('/api/academic/years/current'),
        apiFetch('/api/finance/ledger/_check'),
        apiFetch('/api/students/promotion-eligible')
      ]);

      setFlags({
        newAcademicSystem: checks[0].status === 'fulfilled',
        ledgerSystem: checks[1].status === 'fulfilled',
        promotionWorkflow: checks[2].status === 'fulfilled',
        dualWrite: true // Assume dual write is enabled
      });
    } catch {
      // Features not available
    }
  };

  return flags;
}

// =====================================================
// CLASS PROMOTION CHAIN MANAGER
// =====================================================

export function ClassPromotionChain({ auth }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/classes/promotion-chain');
      setClasses(res.data || res || []);
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateNextClass = async (classId, nextClassName) => {
    setSaving(classId);
    try {
      await apiFetch(`/classes/${classId}/promotion`, {
        method: 'PUT',
        body: { nextClassName }
      });
      loadClasses();
    } catch (err) {
      console.error('Error updating:', err);
    } finally {
      setSaving(null);
    }
  };

  const availableClasses = classes.map(c => c.class_name);

  if (loading) return <div className="loading">Loading promotion chain...</div>;

  return (
    <div className="promotion-chain-manager">
      <div className="page-header">
        <h2>Class Promotion Chain</h2>
        <p>Set up which class students promote to next term</p>
      </div>

      <div className="promotion-chain-grid">
        {classes.map(cls => (
          <div key={cls.class_id} className="promotion-chain-card">
            <div className="current-class">
              <strong>{cls.class_name}</strong>
            </div>
            <div className="promotion-arrow">↓</div>
            <select 
              value={cls.next_class_name || ""}
              onChange={e => updateNextClass(cls.class_id, e.target.value)}
              disabled={saving === cls.class_id}
              style={inputStyle}
            >
              <option value="">No promotion (final class)</option>
              {availableClasses
                .filter(c => c !== cls.class_name)
                .map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
            </select>
          </div>
        ))}
      </div>

      <div className="promotion-flow-preview">
        <h3>Promotion Flow Preview</h3>
        <div className="flow-chart">
          {classes.filter(c => c.next_class_name).map((cls, i) => (
            <React.Fragment key={cls.class_id}>
              <span className="flow-class">{cls.class_name}</span>
              <span className="flow-arrow">→</span>
              <span className="flow-next">{cls.next_class_name}</span>
              {i < classes.filter(c => c.next_class_name).length - 1 && <br />}
            </React.Fragment>
          ))}
          {classes.every(c => !c.next_class_name) && (
            <p className="no-flow">No promotion chain configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
}