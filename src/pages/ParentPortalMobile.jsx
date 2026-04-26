import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import MobileHeader from '../components/MobileHeader';
import MobileNav from '../components/MobileNav';
import { C } from '../lib/theme';
import { money } from '../lib/utils';

export default function ParentPortalMobile({
  auth,
  school,
  students,
  attendance,
  results,
  payments,
  feeStructures,
  onNavigate,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeChildId, setActiveChildId] = useState(null);

  // Get children for this parent
  const myChildren = useMemo(() => {
    const loginStudent = students.find(s => (s.id ?? s.student_id) === auth?.studentId);
    if (!loginStudent) return [];
    const phone = loginStudent.parentPhone ?? loginStudent.parent_phone ?? '';
    if (!phone) return [loginStudent];
    return students.filter(s => (s.parentPhone ?? s.parent_phone ?? '') === phone && s.status === 'active');
  }, [students, auth]);

  // Active child
  const activeChild = useMemo(() =>
    myChildren.find(s => (s.id ?? s.student_id) === activeChildId) || myChildren[0],
    [myChildren, activeChildId]
  );

  // Filtered data for active child
  const childAttendance = useMemo(() =>
    attendance.filter(a => (a.studentId ?? a.student_id) === (activeChild?.id ?? activeChild?.student_id)),
    [attendance, activeChild]
  );

  const childResults = useMemo(() =>
    results.filter(r => (r.studentId ?? r.student_id) === (activeChild?.id ?? activeChild?.student_id)),
    [results, activeChild]
  );

  const childPayments = useMemo(() =>
    payments.filter(p => (p.studentId ?? p.student_id) === (activeChild?.id ?? activeChild?.student_id)),
    [payments, activeChild]
  );

  // Calculate stats
  const presentCount = childAttendance.filter(a => a.status === 'present').length;
  const absentCount = childAttendance.filter(a => a.status === 'absent').length;
  const attendanceRate = childAttendance.length > 0
    ? Math.round((presentCount / childAttendance.length) * 100)
    : 0;

  const totalPaid = childPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Read tuition+activity+misc — .amount does not exist on feeStructures
  const feeStruct = feeStructures.find(
    f => (f.className ?? f.class_name) === (activeChild?.className ?? activeChild?.class_name)
  );
  const classFee = feeStruct
    ? (Number(feeStruct.tuition || 0) + Number(feeStruct.activity || 0) + Number(feeStruct.misc || 0))
    : 0;
  const balance = Math.max(0, classFee - totalPaid);

  // Navigation items
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Home' },
    { id: 'grades', icon: '📊', label: 'Grades' },
    { id: 'fees', icon: '💰', label: 'Fees' },
    { id: 'attendance', icon: '📅', label: 'Attendance' },
    { id: 'communication', icon: '💬', label: 'Messages' }
  ];

  const renderDashboard = () => (
    <div className="mobile-page">
      {/* Child Switcher */}
      {myChildren.length > 1 && (
        <div className="mobile-card">
          <div className="mobile-title">Select Child</div>
          <div className="mobile-chips">
            {myChildren.map(child => (
              <button
                key={child.id ?? child.student_id}
                className={`mobile-chip ${(activeChild?.id ?? activeChild?.student_id) === (child.id ?? child.student_id) ? 'active' : ''}`}
                onClick={() => setActiveChildId(child.id ?? child.student_id)}
              >
                {child.firstName} {child.lastName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fee Balance Card */}
      <div className="mobile-card-large" style={{
        background: balance <= 0 ? '#22C55E' : balance <= classFee * 0.3 ? '#F59E0B' : '#F43F5E',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Fee Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{money(Math.abs(balance))}</div>
          </div>
          <div style={{
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.2)',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {balance <= 0 ? 'PAID' : 'OWING'}
          </div>
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>
          Total Paid: {money(totalPaid)} • Class Fee: {money(classFee)}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mobile-card">
        <div className="mobile-title">Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            className="mobile-btn"
            onClick={() => onNavigate('fees')}
            style={{ background: '#22C55E' }}
          >
            💰 Pay Fees
          </button>
          <button
            className="mobile-btn mobile-btn-secondary"
            onClick={() => onNavigate('grades')}
          >
            📊 View Report Card
          </button>
          <button
            className="mobile-btn mobile-btn-secondary"
            onClick={() => onNavigate('communication')}
          >
            👨‍🏫 Contact Teacher
          </button>
          <button
            className="mobile-btn mobile-btn-secondary"
            onClick={() => onNavigate('attendance')}
          >
            📅 View Attendance
          </button>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="mobile-card">
        <div className="mobile-title">Attendance This Term</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="mobile-progress-ring">
            <svg width="80" height="80">
              <circle
                className="mobile-progress-ring-bg"
                cx="40"
                cy="40"
                r="35"
              />
              <circle
                className="mobile-progress-ring-fill"
                cx="40"
                cy="40"
                r="35"
                style={{
                  strokeDashoffset: 220 - (220 * attendanceRate / 100)
                }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '14px',
              fontWeight: '700',
              color: '#E2EAF8'
            }}>
              {attendanceRate}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#E2EAF8' }}>
              {presentCount} Present
            </div>
            <div style={{ fontSize: '12px', color: '#7A92B8' }}>
              {absentCount} Absent
            </div>
          </div>
        </div>
      </div>

      {/* Recent Grades */}
      <div className="mobile-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="mobile-title" style={{ margin: 0 }}>Recent Grades</div>
          <button
            className="mobile-btn mobile-btn-ghost"
            onClick={() => onNavigate('grades')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            View All
          </button>
        </div>
        {childResults.slice(0, 3).map(result => (
          <div key={result.id ?? result.result_id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #1A2A42'
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#E2EAF8' }}>
                {result.subject}
              </div>
              <div style={{ fontSize: '12px', color: '#7A92B8' }}>
                {result.exam || result.exam_type || 'Exam'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: Number(result.marks) >= 75 ? '#22C55E' : Number(result.marks) >= 50 ? '#F59E0B' : '#F43F5E'
              }}>
                {result.marks}/{result.total || result.total_marks}
              </div>
              <div className={`grade-badge grade-${result.grade?.toLowerCase()}`} style={{ marginTop: '4px' }}>
                {result.grade}
              </div>
            </div>
          </div>
        ))}
        {childResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#7A92B8' }}>
            No grades recorded yet
          </div>
        )}
      </div>
    </div>
  );

  const renderGrades = () => (
    <div className="mobile-page">
      <div className="mobile-card">
        <div className="mobile-title">Grades</div>
        <div className="mobile-subtitle">All subjects for {activeChild?.firstName} {activeChild?.lastName}</div>

        {childResults.map(result => (
          <div key={result.id ?? result.result_id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            borderBottom: '1px solid #1A2A42'
          }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#E2EAF8' }}>
                {result.subject}
              </div>
              <div style={{ fontSize: '12px', color: '#7A92B8' }}>
                {result.exam || result.exam_type || 'Exam'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '18px',
                fontWeight: '700',
                color: Number(result.marks) >= 75 ? '#22C55E' : Number(result.marks) >= 50 ? '#F59E0B' : '#F43F5E'
              }}>
                {result.marks}/{result.total || result.total_marks}
              </div>
              <div className={`grade-badge grade-${result.grade?.toLowerCase()}`} style={{ marginTop: '8px' }}>
                {result.grade}
              </div>
            </div>
          </div>
        ))}

        {childResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A92B8' }}>
            No grades available
          </div>
        )}
      </div>
    </div>
  );

  const renderFees = () => (
    <div className="mobile-page">
      <div className="mobile-card-large" style={{
        background: balance <= 0 ? '#22C55E' : '#F43F5E',
        color: '#fff'
      }}>
        <div className="mobile-title" style={{ color: '#fff' }}>Fee Balance</div>
        <div style={{ fontSize: '32px', fontWeight: '800', margin: '8px 0' }}>
          {money(Math.abs(balance))}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9 }}>
          {balance <= 0 ? 'All fees paid' : 'Outstanding balance'}
        </div>
      </div>

      <div className="mobile-card">
        <div className="mobile-title">Payment History</div>
        {childPayments.map(payment => (
          <div key={payment.id ?? payment.payment_id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #1A2A42'
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#E2EAF8' }}>
                {payment.description || 'School Fees'}
              </div>
              <div style={{ fontSize: '12px', color: '#7A92B8' }}>
                {new Date(payment.date || payment.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: payment.status === 'paid' ? '#22C55E' : '#F59E0B'
              }}>
                {money(payment.amount)}
              </div>
              <div style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: payment.status === 'paid' ? '#22C55E' : '#F59E0B',
                color: '#fff',
                display: 'inline-block',
                marginTop: '4px'
              }}>
                {payment.status?.toUpperCase()}
              </div>
            </div>
          </div>
        ))}

        {childPayments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#7A92B8' }}>
            No payment history
          </div>
        )}
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="mobile-page">
      <div className="mobile-card">
        <div className="mobile-title">Attendance Summary</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div className="mobile-progress-ring">
            <svg width="80" height="80">
              <circle
                className="mobile-progress-ring-bg"
                cx="40"
                cy="40"
                r="35"
              />
              <circle
                className="mobile-progress-ring-fill"
                cx="40"
                cy="40"
                r="35"
                style={{
                  strokeDashoffset: 220 - (220 * attendanceRate / 100)
                }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '14px',
              fontWeight: '700',
              color: '#E2EAF8'
            }}>
              {attendanceRate}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#E2EAF8' }}>
              {presentCount} Present
            </div>
            <div style={{ fontSize: '14px', color: '#7A92B8' }}>
              {absentCount} Absent • {childAttendance.length} Total
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-card">
        <div className="mobile-title">Recent Attendance</div>
        {childAttendance.slice(0, 10).map(record => (
          <div key={record.id ?? record.attendance_id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #1A2A42'
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#E2EAF8' }}>
                {new Date(record.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </div>
            <div style={{
              padding: '4px 12px',
              borderRadius: '12px',
              background: record.status === 'present' ? '#22C55E' : '#F43F5E',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {record.status?.toUpperCase()}
            </div>
          </div>
        ))}

        {childAttendance.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#7A92B8' }}>
            No attendance records
          </div>
        )}
      </div>
    </div>
  );

  const renderCommunication = () => (
    <div className="mobile-page">
      <div className="mobile-card">
        <div className="mobile-title">Messages</div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A92B8' }}>
          Messaging feature coming soon
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'grades': return renderGrades();
      case 'fees': return renderFees();
      case 'attendance': return renderAttendance();
      case 'communication': return renderCommunication();
      default: return renderDashboard();
    }
  };

  return (
    <div className="mobile-container">
      <MobileHeader
        schoolName={school?.name || 'EduCore'}
        studentName={activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : null}
        avatar={activeChild ? `${activeChild.firstName?.[0]}${activeChild.lastName?.[0]}` : null}
      />

      {renderContent()}

      <MobileNav
        items={navItems}
        activeItem={activeTab}
        onItemClick={setActiveTab}
      />
    </div>
  );
}

ParentPortalMobile.propTypes = {
  auth: PropTypes.object.isRequired,
  school: PropTypes.object.isRequired,
  students: PropTypes.array.isRequired,
  attendance: PropTypes.array.isRequired,
  results: PropTypes.array.isRequired,
  payments: PropTypes.array.isRequired,
  feeStructures: PropTypes.array.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onLogout: PropTypes.func
};