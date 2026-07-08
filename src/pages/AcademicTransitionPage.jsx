import { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { C } from "../lib/theme";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import Card from "../components/ui/Card";

export default function AcademicTransitionPage({ auth }) {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState(0);

  const [closingTerm, setClosingTerm] = useState(false);
  const [endingYear, setEndingYear] = useState(false);

  const [showTermModal, setShowTermModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);

  const [termResult, setTermResult] = useState(null);
  const [yearResult, setYearResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [yearRes, termRes, classesRes, studentsRes] = await Promise.all([
        apiFetch('/academic/years/current', { token: auth?.token }).catch(() => ({ data: null })),
        apiFetch('/academic/terms/current', { token: auth?.token }).catch(() => ({ data: null })),
        apiFetch('/classes/promotion-chain', { token: auth?.token }).catch(() => ({ data: [] })),
        apiFetch('/students/promotion-eligible', { token: auth?.token }).catch(() => ({ data: [] })),
      ]);

      setCurrent({
        academicYear: yearRes?.data || yearRes || null,
        term: termRes?.data || termRes || null,
      });
      setClasses(classesRes?.data || classesRes || []);
      setStudents((studentsRes?.data || studentsRes || []).length);
    } catch (error) {
      console.error('Error loading academic data:', error);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCloseTerm = async () => {
    if (!current?.term?.term_id) return;
    setClosingTerm(true);
    setTermResult(null);
    try {
      const res = await apiFetch(`/academic/terms/${current.term.term_id}/end-term`, {
        method: 'POST',
        token: auth?.token,
        body: {
          carryForwardBalances: true,
          archiveGrades: true,
        }
      });
      setTermResult(res);
      setShowTermModal(false);
      await loadData();
    } catch (error) {
      setTermResult({ error: error.message || 'Failed to close term' });
      setShowTermModal(false);
    } finally {
      setClosingTerm(false);
    }
  };

  const handleEndYear = async () => {
    if (!current?.academicYear?.academic_year_id) return;
    setEndingYear(true);
    setYearResult(null);
    try {
      const res = await apiFetch(`/academic/years/${current.academicYear.academic_year_id}/end-year`, {
        method: 'POST',
        token: auth?.token,
        body: {
          createNextYear: true,
          promoteStudents: true,
          carryForwardBalances: true,
        }
      });
      setYearResult(res);
      setShowYearModal(false);
      await loadData();
    } catch (error) {
      setYearResult({ error: error.message || 'Failed to end academic year' });
      setShowYearModal(false);
    } finally {
      setEndingYear(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.textSub }}>Loading academic data...</div>;
  }

  const currentTerm = current?.term;
  const currentYear = current?.academicYear;
  const activeTerm = currentTerm;
  const hasPromotionChain = classes.some(c => c.next_class_name);
  const isConfigured = currentTerm || currentYear;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: C.text, fontSize: 26, fontWeight: 700 }}>Academic Transition</h1>
        <p style={{ margin: '6px 0 0', color: C.textSub, fontSize: 14 }}>
          Close terms and end academic years. Student records and fees will be carried forward automatically.
        </p>
      </div>

      {!isConfigured && (
        <Card style={{ marginBottom: 16, border: '1px solid #F59E0B', background: 'rgba(245,158,11,0.08)' }}>
          <div style={{ color: '#F59E0B', fontWeight: 600 }}>Academic calendar not configured</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>
            No active academic year or term is set. Please configure an academic year and term in Settings before closing a term or ending a year.
          </div>
        </Card>
      )}

      {termResult?.error && (
        <Card style={{ marginBottom: 16, border: '1px solid #F43F5E', background: 'rgba(244,63,94,0.08)' }}>
          <div style={{ color: '#F43F5E', fontWeight: 600 }}>Term Close Failed</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>{termResult.error}</div>
        </Card>
      )}

      {yearResult?.error && (
        <Card style={{ marginBottom: 16, border: '1px solid #F43F5E', background: 'rgba(244,63,94,0.08)' }}>
          <div style={{ color: '#F43F5E', fontWeight: 600 }}>Year End Failed</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>{yearResult.error}</div>
        </Card>
      )}

      {termResult?.summary && (
        <Card style={{ marginBottom: 16, border: '1px solid #22C55E', background: 'rgba(34,197,94,0.08)' }}>
          <div style={{ color: '#22C55E', fontWeight: 600 }}>Term Closed Successfully</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>
            {termResult.summary.promoted || 0} students promoted · {termResult.summary.balancesCarriedForward || 0} balances carried forward
          </div>
        </Card>
      )}

      {yearResult?.summary && (
        <Card style={{ marginBottom: 16, border: '1px solid #22C55E', background: 'rgba(34,197,94,0.08)' }}>
          <div style={{ color: '#22C55E', fontWeight: 600 }}>Academic Year Ended Successfully</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>
            {yearResult.summary.promoted || 0} students promoted · {yearResult.summary.balancesCarriedForward || 0} balances carried forward
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Year</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {currentYear?.year_label || currentYear?.academic_year || 'Not set'}
          </div>
          <div style={{ marginTop: 8 }}>
            <Badge status={currentYear?.is_closed ? 'danger' : 'success'}>
              {currentYear?.is_closed ? 'Closed' : 'Active'}
            </Badge>
          </div>
        </Card>

        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current Term</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {activeTerm?.term_name || 'Not set'}
          </div>
          <div style={{ marginTop: 8 }}>
            <Badge status={activeTerm?.status === 'active' ? 'success' : activeTerm?.status === 'closed' ? 'danger' : 'default'}>
              {activeTerm?.status || 'Unknown'}
            </Badge>
          </div>
        </Card>

        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Promotion Chain</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {classes.length} classes
          </div>
          <div style={{ marginTop: 8 }}>
            <Badge status={hasPromotionChain ? 'success' : 'warning'}>
              {hasPromotionChain ? 'Configured' : 'Not configured'}
            </Badge>
          </div>
        </Card>

        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Eligible Students</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {students}
          </div>
          <div style={{ marginTop: 8, color: C.textSub, fontSize: 12 }}>Ready for promotion</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 6px', color: C.text, fontSize: 18, fontWeight: 700 }}>Close Current Term</h3>
            <p style={{ margin: 0, color: C.textSub, fontSize: 13 }}>
              Finalize {activeTerm?.term_name || 'the current term'}. Grades will be archived, unpaid balances carried forward, and students promoted to their next class based on the promotion chain.
            </p>
          </div>

          {!hasPromotionChain && (
            <div style={{ background: C.amberDim, border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#F59E0B' }}>
              ⚠️ Promotion chain is not configured. Configure it in Settings → Promotion Chain before closing the term.
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <Btn
              onClick={() => setShowTermModal(true)}
              disabled={!activeTerm || activeTerm.status === 'closed' || closingTerm}
              style={{ width: '100%' }}
            >
              {closingTerm ? 'Closing Term...' : activeTerm?.status === 'closed' ? 'Term Already Closed' : 'Close Current Term'}
            </Btn>
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 6px', color: C.text, fontSize: 18, fontWeight: 700 }}>End Academic Year</h3>
            <p style={{ margin: 0, color: C.textSub, fontSize: 13 }}>
              Close all remaining terms, promote all students to the next academic year, carry forward balances, and automatically create the next year.
            </p>
          </div>

          {currentYear?.is_closed && (
            <div style={{ background: C.roseDim, border: '1px solid #F43F5E', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#F43F5E' }}>
              This academic year is already closed.
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <Btn
              onClick={() => setShowYearModal(true)}
              disabled={!currentYear || currentYear.is_closed || endingYear}
              variant="primary"
              style={{ width: '100%' }}
            >
              {endingYear ? 'Ending Year...' : currentYear?.is_closed ? 'Year Already Ended' : 'End Academic Year'}
            </Btn>
          </div>
        </Card>
      </div>

      <TermConfirmModal
        show={showTermModal}
        onHide={() => setShowTermModal(false)}
        onConfirm={handleCloseTerm}
        loading={closingTerm}
        term={activeTerm}
        classes={classes}
      />

      <YearConfirmModal
        show={showYearModal}
        onHide={() => setShowYearModal(false)}
        onConfirm={handleEndYear}
        loading={endingYear}
        year={currentYear}
        classes={classes}
        students={students}
      />
    </div>
  );
}

AcademicTransitionPage.propTypes = {
  auth: PropTypes.object,
};

function TermConfirmModal({ show, onHide, onConfirm, loading, term, classes }) {
  const promotedCount = classes.filter(c => c.next_class_name).length;
  const finalClasses = classes.filter(c => !c.next_class_name).length;

  return (
    <Modal isOpen={show} onHide={onHide} title="Close Current Term">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: C.amberDim, border: '1px solid #F59E0B', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#F59E0B' }}>
          <strong>Warning:</strong> This will lock {term?.term_name || 'the term'} and promote students to their next class. This action cannot be undone.
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Archive grades</span>
            <span style={{ color: '#22C55E' }}>Yes</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Carry forward unpaid balances</span>
            <span style={{ color: '#22C55E' }}>Yes</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Promote students to next class</span>
            <span style={{ color: '#22C55E' }}>{promotedCount} chains</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Final classes (no promotion)</span>
            <span style={{ color: C.textSub }}>{finalClasses}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <Btn onClick={onHide} variant="secondary">Cancel</Btn>
          <Btn onClick={onConfirm} variant="danger" disabled={loading}>
            {loading ? 'Closing Term...' : 'Confirm Term Closure'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

TermConfirmModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  term: PropTypes.object,
  classes: PropTypes.array,
};

function YearConfirmModal({ show, onHide, onConfirm, loading, year, classes, students }) {
  const promotedCount = classes.filter(c => c.next_class_name).length;

  return (
    <Modal isOpen={show} onHide={onHide} title="End Academic Year">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid #F43F5E', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#F43F5E' }}>
          <strong>Warning:</strong> This will close {year?.year_label || 'the academic year'} and all its terms, promote all students, and create the next academic year. This cannot be undone.
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Academic year</span>
            <span style={{ fontWeight: 600 }}>{year?.year_label || year?.academic_year || 'Unknown'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Students to promote</span>
            <span style={{ fontWeight: 600 }}>{students}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Promotion chains</span>
            <span style={{ fontWeight: 600 }}>{promotedCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Create next year</span>
            <span style={{ color: '#22C55E' }}>Yes</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.text }}>
            <span>Carry forward balances</span>
            <span style={{ color: '#22C55E' }}>Yes</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          <Btn onClick={onHide} variant="secondary">Cancel</Btn>
          <Btn onClick={onConfirm} variant="danger" disabled={loading}>
            {loading ? 'Ending Year...' : 'Confirm Year End'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

YearConfirmModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  year: PropTypes.object,
  classes: PropTypes.array,
  students: PropTypes.number,
};
