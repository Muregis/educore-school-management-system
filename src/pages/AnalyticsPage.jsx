import React, { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";
import { money, countBy } from "../lib/utils";
import { apiFetch } from "../lib/api";
import Btn from "../components/Btn";
import { ALL_CLASSES } from "../lib/constants";

const inputStyle = {
  background: C.card, color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "6px 10px", fontSize: 13,
};

// Simple chart components without external library
function BarChart({ data, height = 200 }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", height, gap: 8, padding: "20px 0" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ 
            width: "100%", 
            height: `${(d.value / max) * 100}%`, 
            background: d.color || C.accent,
            borderRadius: "4px 4px 0 0",
            minHeight: 4,
          }} />
          <div style={{ fontSize: 11, marginTop: 4, color: C.textSub, textAlign: "center" }}>
            {d.label}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PieChart({ data, size = 150 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;
  
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
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
              stroke="#fff"
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, background: d.color, borderRadius: 2 }} />
            <span style={{ fontSize: 12, color: C.text }}>{d.label}: {d.value} ({((d.value/total)*100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, trend, color = C.accent }) {
  return (
    <div style={{ 
      background: C.surface, 
      border: `1px solid ${C.border}`, 
      borderRadius: 12, 
      padding: 20,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{subtitle}</div>}
      {trend && (
        <div style={{ 
          fontSize: 12, 
          marginTop: 8, 
          color: trend > 0 ? "#22C55E" : "#EF4444",
          fontWeight: 600,
        }}>
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% from last term
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage({ auth, students = [], teachers = [], payments = [], results = [], attendance = [], feeStructures = [] }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [aiReport, setAiReport] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === "active" || s.status === "Active").length;
    const byClass = countBy(students, "className");
    const byGender = countBy(students, "gender");

    // Fee stats
    const totalCollected = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingFees = students.reduce((sum, s) => {
      const struct = feeStructures.find(f => f.className === s.className);
      const tuition = struct?.tuition || 0;
      const studentPayments = payments.filter(p => p.studentId === (s.id ?? s.student_id)).reduce((t, p) => t + Number(p.amount), 0);
      return sum + Math.max(0, tuition - studentPayments);
    }, 0);

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
      totalCollected, pendingFees,
      gradeDist, avgMarks,
      presentCount, absentCount, attendanceRate,
    };
  }, [students, payments, results, attendance, feeStructures]);

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

  // Chart data
  const classChartData = useMemo(() => {
    return Object.entries(stats.byClass).map(([name, value]) => ({
      label: name,
      value,
      color: C.accent,
    }));
  }, [stats.byClass]);

  const genderChartData = useMemo(() => {
    return [
      { label: "Male", value: stats.byGender.male || 0, color: "#3B82F6" },
      { label: "Female", value: stats.byGender.female || 0, color: "#EC4899" },
    ].filter(d => d.value > 0);
  }, [stats.byGender]);

  const gradeChartData = useMemo(() => {
    const colors = { A: "#22C55E", B: "#84CC16", C: "#EAB308", D: "#F97316", E: "#EF4444", F: "#DC2626" };
    return Object.entries(stats.gradeDist).map(([grade, value]) => ({
      label: grade,
      value,
      color: colors[grade] || C.accent,
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
      color: "#22C55E",
    }));
  }, [payments]);

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["overview", "academic", "financial", "attendance", "ai-analysis"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === tab ? C.accent : C.surface,
              color: activeTab === tab ? "#fff" : C.text,
              cursor: "pointer",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {tab === "ai-analysis" ? "🤖 AI Analysis" : tab}
          </button>
        ))}
      </div>

      {/* AI Analysis Tab */}
      {activeTab === "ai-analysis" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <Btn onClick={generateAIReport} disabled={aiLoading}>
                {aiLoading ? "Generating..." : "Generate AI Analysis"}
              </Btn>
            </div>
            {aiReport && (
              <div style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 16,
                fontSize: 13,
                lineHeight: 1.6,
                color: C.text,
                whiteSpace: "pre-wrap",
              }}>
                {aiReport}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Key Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <StatCard title="Total Students" value={stats.totalStudents} subtitle={`${stats.activeStudents} active`} color="#3B82F6" />
            <StatCard title="Teachers" value={teachers.length} subtitle="Staff members" color="#8B5CF6" />
            <StatCard title="Total Collected" value={money(stats.totalCollected)} subtitle="Fees this term" color="#22C55E" />
            <StatCard title="Pending Fees" value={money(stats.pendingFees)} subtitle="Outstanding balance" color="#EF4444" />
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 16 }}>Students by Class</h3>
              {classChartData.length > 0 ? (
                <BarChart data={classChartData} height={180} />
              ) : (
                <div style={{ color: C.textSub, textAlign: "center", padding: 40 }}>No data available</div>
              )}
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 16 }}>Gender Distribution</h3>
              {genderChartData.length > 0 ? (
                <PieChart data={genderChartData} size={140} />
              ) : (
                <div style={{ color: C.textSub, textAlign: "center", padding: 40 }}>No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Academic Tab */}
      {activeTab === "academic" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <StatCard title="Average Marks" value={stats.avgMarks.toFixed(1)} subtitle="Out of 100" color="#8B5CF6" />
            <StatCard title="Total Results" value={results.length} subtitle="Grades recorded" color="#3B82F6" />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 16 }}>Grade Distribution</h3>
            {gradeChartData.length > 0 ? (
              <BarChart data={gradeChartData} height={200} />
            ) : (
              <div style={{ color: C.textSub, textAlign: "center", padding: 40 }}>No grades recorded yet</div>
            )}
          </div>
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === "financial" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <StatCard title="Total Collected" value={money(stats.totalCollected)} color="#22C55E" />
            <StatCard title="Pending Balance" value={money(stats.pendingFees)} color="#EF4444" />
            <StatCard title="Collection Rate" value={`${stats.pendingFees > 0 ? ((stats.totalCollected / (stats.totalCollected + stats.pendingFees)) * 100).toFixed(1) : 100}%`} color="#EAB308" />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 16 }}>Monthly Payment Collection</h3>
            {paymentChartData.length > 0 ? (
              <BarChart data={paymentChartData} height={200} />
            ) : (
              <div style={{ color: C.textSub, textAlign: "center", padding: 40 }}>No payment data</div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <StatCard title="Attendance Rate" value={`${stats.attendanceRate.toFixed(1)}%`} subtitle="Present students" color="#22C55E" />
            <StatCard title="Present Count" value={stats.presentCount} color="#3B82F6" />
            <StatCard title="Absent Count" value={stats.absentCount} color="#EF4444" />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 16 }}>Attendance Distribution</h3>
            <PieChart data={[
              { label: "Present", value: stats.presentCount, color: "#22C55E" },
              { label: "Absent", value: stats.absentCount, color: "#EF4444" },
            ]} size={160} />
          </div>
        </div>
      )}
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
