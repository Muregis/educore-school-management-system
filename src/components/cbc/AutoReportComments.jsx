import { useState } from 'react';
import PropTypes from 'prop-types';
import Btn from '../Btn';
import Badge from '../Badge';
import { C } from '../../lib/theme';
import { apiFetch } from '../../lib/api';

/**
 * AutoReportComments - AI-generated personalized report card comments
 * Generates comments based on student performance data
 */
export default function AutoReportComments({ auth, student, results, term, academicYear }) {
  const [loading, setLoading] = useState(false);
  const [generatedComment, setGeneratedComment] = useState(null);
  const [editedComment, setEditedComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const generateComment = async () => {
    if (!student?.student_id) return;

    setLoading(true);
    try {
      const result = await apiFetch('/cbc/comments/generate', {
        method: 'POST',
        token: auth.token,
        body: {
          studentId: student.student_id,
          term,
          academicYear
        }
      });

      setGeneratedComment(result.data);
      setEditedComment(result.data.generated_comment);
      setIsApproved(false);
    } catch (err) {
      alert('Failed to generate comment: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const approveComment = async () => {
    try {
      await apiFetch(`/cbc/comments/${generatedComment.comment_id}/approve`, {
        method: 'POST',
        token: auth.token,
        body: {
          finalComment: isEditing ? editedComment : generatedComment.generated_comment,
          wasEdited: isEditing
        }
      });

      setIsApproved(true);
      alert('Comment approved and saved to report card!');
    } catch (err) {
      alert('Failed to approve: ' + err.message);
    }
  };

  const getPerformanceSummary = () => {
    if (!results || results.length === 0) return null;

    const grades = results.map(r => {
      const score = (r.marks / r.total) * 100;
      if (score >= 80) return 'EE';
      if (score >= 65) return 'ME';
      if (score >= 50) return 'AE';
      return 'BE';
    });

    const counts = grades.reduce((acc, g) => {
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});

    return counts;
  };

  const summary = getPerformanceSummary();

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: C.text }}>📝 Report Card Comments</h3>
        {generatedComment && (
          <Badge 
            text={isApproved ? 'Approved' : generatedComment.is_approved ? 'Approved' : 'Pending Review'} 
            tone={isApproved || generatedComment.is_approved ? 'success' : 'warning'}
          />
        )}
      </div>

      {/* Student Performance Summary */}
      {summary && (
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          marginBottom: 20,
          padding: 12,
          background: C.surface,
          borderRadius: 8
        }}>
          {summary.EE > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{summary.EE}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>EE (Exceeds)</div>
            </div>
          )}
          {summary.ME > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{summary.ME}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>ME (Meets)</div>
            </div>
          )}
          {summary.AE > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{summary.AE}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>AE (Approaching)</div>
            </div>
          )}
          {summary.BE > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{summary.BE}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>BE (Below)</div>
            </div>
          )}
        </div>
      )}

      {/* Generate Button */}
      {!generatedComment && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: C.textMuted, marginBottom: 16 }}>
            Generate a personalized comment for {student?.first_name} based on their {results?.length || 0} subject results.
          </p>
          <Btn onClick={generateComment} disabled={loading}>
            {loading ? '🔄 Generating...' : '🤖 Auto-Generate Comment'}
          </Btn>
        </div>
      )}

      {/* Generated Comment */}
      {generatedComment && (
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
              {isEditing ? 'Edit the comment:' : 'Generated Comment:'}
            </div>
            
            {isEditing ? (
              <textarea
                value={editedComment}
                onChange={e => setEditedComment(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 200,
                  padding: 16,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text,
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            ) : (
              <div style={{
                padding: 16,
                background: C.surface,
                borderRadius: 8,
                color: C.text,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}>
                {generatedComment.generated_comment}
              </div>
            )}
          </div>

          {/* Comment Sections Breakdown */}
          {generatedComment.comment_sections && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Comment Sections:</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {generatedComment.comment_sections.opening && (
                  <div style={{ padding: 12, background: C.surface, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Opening</div>
                    <div style={{ fontSize: 13, color: C.text }}>{generatedComment.comment_sections.opening}</div>
                  </div>
                )}
                {generatedComment.comment_sections.strengths?.length > 0 && (
                  <div style={{ padding: 12, background: C.surface, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 4 }}>Strengths</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {generatedComment.comment_sections.strengths.map((s, i) => (
                        <li key={i} style={{ fontSize: 13, color: C.text }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {generatedComment.comment_sections.improvements?.length > 0 && (
                  <div style={{ padding: 12, background: C.surface, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 4 }}>Areas for Improvement</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {generatedComment.comment_sections.improvements.map((s, i) => (
                        <li key={i} style={{ fontSize: 13, color: C.text }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {generatedComment.comment_sections.closing && (
                  <div style={{ padding: 12, background: C.surface, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Closing</div>
                    <div style={{ fontSize: 13, color: C.text }}>{generatedComment.comment_sections.closing}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Transparency */}
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: '#3b82f610', 
            borderRadius: 8,
            fontSize: 12,
            color: '#3b82f6'
          }}>
            🤖 Generated by {generatedComment.ai_model_used || 'AI'} • 
            Requires human review before use in official report card
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {!isApproved && !generatedComment.is_approved && (
              <>
                <Btn 
                  onClick={() => setIsEditing(!isEditing)} 
                  variant="outline"
                >
                  {isEditing ? 'Done Editing' : '✏️ Edit Comment'}
                </Btn>
                <Btn 
                  onClick={generateComment} 
                  variant="ghost"
                >
                  🔄 Regenerate
                </Btn>
                <Btn onClick={approveComment} style={{ marginLeft: 'auto' }}>
                  ✓ Approve for Report Card
                </Btn>
              </>
            )}
            {(isApproved || generatedComment.is_approved) && (
              <div style={{ 
                width: '100%', 
                textAlign: 'center', 
                padding: 12,
                background: '#22c55e10',
                borderRadius: 8,
                color: '#22c55e'
              }}>
                ✅ This comment has been approved and is ready for the report card.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

AutoReportComments.propTypes = {
  auth: PropTypes.object.isRequired,
  student: PropTypes.object.isRequired,
  results: PropTypes.array.isRequired,
  term: PropTypes.string.isRequired,
  academicYear: PropTypes.string.isRequired
};

// Also export a batch version for generating comments for multiple students
export function BatchCommentGenerator({ auth, students, term, academicYear, onComplete }) {
  const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
  const [results, setResults] = useState([]);

  const generateBatch = async () => {
    setProgress({ current: 0, total: students.length, status: 'generating' });
    const generated = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      try {
        const result = await apiFetch('/cbc/comments/generate', {
          method: 'POST',
          token: auth.token,
          body: {
            studentId: student.student_id,
            term,
            academicYear
          }
        });
        generated.push({ student, comment: result.data, status: 'success' });
      } catch (err) {
        generated.push({ student, error: err.message, status: 'error' });
      }
      setProgress({ current: i + 1, total: students.length, status: 'generating' });
    }

    setResults(generated);
    setProgress({ current: students.length, total: students.length, status: 'complete' });
    if (onComplete) onComplete(generated);
  };

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 24 }}>
      <h3 style={{ marginTop: 0, color: C.text }}>Batch Comment Generation</h3>
      <p style={{ color: C.textMuted }}>
        Generate AI comments for {students.length} students. All comments will require individual approval.
      </p>

      {progress.status === 'idle' && (
        <Btn onClick={generateBatch}>
          🚀 Start Batch Generation
        </Btn>
      )}

      {progress.status === 'generating' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔄</div>
          <div style={{ color: C.text, marginBottom: 8 }}>
            Generating comment {progress.current} of {progress.total}
          </div>
          <div style={{ 
            height: 8, 
            background: C.border, 
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(progress.current / progress.total) * 100}%`,
              height: '100%',
              background: C.accent,
              borderRadius: 4,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {progress.status === 'complete' && (
        <div>
          <div style={{ 
            padding: 16, 
            background: '#22c55e10', 
            borderRadius: 8,
            marginBottom: 16,
            color: '#22c55e'
          }}>
            ✅ Generated {results.filter(r => r.status === 'success').length} of {students.length} comments
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Btn onClick={() => setProgress({ current: 0, total: 0, status: 'idle' })} variant="outline">
              Generate More
            </Btn>
            <Btn onClick={() => window.location.href = '/report-cards/review'}>
              Review & Approve Comments →
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
