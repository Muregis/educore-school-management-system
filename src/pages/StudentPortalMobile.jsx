import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import MobileHeader from '../components/MobileHeader';
import MobileNav from '../components/MobileNav';
import { C } from '../lib/theme';

export default function StudentPortalMobile({
  auth,
  school,
  student,
  attendance,
  results,
  library,
  timetable,
  onNavigate,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Calculate stats
  const studentAttendance = useMemo(() =>
    attendance.filter(a => (a.studentId ?? a.student_id) === (student?.id ?? student?.student_id)),
    [attendance, student]
  );

  const studentResults = useMemo(() =>
    results.filter(r => (r.studentId ?? r.student_id) === (student?.id ?? student?.student_id)),
    [results, student]
  );

  const studentBooks = useMemo(() =>
    library.filter(b => (b.studentId ?? b.student_id) === (student?.id ?? student?.student_id) && b.status === 'borrowed'),
    [library, student]
  );

  // Stats calculations
  const presentCount = studentAttendance.filter(a => a.status === 'present').length;
  const attendanceStreak = useMemo(() => {
    let streak = 0;
    const sorted = [...studentAttendance].sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const record of sorted) {
      if (record.status === 'present') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [studentAttendance]);

  const avgGrade = studentResults.length > 0
    ? Math.round(studentResults.reduce((sum, r) => sum + (Number(r.marks) / Number(r.total || r.total_marks) * 100), 0) / studentResults.length)
    : 0;

  // Navigation items
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Home' },
    { id: 'grades', icon: '📊', label: 'Grades' },
    { id: 'attendance', icon: '📅', label: 'Attendance' },
    { id: 'timetable', icon: '📚', label: 'Timetable' },
    { id: 'library', icon: '📖', label: 'Library' }
  ];

  const renderDashboard = () => (
    <div className="mobile-page">
      {/* Welcome Card */}
      <div className="mobile-card-large" style={{
        background: `linear-gradient(135deg, ${C.accent}, #6366f1)`,
        color: '#fff'
      }}>
        <div style={{ fontSize: '14px', opacity: 0.9 }}>Good morning,</div>
        <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0' }}>
          {student?.firstName}!
        </div>
        <div style={{ fontSize: '14px', opacity: 0.8 }}>
          {school?.term} {school?.year} • {student?.className}
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="mobile-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#3B82F6', marginBottom: '4px' }}>
            {attendanceStreak}
          </div>
          <div style={{ fontSize: '12px', color: '#7A92B8' }}>Day Streak</div>
        </div>

        <div className="mobile-card" style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: '800',
            color: avgGrade >= 75 ? '#22C55E' : avgGrade >= 50 ? '#F59E0B' : '#F43F5E',
            marginBottom: '4px'
          }}>
            {avgGrade > 0 ? `${avgGrade}%` : '-'}
          </div>
          <div style={{ fontSize: '12px', color: '#7A92B8' }}>Avg Grade</div>
        </div>
      </div>

      {/* Subject Grades */}
      <div className="mobile-card">
        <div className="mobile-title">Subject Grades</div>
        <div className="mobile-scroll">
          <div style={{ display: 'flex', gap: '12px', padding: '4px 0' }}>
            {studentResults.slice(0, 5).map(result => (
              <div key={result.id ?? result.result_id} style={{
                minWidth: '120px',
                textAlign: 'center',
                padding: '16px 12px',
                background: '#0B1120',
                borderRadius: '12px',
                border: '1px solid #1A2A42'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#E2EAF8', marginBottom: '8px' }}>
                  {result.subject}
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '800',
                  color: Number(result.marks) >= 75 ? '#22C55E' : Number(result.marks) >= 50 ? '#F59E0B' : '#F43F5E',
                  marginBottom: '8px'
                }}>
                  {result.marks}/{result.total || result.total_marks}
                </div>
                <div className={`grade-badge grade-${result.grade?.toLowerCase()}`}>
                  {result.grade}
                </div>
              </div>
            ))}
          </div>
        </div>
        {studentResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#7A92B8' }}>
            No grades recorded yet
          </div>
        )}
      </div>

      {/* Library Books */}
      {studentBooks.length > 0 && (
        <div className="mobile-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="mobile-title" style={{ margin: 0 }}>Borrowed Books</div>
            <button
              className="mobile-btn mobile-btn-ghost"
              onClick={() => setActiveTab('library')}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              View All
            </button>
          </div>

          {studentBooks.slice(0, 2).map(book => {
            const dueDate = new Date(book.dueDate || book.due_date);
            const today = new Date();
            const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            return (
              <div key={book.id ?? book.borrow_id} className="book-card">
                <div className="book-info">
                  <h4>{book.title}</h4>
                  <p>{book.author}</p>
                </div>
                <div className="book-due">
                  <div className="days" style={{
                    color: daysLeft < 0 ? '#F43F5E' : daysLeft <= 3 ? '#F59E0B' : '#22C55E'
                  }}>
                    {daysLeft < 0 ? 'Overdue' : `${daysLeft}d`}
                  </div>
                  <div className="label">Due</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's Timetable */}
      <div className="mobile-card">
        <div className="mobile-title">Today's Classes</div>
        {(() => {
          const today = new Date().toLocaleLowerCase('en-US', { weekday: 'long' });
          const todaySubjects = timetable.filter(t =>
            t.day?.toLowerCase() === today &&
            t.className === student?.className
          );

          return todaySubjects.length > 0 ? (
            <div>
              {todaySubjects.slice(0, 3).map(subject => (
                <div key={subject.id ?? subject.timetable_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #1A2A42'
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#E2EAF8' }}>
                      {subject.subject}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7A92B8' }}>
                      {subject.teacher}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: '#3B82F6', fontWeight: '600' }}>
                    {subject.startTime} - {subject.endTime}
                  </div>
                </div>
              ))}
              <button
                className="mobile-btn mobile-btn-ghost"
                onClick={() => setActiveTab('timetable')}
                style={{ width: '100%', marginTop: '12px' }}
              >
                View Full Timetable
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#7A92B8' }}>
              No classes today
            </div>
          );
        })()}
      </div>
    </div>
  );

  const renderGrades = () => (
    <div className="mobile-page">
      <div className="mobile-card">
        <div className="mobile-title">My Grades</div>
        <div className="mobile-subtitle">All subjects and assessments</div>

        {studentResults.map(result => (
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

        {studentResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A92B8' }}>
            No grades available yet
          </div>
        )}
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="mobile-page">
      <div className="mobile-card">
        <div className="mobile-title">My Attendance</div>

        {/* Streak Counter */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          padding: '16px',
          background: '#0B1120',
          borderRadius: '12px',
          border: '1px solid #1A2A42'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, #22C55E, #16A34A)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: '800',
            color: '#fff'
          }}>
            🔥
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#E2EAF8' }}>
              {attendanceStreak} Day Streak!
            </div>
            <div style={{ fontSize: '12px', color: '#7A92B8' }}>
              Keep it up! 🎉
            </div>
          </div>
        </div>

        {/* Attendance List */}
        <div style={{ marginTop: '16px' }}>
          {studentAttendance.slice(0, 20).map(record => (
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

          {studentAttendance.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#7A92B8' }}>
              No attendance records yet
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTimetable = () => {
    // Group timetable by day
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timetableByDay = daysOfWeek.map(day => ({
      day,
      subjects: timetable.filter(t =>
        t.day?.toLowerCase() === day.toLowerCase() &&
        t.className === student?.className
      ).sort((a, b) => a.startTime.localeCompare(b.startTime))
    }));

    return (
      <div className="mobile-page">
        <div className="mobile-card">
          <div className="mobile-title">Weekly Timetable</div>
          <div className="mobile-subtitle">Your class schedule</div>

          {timetableByDay.map(({ day, subjects }) => (
            <div key={day} className="timetable-card">
              <div className="timetable-day">{day}</div>
              {subjects.length > 0 ? (
                subjects.map(subject => (
                  <div key={subject.id ?? subject.timetable_id} className="timetable-subject">
                    <div className="timetable-name">{subject.subject}</div>
                    <div className="timetable-time">
                      {subject.startTime} - {subject.endTime}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', color: '#7A92B8', fontSize: '14px' }}>
                  No classes
                </div>
              )}
            </div>
          ))}

          {timetable.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A92B8' }}>
              Timetable not available
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLibrary = () => (
    <div className="mobile-page">
      <div className="mobile-card">
        <div className="mobile-title">My Library</div>
        <div className="mobile-subtitle">Borrowed books and due dates</div>

        {studentBooks.map(book => {
          const dueDate = new Date(book.dueDate || book.due_date);
          const today = new Date();
          const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

          return (
            <div key={book.id ?? book.borrow_id} className="book-card">
              <div className="book-info">
                <h4>{book.title}</h4>
                <p>by {book.author}</p>
                <p style={{ fontSize: '12px', color: '#7A92B8', marginTop: '4px' }}>
                  Borrowed: {new Date(book.borrowDate || book.borrow_date).toLocaleDateString()}
                </p>
              </div>
              <div className="book-due">
                <div className="days" style={{
                  color: daysLeft < 0 ? '#F43F5E' : daysLeft <= 3 ? '#F59E0B' : '#22C55E'
                }}>
                  {daysLeft < 0 ? 'Overdue' : `${daysLeft}d`}
                </div>
                <div className="label">Due {dueDate.toLocaleDateString()}</div>
              </div>
            </div>
          );
        })}

        {studentBooks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#7A92B8' }}>
            No borrowed books
          </div>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'grades': return renderGrades();
      case 'attendance': return renderAttendance();
      case 'timetable': return renderTimetable();
      case 'library': return renderLibrary();
      default: return renderDashboard();
    }
  };

  return (
    <div className="mobile-container">
      <MobileHeader
        schoolName={school?.name || 'EduCore'}
        studentName={`${student?.firstName} ${student?.lastName}`}
        avatar={`${student?.firstName?.[0]}${student?.lastName?.[0]}`}
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

StudentPortalMobile.propTypes = {
  auth: PropTypes.object.isRequired,
  school: PropTypes.object.isRequired,
  student: PropTypes.object.isRequired,
  attendance: PropTypes.array.isRequired,
  results: PropTypes.array.isRequired,
  library: PropTypes.array.isRequired,
  timetable: PropTypes.array.isRequired,
  onNavigate: PropTypes.func.isRequired,
  onLogout: PropTypes.func
};