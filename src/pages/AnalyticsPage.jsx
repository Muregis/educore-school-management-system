import React, { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { money, countBy } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";
import { calculateStudentBalanceLocal } from "../services/studentBalanceUtils";

import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import Button from "../components/ui/Button";
import Tabs from "../components/ui/Tabs";
import EmptyState from "../components/ui/EmptyState";

// Simple chart components without external library
function BarChart({ data, height = 200 }) {
  if (!data?.length) return <div style={{ color: "var(--color-text-secondary)", textAlign: "center", padding: "20px" }}>No data</div>;
  const validData = data.map(d => ({ ...d, value: Number(d.value) || 0 }));
  const max = Math.max(...validData.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", height, gap: "var(--space-2)", padding: "var(--space-4) 0" }}>
      {validData.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ 
            width: "100%", 
            height: `${(d.value / max) * 100}%`, 
            background: d.color || "var(--color-primary)",
            borderRadius: "4px 4px 0 0",
            minHeight: 4,
          }} />
          <div style={{ fontSize: "11px", marginTop: "var(--space-1)", color: "var(--color-text-secondary)", textAlign: "center", wordBreak: "break-word" }}>
            {d.label}
          </div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PieChart({ data, size = 150 }) {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  if (!total || total <= 0) return <div style={{ color: "var(--color-text-secondary)", textAlign: "center", padding: "20px" }}>No data</div>;
  let currentAngle = 0;
  
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const angle = (d.value / total) * 360;
          const startAngle = currentAngle;
          currentAngle += angle;
          
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (currentAngle * Math.PI) / 180;
          
          const x1 = size/2 + (size/2 - 10) * Math.cos(startRad);
          const y1 = size/2 + (size/2 - 10) * Math.sin(startRad);
          const x2 = size/2 + (size/2 - 10) * Math.cos(endRad);
          const y2 = size/2 + (size/2 - 10) * Math.sin(endRad);
          
          const largeArc = angle > 180 ? 1 : 0;
          
          return (
            <path
              key={i}
              d={`M ${size/2} ${size/2} L ${x1} ${y1} A ${size/2 - 10} ${size/2 - 10} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={d.color}
              stroke="var(--color-bg-base)"
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div style={{ width: 12, height: 12, background: d.color, borderRadius: "var(--radius-sm)" }} />
            <span style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>{d.label}: {d.value} ({((d.value/total)*100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage({ auth, students = [], teachers = [], payments = [], results = [], attendance = [], feeStructures = [] }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [aiReport, setAiReport] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [expenditureSummary, setExpenditureSummary] = useState(null);

  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/reports/expenditure-summary", { token: auth.token, signal: ac.signal })
      .then((data) => setExpenditureSummary(data || null))
      .catch((err) => {
        if (err?.code !== "EABORT") {
          console.error("Error fetching expenditure summary:", err);
        }
      });
    return () => ac.abort();
  }, [auth?.token]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === "active" || s.status === "Active").length;
    const byClass = countBy(students, "className");
    const byGender = countBy(students, "gender");

    // Fee stats - use proper balance calculations that include opening balance
    const totalCollected = payments
      .filter(p => (p.status ?? "paid") === "paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalExpenses = Number(expenditureSummary?.totals?.total || 0);
    const payrollExpenses = Number(expenditureSummary?.totals?.payroll || 0);
    const manualExpenses = Number(expenditureSummary?.totals?.manual || 0);
    const pendingFees = students.reduce(
      (sum, student) => sum + calculateStudentBalanceLocal({ student, feeStructures, payments }).balance,
      0
    );

    // Grade stats
    const gradeDist = countBy(results, "grade");
    const avgMarks = results.length > 0 
      ? results.reduce((sum, r) => sum + (Number(r.marks) || 0), 0) / results.length 
      : 0;

    // Attendance stats
    const presentCount = attendance.filter(a => a.status === "present" || a.status === "Present").length;
    const absentCount = attendance.filter(a => a.status === "absent" || a.status === "Absent").length;
    const totalAttendance = attendance.length;
    const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

    return {
      totalStudents, activeStudents, byClass, byGender,
      totalCollected, pendingFees, totalExpenses, payrollExpenses, manualExpenses,
      netCashflow: totalCollected - totalExpenses,
      gradeDist, avgMarks,
      presentCount, absentCount, attendanceRate,
    };
  }, [students, payments, results, attendance, feeStructures, expenditureSummary]);

  // Generate AI analysis
  const generateAIReport = useCallback(async () => {
    if (!auth?.token) return;
    setAiLoading(true);
    setAiReport("");

    const prompt = `You are an academic performance analyst for a Kenyan school.

Analyze the following school performance summary and provide actionable insights:

School Overview:
- Total Students: ${stats.totalStudents}
- Active Students: ${stats.activeStudents}
- Total Teachers: ${teachers.length}

Financial Status:
- Total Collected (KES): ${stats.totalCollected.toFixed(2)}
- Total Expenses (KES): ${stats.totalExpenses.toFixed(2)}
- Payroll Costs (KES): ${stats.payrollExpenses.toFixed(2)}
- Outstanding Fees (KES): ${stats.pendingFees.toFixed(2)}
- Collection Rate: ${stats.totalCollected > 0 ? ((stats.totalCollected / (stats.totalCollected + stats.pendingFees)) * 100).toFixed(1) : 100}%

Academic Performance:
- Average Marks: ${stats.avgMarks.toFixed(1)}/100
- Total Results Recorded: ${results.length}

Attendance:
- Attendance Rate: ${stats.attendanceRate.toFixed(1)}%
- Present: ${stats.presentCount}, Absent: ${stats.absentCount}

Gender Distribution:
- Male: ${stats.byGender.male || 0}, Female: ${stats.byGender.female || 0}

Provide a structured analysis with:
1. Overall Performance Assessment (1-2 sentences)
2. Key Strengths (2-3 bullet points)
3. Areas of Concern (2-3 bullet points)
4. Specific Recommendations (3-4 bullet points)`;

    try {
      const result = await apiFetch("/analysis/ai-report", {
        method: "POST",
        token: auth.token,
        body: { prompt },
      });
      
      if (result?.text) {
        setAiReport(result.text);
      } else if (result?.choices?.[0]?.message?.content) {
        setAiReport(result.choices[0].message.content);
      }
    } catch (e) {
      setAiReport("Error generating AI report: " + (e?.message || "Unknown error"));
    }
    setAiLoading(false);
  }, [auth, stats, teachers.length, results.length]);

  // Chart data
  const classChartData = useMemo(() => {
    return Object.entries(stats.byClass).map(([name, value]) => ({
      label: name,
      value,
      color: "var(--color-primary)",
    }));
  }, [stats.byClass]);

  const genderChartData = useMemo(() => {
    return [
      { label: "Male", value: stats.byGender.male || 0, color: "var(--color-info)" },
      { label: "Female", value: stats.byGender.female || 0, color: "#ec4899" },
    ].filter(d => d.value > 0);
  }, [stats.byGender]);

  const gradeChartData = useMemo(() => {
    const colors = { A: "var(--color-success)", B: "#84CC16", C: "var(--color-warning)", D: "#F97316", E: "var(--color-danger)", F: "#DC2626" };
    return Object.entries(stats.gradeDist).map(([grade, value]) => ({
      label: grade,
      value,
      color: colors[grade] || "var(--color-primary)",
    })).sort((a, b) => b.value - a.value);
  }, [stats.gradeDist]);

  const paymentChartData = useMemo(() => {
    const byMonth = {};
    payments.forEach(p => {
      const month = p.date?.slice(0, 7) || "Unknown";
      byMonth[month] = (byMonth[month] || 0) + Number(p.amount);
    });
    return Object.entries(byMonth).slice(-6).map(([month, value]) => ({
      label: month,
      value: Math.round(value),
      color: "var(--color-success)",
    }));
  }, [payments]);

  const expenseChartData = useMemo(() => {
    return (expenditureSummary?.monthlyTrend || []).slice().reverse().map((item) => ({
      label: item.label,
      value: Math.round(Number(item.total || 0)),
      color: "var(--color-danger)",
    }));
  }, [expenditureSummary]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "academic", label: "Academic" },
    { id: "financial", label: "Financial" },
    { id: "attendance", label: "Attendance" },
    { id: "ai-analysis", label: "🤖 AI Analysis" },
  ];

  return (
    <div>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: "var(--space-4)" }}>
        {/* AI Analysis Tab */}
        {activeTab === "ai-analysis" && (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <Card style={{ padding: "var(--space-4)" }}>
              <div style={{ marginBottom: "var(--space-4)" }}>
                <Button onClick={generateAIReport} disabled={aiLoading} size="lg">
                  {aiLoading ? "Generating..." : "Generate AI Analysis"}
                </Button>
              </div>
              {aiReport && (
                <div style={{
                  background: "var(--color-bg-base)",
                  border: `1px solid var(--color-border)`,
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--color-text-primary)",
                  whiteSpace: "pre-wrap",
                }}>
                  {aiReport}
                </div>
              )}
              {!aiReport && !aiLoading && (
                <EmptyState icon="🧠" title="AI Analytics Ready" description="Click the button above to generate a deep-dive analysis of your school's current standing." />
              )}
            </Card>

            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Monthly Expenditure Trend</h3>
              {expenseChartData.length > 0 ? (
                <BarChart data={expenseChartData} height={200} />
              ) : (
                <EmptyState icon="📊" title="No Data" description="No expenditure data available." />
              )}
            </Card>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            {/* Key Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
              <StatCard title="Total Students" value={stats.totalStudents} subtitle={`${stats.activeStudents} active`} icon="🎓" trend={0} />
              <StatCard title="Teachers" value={teachers.length} subtitle="Staff members" icon="👨‍🏫" trend={0} />
              <StatCard title="Total Collected" value={money(stats.totalCollected)} subtitle="Fees this term" icon="💰" trend={0} />
              <StatCard title="Pending Fees" value={money(stats.pendingFees)} subtitle="Outstanding balance" icon="⏳" trend={0} />
              <StatCard title="Total Expenses" value={money(stats.totalExpenses)} subtitle="Operations and payroll" icon="💸" trend={0} />
              <StatCard title="Net Cashflow" value={money(stats.netCashflow)} subtitle="Collected minus expenses" icon="📉" trend={0} />
            </div>

            {/* Charts Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "var(--space-4)" }}>
              <Card style={{ padding: "var(--space-4)" }}>
                <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Students by Class</h3>
                {classChartData.length > 0 ? (
                  <BarChart data={classChartData} height={180} />
                ) : (
                  <EmptyState icon="📊" title="No Data" description="No class distribution data available." />
                )}
              </Card>
              <Card style={{ padding: "var(--space-4)" }}>
                <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Gender Distribution</h3>
                {genderChartData.length > 0 ? (
                  <PieChart data={genderChartData} size={140} />
                ) : (
                  <EmptyState icon="📊" title="No Data" description="No gender distribution data available." />
                )}
              </Card>
            </div>
          </div>
        )}

        {/* Academic Tab */}
        {activeTab === "academic" && (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
              <StatCard title="Average Marks" value={stats.avgMarks.toFixed(1)} subtitle="Out of 100" icon="📈" trend={0} />
              <StatCard title="Total Results" value={results.length} subtitle="Grades recorded" icon="📋" trend={0} />
            </div>
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Grade Distribution</h3>
              {gradeChartData.length > 0 ? (
                <BarChart data={gradeChartData} height={200} />
              ) : (
                <EmptyState icon="📊" title="No Data" description="No grades recorded yet." />
              )}
            </Card>
          </div>
        )}

        {/* Financial Tab */}
        {activeTab === "financial" && (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
              <StatCard title="Total Collected" value={money(stats.totalCollected)} icon="💵" trend={0} />
              <StatCard title="Pending Balance" value={money(stats.pendingFees)} icon="⏳" trend={0} />
              <StatCard title="Collection Rate" value={`${stats.pendingFees > 0 ? ((stats.totalCollected / (stats.totalCollected + stats.pendingFees)) * 100).toFixed(1) : 100}%`} icon="📊" trend={0} />
              <StatCard title="Total Expenses" value={money(stats.totalExpenses)} icon="💸" trend={0} />
              <StatCard title="Payroll Costs" value={money(stats.payrollExpenses)} icon="👨‍💼" trend={0} />
              <StatCard title="Net Cashflow" value={money(stats.netCashflow)} icon="📉" trend={0} />
            </div>

            {/* Class-wise Outstanding Balance */}
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Outstanding Balance by Class</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
                {ALL_CLASSES.map(cls => {
                  const classStudents = students.filter(s => (s.className || s.class_name) === cls);
                  if (classStudents.length === 0) return null;
                  
                  const classBalanceInfo = classStudents.map(student =>
                    calculateStudentBalanceLocal({ student, feeStructures, payments })
                  );
                  const classExpected = classBalanceInfo.reduce((sum, item) => sum + item.expected, 0);
                  const classPaid = classBalanceInfo.reduce((sum, item) => sum + item.paid, 0);
                  const classOutstanding = classBalanceInfo.reduce((sum, item) => sum + item.balance, 0);
                  
                  return (
                    <div key={cls} style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "var(--space-1)" }}>{cls}</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: classOutstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {money(classOutstanding)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                        {classStudents.length} students · {money(classPaid)} paid
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Monthly Payment Collection</h3>
              {paymentChartData.length > 0 ? (
                <BarChart data={paymentChartData} height={200} />
              ) : (
                <EmptyState icon="📊" title="No Data" description="No payment data available." />
              )}
            </Card>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
              <StatCard title="Attendance Rate" value={`${stats.attendanceRate.toFixed(1)}%`} subtitle="Present students" icon="✅" trend={0} />
              <StatCard title="Present Count" value={stats.presentCount} icon="🟢" trend={0} />
              <StatCard title="Absent Count" value={stats.absentCount} icon="🔴" trend={0} />
            </div>
            <Card style={{ padding: "var(--space-4)" }}>
              <h3 style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-primary)", fontSize: "16px" }}>Attendance Distribution</h3>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <PieChart data={[
                  { label: "Present", value: stats.presentCount, color: "var(--color-success)" },
                  { label: "Absent", value: stats.absentCount, color: "var(--color-danger)" },
                ]} size={160} />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

AnalyticsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array,
  teachers: PropTypes.array,
  payments: PropTypes.array,
  results: PropTypes.array,
  attendance: PropTypes.array,
  feeStructures: PropTypes.array,
};
