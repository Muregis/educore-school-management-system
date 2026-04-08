import React, { useMemo } from "react";
import PropTypes from "prop-types";
import Badge from "../components/Badge";
import Btn from "../components/Btn";
import { C } from "../lib/theme";
import { money } from "../components/Helpers";

export default function PortalDashboardPage({ 
  auth, 
  school, 
  student, 
  attendance, 
  results, 
  payments, 
  feeStructures,
  toast,
  onViewGrades,
  onViewFees,
  onViewAttendance 
}) {
  const studentId = student?.id ?? student?.student_id;
  
  // Calculate stats
  const studentAttendance = useMemo(() => 
    attendance.filter(a => (a.studentId ?? a.student_id) === studentId),
    [attendance, studentId]
  );
  
  const studentResults = useMemo(() => 
    results.filter(r => (r.studentId ?? r.student_id) === studentId),
    [results, studentId]
  );
  
  const studentPayments = useMemo(() => 
    payments.filter(p => (p.studentId ?? p.student_id) === studentId),
    [payments, studentId]
  );
  
  const presentCount = studentAttendance.filter(a => a.status === "present").length;
  const absentCount = studentAttendance.filter(a => a.status === "absent").length;
  const attendanceRate = studentAttendance.length > 0 
    ? Math.round((presentCount / studentAttendance.length) * 100) 
    : 0;
  
  const totalPaid = studentPayments
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  
  const classFee = feeStructures.find(f => f.className === student?.className)?.amount || 0;
  const balance = classFee - totalPaid;
  
  const avgGrade = studentResults.length > 0
    ? Math.round(studentResults.reduce((sum, r) => sum + (Number(r.marks) / Number(r.total || r.total_marks) * 100), 0) / studentResults.length)
    : 0;

  const recentResults = [...studentResults]
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, 5);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Student Info Card */}
      <div style={{ 
        background: C.surface, 
        border: `1px solid ${C.border}`, 
        borderRadius: 12, 
        padding: 20,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 16,
        alignItems: "center"
      }}>
        <div style={{ 
          width: 64, 
          height: 64, 
          borderRadius: "50%", 
          background: `linear-gradient(135deg, ${C.accent}, #6366f1)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 800,
          color: "#fff"
        }}>
          {student?.firstName?.[0]}{student?.lastName?.[0]}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>
            {student?.firstName} {student?.lastName}
          </div>
          <div style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>
            {student?.admission || student?.admission_number} • {student?.className}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Badge text={student?.status || "Active"} tone="success" />
            <Badge text={school?.term + " " + school?.year} tone="info" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatCard 
          label="Attendance" 
          value={`${attendanceRate}%`} 
          subtext={`${presentCount} present / ${absentCount} absent`}
          color={attendanceRate >= 80 ? "#22C55E" : attendanceRate >= 60 ? "#F59E0B" : "#EF4444"}
          onClick={onViewAttendance}
        />
        <StatCard 
          label="Average Grade" 
          value={avgGrade > 0 ? `${avgGrade}%` : "-"} 
          subtext={`${studentResults.length} subjects`}
          color={avgGrade >= 75 ? "#22C55E" : avgGrade >= 50 ? "#F59E0B" : "#EF4444"}
          onClick={onViewGrades}
        />
        <StatCard 
          label="Fees Balance" 
          value={money(balance)} 
          subtext={`Paid: ${money(totalPaid)}`}
          color={balance <= 0 ? "#22C55E" : balance <= classFee * 0.3 ? "#F59E0B" : "#EF4444"}
          onClick={onViewFees}
        />
      </div>

      {/* Recent Grades */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Recent Grades</div>
          <Btn variant="ghost" onClick={onViewGrades}>View All</Btn>
        </div>
        {recentResults.length === 0 ? (
          <div style={{ color: C.textSub, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No grades recorded yet
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentResults.map(r => (
              <div key={r.id ?? r.result_id} style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "10px 12px",
                background: C.bg,
                borderRadius: 8
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.subject}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>{r.exam || r.exam_type || "Exam"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: Number(r.marks) >= 75 ? "#22C55E" : Number(r.marks) >= 50 ? "#F59E0B" : "#EF4444" 
                  }}>
                    {r.marks}/{r.total || r.total_marks}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSub }}>Grade {r.grade}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* School Info */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>School Information</div>
        <div style={{ display: "grid", gap: 8 }}>
          <InfoRow label="School" value={school?.name} />
          <InfoRow label="Term" value={`${school?.term} ${school?.year}`} />
          <InfoRow label="Phone" value={school?.phone} />
          <InfoRow label="Email" value={school?.email} />
          <InfoRow label="Address" value={school?.address} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, color, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        background: C.surface, 
        border: `1px solid ${C.border}`, 
        borderRadius: 12, 
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.15s",
        borderLeft: `4px solid ${color}`
      }}
    >
      <div style={{ fontSize: 12, color: C.textSub, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{subtext}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span style={{ color: C.textSub }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

PortalDashboardPage.propTypes = {
  auth: PropTypes.object,
  school: PropTypes.object,
  student: PropTypes.object,
  attendance: PropTypes.array,
  results: PropTypes.array,
  payments: PropTypes.array,
  feeStructures: PropTypes.array,
  toast: PropTypes.func,
  onViewGrades: PropTypes.func,
  onViewFees: PropTypes.func,
  onViewAttendance: PropTypes.func,
};
