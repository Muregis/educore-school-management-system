import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { money } from "../lib/utils";

import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";

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
  
  // Calculate class fee from fee structure (tuition + activity + misc)
  const feeStruct = feeStructures?.find(f => 
    (f.className ?? f.class_name) === (student?.className ?? student?.class_name)
  );
  const classFee = feeStruct
    ? (Number(feeStruct.tuition || 0) + Number(feeStruct.activity || 0) + Number(feeStruct.misc || 0))
    : 0;
  const balance = classFee - totalPaid;
  
  // Calculate average grade across all subjects
  const avgGrade = useMemo(() => {
    if (studentResults.length === 0) return 0;
    const validResults = studentResults.filter(r => r.marks != null && (r.total || r.total_marks));
    if (validResults.length === 0) return 0;
    const totalPercentage = validResults.reduce((sum, r) => {
      const percentage = (Number(r.marks) / Number(r.total || r.total_marks || 100)) * 100;
      return sum + percentage;
    }, 0);
    return Math.round(totalPercentage / validResults.length);
  }, [studentResults]);

  const recentResults = useMemo(() => {
    return [...studentResults]
      .sort((a, b) => {
        const dateA = new Date(a.date || a.created_at || a.createdAt || 0);
        const dateB = new Date(b.date || b.created_at || b.createdAt || 0);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [studentResults]);

  // Handle missing student
  if (!student) {
    return (
      <Card style={{ padding: "var(--space-5)", textAlign: "center" }}>
        <EmptyState icon="👤" title="No Student Data" description="No student data is available. Please contact the school administrator if you believe this is an error." />
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Student Info Card */}
      <Card style={{ padding: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ 
            width: 72, 
            height: 72, 
            borderRadius: "var(--radius-full)", 
            background: `linear-gradient(135deg, var(--color-primary), var(--color-info))`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            fontWeight: 800,
            color: "#ffffff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}>
            {(student?.firstName ?? student?.first_name)?.[0]}{(student?.lastName ?? student?.last_name)?.[0]}
          </div>
          <div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
              {student?.firstName ?? student?.first_name} {student?.lastName ?? student?.last_name}
            </div>
            <div style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)", fontWeight: 500 }}>
              <span style={{ fontFamily: "var(--font-mono)" }}>{student?.admission || student?.admission_number}</span> • {student?.className ?? student?.class_name}
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Badge text={student?.status || "Active"} variant="success" />
              <Badge text={school?.term + " " + school?.year} variant="info" />
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
        <StatCard 
          label="Attendance" 
          value={`${attendanceRate}%`} 
          subtext={`${presentCount} present / ${absentCount} absent`}
          color={attendanceRate >= 80 ? "var(--color-success)" : attendanceRate >= 60 ? "var(--color-warning)" : "var(--color-danger)"}
          onClick={onViewAttendance}
        />
        <StatCard 
          label="Average Grade" 
          value={avgGrade > 0 ? `${avgGrade}%` : "-"} 
          subtext={`${studentResults.length} subjects`}
          color={avgGrade >= 75 ? "var(--color-success)" : avgGrade >= 50 ? "var(--color-warning)" : "var(--color-danger)"}
          onClick={onViewGrades}
        />
        <StatCard 
          label="Fees Balance" 
          value={money(balance)} 
          subtext={`Paid: ${money(totalPaid)}`}
          color={balance <= 0 ? "var(--color-success)" : balance <= classFee * 0.3 ? "var(--color-warning)" : "var(--color-danger)"}
          onClick={onViewFees}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
        {/* Recent Grades */}
        <Card style={{ padding: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)" }}>Recent Grades</h3>
            <Button variant="ghost" size="sm" onClick={onViewGrades}>View All</Button>
          </div>
          {recentResults.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: "14px", padding: "var(--space-4) 0", textAlign: "center" }}>
              No grades recorded yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {recentResults.map(r => (
                <div key={r.id ?? r.result_id} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "var(--space-3)",
                  background: "var(--color-bg-base)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)"
                }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "2px" }}>{r.subject}</div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{r.exam || r.exam_type || "Exam"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ 
                      fontSize: "16px", 
                      fontWeight: 800, 
                      color: Number(r.marks) >= 75 ? "var(--color-success)" : Number(r.marks) >= 50 ? "var(--color-warning)" : "var(--color-danger)" 
                    }}>
                      {r.marks}/{r.total || r.total_marks || 100}
                    </div>
                    {r.grade && <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600 }}>Grade {r.grade}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* School Info */}
        <Card style={{ padding: "var(--space-4)" }}>
          <h3 style={{ margin: "0 0 var(--space-4) 0", fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)" }}>School Information</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <InfoRow label="School" value={school?.name} />
            <InfoRow label="Term" value={`${school?.term} ${school?.year}`} />
            <InfoRow label="Phone" value={school?.phone} />
            <InfoRow label="Email" value={school?.email} />
            <InfoRow label="Address" value={school?.address} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, color, onClick }) {
  return (
    <Card 
      onClick={onClick}
      style={{ 
        padding: "var(--space-4)",
        cursor: onClick ? "pointer" : "default",
        borderLeft: `4px solid ${color}`,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {onClick && <div style={{ position: "absolute", top: "var(--space-2)", right: "var(--space-3)", color: "var(--color-text-muted)", opacity: 0.5 }}>→</div>}
      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-1)" }}>{label}</div>
      <div style={{ fontSize: "32px", fontWeight: 800, color, marginBottom: "var(--space-1)", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: "13px", color: "var(--color-text-muted)", fontWeight: 500 }}>{subtext}</div>
    </Card>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "var(--space-2)", borderBottom: "1px dashed var(--color-border)" }}>
      <span style={{ color: "var(--color-text-secondary)", fontSize: "14px", fontWeight: 500 }}>{label}</span>
      <span style={{ color: "var(--color-text-primary)", fontSize: "14px", fontWeight: 600, textAlign: "right" }}>{value}</span>
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
