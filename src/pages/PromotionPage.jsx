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
 * PromotionPage - Student promotion management
 * Analyze promotion eligibility and execute promotions
 */
export default function PromotionPage({ auth, toast }) {
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [nextYear, setNextYear] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [decisions, setDecisions] = useState({});
  const [promotionRules, setPromotionRules] = useState([]);

  // Load initial data
  useEffect(() => {
    loadClasses();
    loadAcademicYears();
    loadPromotionRules();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await apiFetch('/classes', { token: auth.token });
      setClasses(data.data || data || []);
    } catch (err) {
      toast('Failed to load classes', 'error');
    }
  };

  const loadAcademicYears = async () => {
    try {
      const data = await apiFetch('/academic-years', { token: auth.token });
      const years = data.data || [];
      setAcademicYears(years);
      
      // Find next year for promotions
      const currentYear = years.find(y => y.is_current);
      if (currentYear) {
        const next = years.find(y => 
          new Date(y.start_date) > new Date(currentYear.end_date)
        );
        setNextYear(next);
        setSelectedYear(currentYear.academic_year_id);
      }
    } catch (err) {
      toast('Failed to load academic years', 'error');
    }
  };

  const loadPromotionRules = async () => {
    try {
      const data = await apiFetch('/promotions/rules', { token: auth.token });
      setPromotionRules(data.data || []);
    } catch (err) {
      // Rules might not exist yet
      setPromotionRules([]);
    }
  };

  const analyzePromotions = async () => {
    if (!selectedClass || !selectedYear) {
      toast('Please select a class and academic year', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await apiFetch('/promotions/analyze', {
        method: 'POST',
        token: auth.token,
        body: {
          class_id: selectedClass,
          academic_year_id: selectedYear
        }
      });

      setAnalysis(result.data);
      
      // Pre-populate decisions with recommendations
      const initialDecisions = {};
      result.data.students.forEach(student => {
        initialDecisions[student.student_id] = {
          student_id: student.student_id,
          enrollment_id: student.enrollment_id,
          decision: student.recommended_decision,
          to_class_id: student.recommended_class_id,
          to_class_name: student.recommended_class_name,
          reason: student.metrics.has_data ? 'System recommendation' : 'No grade data',
          overall_percentage: student.metrics.overall_percentage,
          failed_subjects: student.metrics.failed_subjects,
          special_consideration: false
        };
      });
      setDecisions(initialDecisions);

    } catch (err) {
      toast(err.message || 'Failed to analyze promotions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateDecision = (studentId, updates) => {
    setDecisions(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...updates
      }
    }));
  };

  const executePromotions = async () => {
    if (!nextYear) {
      toast('Next academic year not found. Please create it first.', 'error');
      return;
    }

    setProcessing(true);
    try {
      const decisionsList = Object.values(decisions);
      
      const result = await apiFetch('/promotions/execute', {
        method: 'POST',
        token: auth.token,
        body: {
          decisions: decisionsList,
          academic_year_id: selectedYear,
          next_academic_year_id: nextYear.academic_year_id
        }
      });

      toast(
        `Promotions complete: ${result.data.promoted} promoted, ${result.data.retained} retained, ${result.data.graduated} graduated`,
        'success'
      );
      
      setShowConfirmModal(false);
      setAnalysis(null);
      setDecisions({});
    } catch (err) {
      toast(err.message || 'Failed to execute promotions', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getDecisionBadge = (decision) => {
    const configs = {
      promoted: { tone: 'success', label: 'Promote' },
      repeat: { tone: 'warning', label: 'Retain' },
      graduated: { tone: 'info', label: 'Graduate' },
      transferred: { tone: 'info', label: 'Transfer' }
    };
    const config = configs[decision] || configs.repeat;
    return <Badge text={config.label} tone={config.tone} />;
  };

  const getGradeColor = (percentage) => {
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 65) return '#3b82f6';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: C.text }}>Student Promotions</h2>
      </div>

      {/* Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 16,
        padding: 16,
        background: C.surface,
        borderRadius: 10,
        border: `1px solid ${C.border}`
      }}>
        <Field label="Class">
          <select
            style={inputStyle}
            value={selectedClass || ''}
            onChange={e => setSelectedClass(Number(e.target.value))}
          >
            <option value="">Select class...</option>
            {classes.map(cls => (
              <option key={cls.class_id} value={cls.class_id}>
                {cls.class_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Academic Year">
          <select
            style={inputStyle}
            value={selectedYear || ''}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {academicYears.map(year => (
              <option key={year.academic_year_id} value={year.academic_year_id}>
                {year.year_label} {year.is_current ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Btn
            onClick={analyzePromotions}
            disabled={loading || !selectedClass || !selectedYear}
          >
            {loading ? 'Analyzing...' : 'Analyze Promotions'}
          </Btn>
        </div>
      </div>

      {/* Rules Info */}
      {analysis?.applied_rule && (
        <div style={{
          padding: 12,
          background: C.card,
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          color: C.textSub
        }}>
          <strong>Applied Rule:</strong> Min {analysis.applied_rule.minimum_overall_percentage}% overall, 
          Max {analysis.applied_rule.maximum_failed_subjects} failed subjects
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div>
          {/* Summary */}
          <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap'
          }}>
            <Badge 
              text={`${analysis.total_students} Students`} 
              tone="info" 
            />
            <Badge 
              text={`${analysis.students.filter(s => s.recommended_decision === 'promoted').length} Eligible to Promote`} 
              tone="success" 
            />
            <Badge 
              text={`${analysis.students.filter(s => s.recommended_decision === 'repeat').length} Retain`} 
              tone="warning" 
            />
          </div>

          {/* Students Table */}
          <div style={{ 
            background: C.surface, 
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            overflow: 'hidden'
          }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ margin: 0, fontSize: 16, color: C.text }}>
                Promotion Decisions
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <Table
                headers={[
                  'Student',
                  'Overall %',
                  'Failed Subjects',
                  'Recommended',
                  'Your Decision',
                  'To Class'
                ]}
                rows={analysis.students.map(student => {
                  const decision = decisions[student.student_id];
                  
                  return [
                    <div key="student" style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 600, color: C.text }}>
                        {student.student_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>
                        {student.admission_number}
                      </div>
                    </div>,
                    
                    <div key="percentage">
                      {student.metrics.has_data ? (
                        <span style={{
                          color: getGradeColor(student.metrics.overall_percentage),
                          fontWeight: 700
                        }}>
                          {student.metrics.overall_percentage}%
                        </span>
                      ) : (
                        <span style={{ color: C.textMuted, fontStyle: 'italic' }}>
                          No data
                        </span>
                      )}
                    </div>,
                    
                    <div key="failed">
                      {student.metrics.failed_count > 0 ? (
                        <span style={{ color: '#ef4444' }}>
                          {student.metrics.failed_count}
                          {student.metrics.failed_subjects.length > 0 && (
                            <span style={{ fontSize: 10, marginLeft: 4, color: C.textMuted }}>
                              ({student.metrics.failed_subjects.map(s => s.subject).join(', ')})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#22c55e' }}>0</span>
                      )}
                    </div>,
                    
                    <div key="recommended">
                      {getDecisionBadge(student.recommended_decision)}
                    </div>,
                    
                    <div key="decision">
                      <select
                        style={{
                          ...inputStyle,
                          fontSize: 13,
                          padding: '4px 8px'
                        }}
                        value={decision?.decision || 'repeat'}
                        onChange={e => updateDecision(student.student_id, { 
                          decision: e.target.value,
                          reason: e.target.value === student.recommended_decision 
                            ? 'System recommendation' 
                            : 'Manual override'
                        })}
                      >
                        <option value="promoted">Promote</option>
                        <option value="repeat">Retain</option>
                        {analysis.class_order >= 8 && (
                          <option value="graduated">Graduate</option>
                        )}
                      </select>
                    </div>,
                    
                    <div key="to_class">
                      {decision?.decision === 'promoted' ? (
                        <span style={{ color: '#22c55e' }}>
                          {student.recommended_class_name || 'Next class'}
                        </span>
                      ) : decision?.decision === 'graduated' ? (
                        <span style={{ color: '#3b82f6' }}>Graduated</span>
                      ) : (
                        <span style={{ color: C.textMuted }}>
                          {analysis.class_name} (Repeat)
                        </span>
                      )}
                    </div>
                  ];
                })}
              />
            </div>

            {/* Actions */}
            <div style={{ 
              padding: 16, 
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8
            }}>
              <Btn variant="ghost" onClick={() => setAnalysis(null)}>
                Cancel
              </Btn>
              <Btn onClick={() => setShowConfirmModal(true)}>
                Review & Execute Promotions
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analysis && !loading && (
        <Msg text="Select a class and academic year, then click 'Analyze Promotions' to see promotion recommendations." />
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <Modal
          title="Confirm Promotions"
          onClose={() => setShowConfirmModal(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: 12,
              background: C.card,
              borderRadius: 8
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: C.text }}>
                Summary
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div>
                  <span style={{ color: C.textMuted }}>To Promote: </span>
                  <strong style={{ color: '#22c55e' }}>
                    {Object.values(decisions).filter(d => d.decision === 'promoted').length}
                  </strong>
                </div>
                <div>
                  <span style={{ color: C.textMuted }}>To Retain: </span>
                  <strong style={{ color: '#f59e0b' }}>
                    {Object.values(decisions).filter(d => d.decision === 'repeat').length}
                  </strong>
                </div>
                <div>
                  <span style={{ color: C.textMuted }}>To Graduate: </span>
                  <strong style={{ color: '#3b82f6' }}>
                    {Object.values(decisions).filter(d => d.decision === 'graduated').length}
                  </strong>
                </div>
                <div>
                  <span style={{ color: C.textMuted }}>Total: </span>
                  <strong>{Object.keys(decisions).length}</strong>
                </div>
              </div>
            </div>

            <div style={{
              padding: 12,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8,
              fontSize: 13,
              color: '#f59e0b'
            }}>
              <strong>⚠️ Important:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 16 }}>
                <li>New enrollments will be created for promoted students</li>
                <li>Graduated students will be marked as inactive</li>
                <li>This action cannot be easily undone</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setShowConfirmModal(false)}>
                Back to Review
              </Btn>
              <Btn 
                onClick={executePromotions}
                disabled={processing}
              >
                {processing ? 'Executing...' : 'Confirm & Execute Promotions'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

PromotionPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
