import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Btn from '../components/Btn';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Table from '../components/Table';
import Field from '../components/Field';
import { C, inputStyle } from '../lib/theme';
import { apiFetch } from '../lib/api';
import { Msg } from '../components/Helpers';

/**
 * TermManagementPage - Academic calendar and term lifecycle management
 * Allows directors/admins to open, close, and lock terms
 */
export default function TermManagementPage({ auth, toast }) {
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [pendingTerm, setPendingTerm] = useState(null);
  const [termStatus, setTermStatus] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Form states
  const [yearForm, setYearForm] = useState({
    year_label: '',
    start_date: '',
    end_date: '',
    terms: [
      { name: 'Term 1', startDate: '', endDate: '' },
      { name: 'Term 2', startDate: '', endDate: '' },
      { name: 'Term 3', startDate: '', endDate: '' }
    ]
  });

  // Load academic years on mount
  useEffect(() => {
    loadAcademicYears();
  }, []);

  const loadAcademicYears = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/academic-years', { token: auth.token });
      setAcademicYears(data.data || []);
    } catch (err) {
      toast('Failed to load academic years: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYear = async () => {
    try {
      setProcessing(true);
      await apiFetch('/academic-years', {
        method: 'POST',
        token: auth.token,
        body: yearForm
      });
      
      toast('Academic year created successfully', 'success');
      setShowCreateModal(false);
      loadAcademicYears();
      
      // Reset form
      setYearForm({
        year_label: '',
        start_date: '',
        end_date: '',
        terms: [
          { name: 'Term 1', startDate: '', endDate: '' },
          { name: 'Term 2', startDate: '', endDate: '' },
          { name: 'Term 3', startDate: '', endDate: '' }
        ]
      });
    } catch (err) {
      toast(err.message || 'Failed to create academic year', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const initiateCloseTerm = async (term) => {
    try {
      // Get term status for close validation
      const status = await apiFetch(`/terms/${term.term_id}/status`, { token: auth.token });
      setTermStatus(status.data);
      setPendingTerm(term);
      setShowCloseModal(true);
    } catch (err) {
      toast(err.message || 'Failed to get term status', 'error');
    }
  };

  const executeCloseTerm = async (reason) => {
    if (!pendingTerm) return;
    
    try {
      setProcessing(true);
      const result = await apiFetch(`/terms/${pendingTerm.term_id}/transition`, {
        method: 'POST',
        token: auth.token,
        body: {
          transition_type: 'close',
          reason
        }
      });

      toast(
        `Term closed. ${result.data.carry_forwards_created || 0} balances carried forward.`,
        'success'
      );
      setShowCloseModal(false);
      loadAcademicYears();
    } catch (err) {
      toast(err.message || 'Failed to close term', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const initiateLockTerm = (term) => {
    setPendingTerm(term);
    setShowLockModal(true);
  };

  const executeLockTerm = async (reason) => {
    if (!pendingTerm) return;
    
    try {
      setProcessing(true);
      await apiFetch(`/terms/${pendingTerm.term_id}/transition`, {
        method: 'POST',
        token: auth.token,
        body: {
          transition_type: 'lock',
          reason
        }
      });

      toast('Term locked successfully - now immutable', 'success');
      setShowLockModal(false);
      loadAcademicYears();
    } catch (err) {
      toast(err.message || 'Failed to lock term', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status, isCurrent) => {
    const configs = {
      upcoming: { tone: 'info', label: 'Upcoming' },
      active: { tone: 'success', label: 'Active' },
      completed: { tone: 'warning', label: 'Completed' },
      locked: { tone: 'danger', label: 'Locked' }
    };
    
    const config = configs[status] || configs.upcoming;
    
    return (
      <Badge 
        text={isCurrent ? `${config.label} (Current)` : config.label} 
        tone={config.tone} 
      />
    );
  };

  const getActionButtons = (term, year) => {
    const buttons = [];
    
    if (term.status === 'active') {
      buttons.push(
        <Btn 
          key="close"
          size="small" 
          variant="warning"
          onClick={() => initiateCloseTerm(term)}
        >
          Close Term
        </Btn>
      );
    }
    
    if (term.status === 'completed') {
      buttons.push(
        <Btn 
          key="lock"
          size="small" 
          variant="danger"
          onClick={() => initiateLockTerm(term)}
        >
          Lock Term
        </Btn>
      );
    }
    
    return buttons.length > 0 ? <div style={{ display: 'flex', gap: 6 }}>{buttons}</div> : '-';
  };

  if (loading) {
    return <Msg text="Loading academic calendar..." />;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: C.text }}>Academic Calendar</h2>
        {auth.role === 'director' && (
          <Btn onClick={() => setShowCreateModal(true)}>
            + New Academic Year
          </Btn>
        )}
      </div>

      {/* Academic Years List */}
      {academicYears.length === 0 ? (
        <Msg text="No academic years found. Create one to get started." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {academicYears.map(year => (
            <div 
              key={year.academic_year_id}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                overflow: 'hidden'
              }}
            >
              {/* Year Header */}
              <div style={{
                padding: 16,
                background: C.card,
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: C.text, fontSize: 18 }}>
                    Academic Year {year.year_label}
                  </h3>
                  <div style={{ color: C.textMuted, fontSize: 12 }}>
                    {new Date(year.start_date).toLocaleDateString()} - {new Date(year.end_date).toLocaleDateString()}
                  </div>
                </div>
                <Badge 
                  text={year.status} 
                  tone={year.status === 'active' ? 'success' : 'info'} 
                />
              </div>

              {/* Terms Table */}
              <div style={{ padding: 16 }}>
                <Table
                  headers={['Term', 'Dates', 'Status', 'Actions']}
                  rows={year.terms.map(term => [
                    <span key="name" style={{ fontWeight: 600, color: C.text }}>
                      {term.term_name}
                    </span>,
                    <span key="dates" style={{ fontSize: 12, color: C.textMuted }}>
                      {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                    </span>,
                    getStatusBadge(term.status, term.is_current),
                    getActionButtons(term, year)
                  ])}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Academic Year Modal */}
      {showCreateModal && (
        <Modal 
          title="Create New Academic Year" 
          onClose={() => setShowCreateModal(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Year Label (e.g., 2026)">
              <input
                style={inputStyle}
                value={yearForm.year_label}
                onChange={e => setYearForm({...yearForm, year_label: e.target.value})}
                placeholder="2026"
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Start Date">
                <input
                  type="date"
                  style={inputStyle}
                  value={yearForm.start_date}
                  onChange={e => setYearForm({...yearForm, start_date: e.target.value})}
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  style={inputStyle}
                  value={yearForm.end_date}
                  onChange={e => setYearForm({...yearForm, end_date: e.target.value})}
                />
              </Field>
            </div>

            <div style={{ marginTop: 8 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: C.text }}>Terms</h4>
              {yearForm.terms.map((term, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 8,
                    marginBottom: 8,
                    padding: 8,
                    background: C.card,
                    borderRadius: 6
                  }}
                >
                  <input
                    style={{...inputStyle, fontWeight: 600}}
                    value={term.name}
                    onChange={e => {
                      const newTerms = [...yearForm.terms];
                      newTerms[idx].name = e.target.value;
                      setYearForm({...yearForm, terms: newTerms});
                    }}
                  />
                  <input
                    type="date"
                    style={inputStyle}
                    placeholder="Start"
                    value={term.startDate}
                    onChange={e => {
                      const newTerms = [...yearForm.terms];
                      newTerms[idx].startDate = e.target.value;
                      setYearForm({...yearForm, terms: newTerms});
                    }}
                  />
                  <input
                    type="date"
                    style={inputStyle}
                    placeholder="End"
                    value={term.endDate}
                    onChange={e => {
                      const newTerms = [...yearForm.terms];
                      newTerms[idx].endDate = e.target.value;
                      setYearForm({...yearForm, terms: newTerms});
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Btn>
              <Btn 
                onClick={handleCreateYear}
                disabled={processing || !yearForm.year_label || !yearForm.start_date || !yearForm.end_date}
              >
                {processing ? 'Creating...' : 'Create Academic Year'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Term Modal */}
      {showCloseModal && pendingTerm && termStatus && (
        <Modal
          title={`Close Term: ${pendingTerm.term_name}`}
          onClose={() => setShowCloseModal(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Warnings */}
            {termStatus.pending_grades > 0 && (
              <div style={{
                padding: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                color: '#f59e0b'
              }}>
                ⚠️ {termStatus.pending_grades} grades are still unlocked. 
                They will be locked automatically when you close this term.
              </div>
            )}

            {/* Carry Forward Preview */}
            {termStatus.carry_forward_preview && termStatus.carry_forward_preview.length > 0 ? (
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: C.text }}>
                  Carry-Forward Preview
                </h4>
                <div style={{ 
                  maxHeight: 150, 
                  overflow: 'auto',
                  background: C.card,
                  borderRadius: 6,
                  padding: 8
                }}>
                  <Table
                    headers={['Student', 'Class', 'Balance']}
                    rows={termStatus.carry_forward_preview.slice(0, 10).map(c => [
                      c.student_name,
                      c.class_name,
                      `KES ${c.current_balance.toLocaleString()}`
                    ])}
                  />
                  {termStatus.carry_forward_preview.length > 10 && (
                    <div style={{ textAlign: 'center', padding: 8, color: C.textMuted, fontSize: 12 }}>
                      ... and {termStatus.carry_forward_preview.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: C.textMuted, fontSize: 13 }}>
                No balances to carry forward - all students are up to date.
              </div>
            )}

            <Field label="Reason for Closing (optional)">
              <input
                style={inputStyle}
                placeholder="e.g., End of Term 1 2026"
              />
            </Field>

            <div style={{ 
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              fontSize: 12,
              color: C.textSub
            }}>
              <strong>Warning:</strong> This action cannot be undone. Closing the term will:
              <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                <li>Lock all grade entries for this term</li>
                <li>Calculate and carry forward unpaid balances</li>
                <li>Activate the next term</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setShowCloseModal(false)}>
                Cancel
              </Btn>
              <Btn 
                variant="warning"
                onClick={() => executeCloseTerm()}
                disabled={processing}
              >
                {processing ? 'Closing...' : `Close ${pendingTerm.term_name}`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Lock Term Modal */}
      {showLockModal && pendingTerm && (
        <Modal
          title={`Lock Term: ${pendingTerm.term_name}`}
          onClose={() => setShowLockModal(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              color: '#ef4444'
            }}>
              <strong>⚠️ Irreversible Action</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: 13 }}>
                Locking a term makes it <strong>permanently immutable</strong>. 
                No further changes can be made to grades, attendance, or financial records 
                for this term after locking.
              </p>
            </div>

            <Field label="Reason for Locking (optional)">
              <input
                style={inputStyle}
                placeholder="e.g., Financial audit complete"
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setShowLockModal(false)}>
                Cancel
              </Btn>
              <Btn 
                variant="danger"
                onClick={() => executeLockTerm()}
                disabled={processing}
              >
                {processing ? 'Locking...' : `Lock ${pendingTerm.term_name}`}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

TermManagementPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
