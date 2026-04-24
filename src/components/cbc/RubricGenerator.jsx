import { useState } from 'react';
import PropTypes from 'prop-types';
import Btn from '../Btn';
import Badge from '../Badge';
import { C } from '../../lib/theme';
import { apiFetch } from '../../lib/api';

/**
 * RubricGenerator - AI-powered CBC rubric creation
 * Generates rubrics with human approval workflow
 */
export default function RubricGenerator({ auth, onRubricCreated }) {
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [strand, setStrand] = useState('');
  const [subStrand, setSubStrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRubric, setGeneratedRubric] = useState(null);
  const [error, setError] = useState(null);

  const subjects = [
    'Mathematics', 'English', 'Kiswahili', 'Science', 'Social Studies', 
    'CRE', 'IRE', 'PHE', 'Art & Craft', 'Music', 'Agriculture'
  ];

  const gradeLevels = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'];

  const generateRubric = async () => {
    if (!subject || !gradeLevel || !strand) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/cbc/rubrics/generate', {
        method: 'POST',
        token: auth.token,
        body: {
          subject,
          gradeLevel,
          strand,
          subStrand
        }
      });

      setGeneratedRubric(result.data);
    } catch (err) {
      setError(err.message || 'Failed to generate rubric');
    } finally {
      setLoading(false);
    }
  };

  const approveRubric = async () => {
    try {
      await apiFetch(`/cbc/rubrics/${generatedRubric.rubric_id}/approve`, {
        method: 'POST',
        token: auth.token
      });

      alert('Rubric approved and saved!');
      if (onRubricCreated) onRubricCreated(generatedRubric);
      setGeneratedRubric(null);
      setSubject('');
      setGradeLevel('');
      setStrand('');
      setSubStrand('');
    } catch (err) {
      alert('Failed to approve: ' + err.message);
    }
  };

  const rejectRubric = () => {
    setGeneratedRubric(null);
  };

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 24 }}>
      <h3 style={{ marginTop: 0, color: C.text }}>🎯 CBC Rubric Generator</h3>
      <p style={{ color: C.textMuted, fontSize: 14 }}>
        Generate competency-based assessment rubrics using AI. All rubrics require human approval before use.
      </p>

      {/* Input Form */}
      <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
            Subject *
          </label>
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text
            }}
          >
            <option value="">Select subject...</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
            Grade Level *
          </label>
          <select
            value={gradeLevel}
            onChange={e => setGradeLevel(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text
            }}
          >
            <option value="">Select grade...</option>
            {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
            Strand/Topic *
          </label>
          <input
            type="text"
            value={strand}
            onChange={e => setStrand(e.target.value)}
            placeholder="e.g., Numbers and Algebra, Measurement"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, color: C.text, fontSize: 14 }}>
            Sub-Strand (Optional)
          </label>
          <input
            type="text"
            value={subStrand}
            onChange={e => setSubStrand(e.target.value)}
            placeholder="e.g., Addition and Subtraction"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        <Btn onClick={generateRubric} disabled={loading}>
          {loading ? '🔄 Generating...' : '🤖 Generate Rubric with AI'}
        </Btn>
      </div>

      {/* Generated Rubric Preview */}
      {generatedRubric && (
        <div style={{ marginTop: 24, borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: C.text }}>Generated Rubric Preview</h4>
            <Badge text="Pending Approval" tone="warning" />
          </div>

          <div style={{ background: C.surface, padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: C.text }}>{generatedRubric.subject}</strong> • {generatedRubric.grade_level}
            </div>
            <div style={{ color: C.textMuted, fontSize: 14 }}>
              {generatedRubric.strand}
              {generatedRubric.sub_strand && ` • ${generatedRubric.sub_strand}`}
            </div>
          </div>

          {/* Rubric Criteria Table */}
          <RubricCriteriaTable criteria={generatedRubric.criteria} />

          <div style={{ 
            background: '#f59e0b10', 
            border: '1px solid #f59e0b', 
            padding: 12, 
            borderRadius: 8,
            marginTop: 16,
            fontSize: 13,
            color: '#f59e0b'
          }}>
            ⚠️ This rubric was AI-generated and requires your review. Please verify the indicators 
            match your curriculum expectations before approving.
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Btn onClick={rejectRubric} variant="ghost" style={{ flex: 1 }}>
              ✗ Reject & Regenerate
            </Btn>
            <Btn onClick={approveRubric} style={{ flex: 1 }}>
              ✓ Approve & Save
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

RubricGenerator.propTypes = {
  auth: PropTypes.object.isRequired,
  onRubricCreated: PropTypes.func
};

function RubricCriteriaTable({ criteria }) {
  if (!criteria || !Array.isArray(criteria)) return null;

  const levelColors = {
    'EE': '#22c55e',
    'ME': '#3b82f6',
    'AE': '#f59e0b',
    'BE': '#ef4444'
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: `2px solid ${C.border}`, color: C.textMuted }}>
              Level
            </th>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: `2px solid ${C.border}`, color: C.textMuted }}>
              Descriptor
            </th>
            <th style={{ padding: 12, textAlign: 'left', borderBottom: `2px solid ${C.border}`, color: C.textMuted }}>
              Observable Indicators
            </th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((criterion, idx) => (
            <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: 12 }}>
                <span style={{ 
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 4,
                  background: levelColors[criterion.level] + '20',
                  color: levelColors[criterion.level],
                  fontWeight: 600,
                  fontSize: 12
                }}>
                  {criterion.level}
                </span>
              </td>
              <td style={{ padding: 12, color: C.text }}>
                {criterion.descriptor}
              </td>
              <td style={{ padding: 12, color: C.text }}>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {criterion.indicators?.map((indicator, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{indicator}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
