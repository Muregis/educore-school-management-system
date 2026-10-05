import os
import re

fp = 'src/pages/DashboardPage.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix corrupt emojis in EmptyStates first
content = re.sub(r'icon="dY[^\"]*"\.', 'icon="📅"', content)
content = re.sub(r'icon="dY[^\"]*"', 'icon="📅"', content)

# Modify attendance logic
attendance_logic = '''  const termAttendance =
    startDate && endDate
      ? attendance.filter((a) => {
          const d = a.date || a.attendance_date;
          if (!d) return false;
          return d >= startDate && d <= endDate;
        })
      : attendance;

  const attendanceByDate = Object.entries(
    termAttendance.reduce((acc, row) => {
      const d = row.date || row.attendance_date;
      if (!d) return acc;
      if (!acc[d]) acc[d] = { present: 0, total: 0 };
      acc[d].total += 1;
      if (row.status === "present" || row.status === "late") acc[d].present += 1;
      return acc;
    }, {})
  ).sort((a, b) => new Date(a[0]) - new Date(b[0]));'''

new_attendance_logic = '''  // Get last 7 days of actual attendance records regardless of term window constraints
  const recentAttendanceDates = [...new Set(attendance.map(a => a.date || a.attendance_date))].filter(Boolean).sort().slice(-7);
  
  const attendanceByDate = recentAttendanceDates.map(d => {
    const dayRecords = attendance.filter(a => (a.date || a.attendance_date) === d);
    const present = dayRecords.filter(r => r.status === "present" || r.status === "late").length;
    return [d, { total: dayRecords.length, present }];
  });'''
content = content.replace(attendance_logic, new_attendance_logic)

# Modify grades logic to show explicit empty states
chart_block = '''          <ChartCard title="Attendance Trend (Last 7 Days)">
            {attendanceByDate.length === 0 ? (
              <EmptyState icon="📅" title="No Attendance" description="No attendance data recorded yet." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", alignItems: "end", gap: 8, minHeight: 120 }}>
                {attendanceByDate.map(([date, values]) => {'''

new_chart_block = '''          <ChartCard title="Attendance Trend (Last 7 Days)">
            {attendanceByDate.length === 0 ? (
              <EmptyState icon="📅" title="No Attendance" description={attendance.length > 0 ? "No attendance in recent 7 days." : "No attendance data recorded yet."} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", alignItems: "end", gap: 8, minHeight: 120 }}>
                {attendanceByDate.map(([date, values]) => {'''
content = content.replace(chart_block, new_chart_block)

grade_chart = '''          <ChartCard title="Grade Distribution" subtitle="Current performance split">
            {["EE", "ME", "AE", "BE"].map((g) => (
              <ProgressRow
                key={g}
                label={g}
                value={gradeCount[g]}
                max={Math.max(...Object.values(gradeCount), 1)}
                color={g === "EE" ? "var(--color-success)" : g === "ME" ? "var(--color-teal)" : g === "AE" ? "var(--color-warning)" : "var(--color-danger)"}
              />
            ))}
          </ChartCard>'''

new_grade_chart = '''          <ChartCard title="Grade Distribution" subtitle={currentTerm ? Grades for  : "Current performance split"}>
            {termResults.length === 0 ? (
              <EmptyState 
                icon="📊" 
                title="No Grades Yet" 
                description={results.length > 0 ? No grades found for . Switch terms in Grades page. : "No grades recorded for this term."} 
              />
            ) : (
              ["EE", "ME", "AE", "BE"].map((g) => (
                <ProgressRow
                  key={g}
                  label={g}
                  value={gradeCount[g]}
                  max={Math.max(...Object.values(gradeCount), 1)}
                  color={g === "EE" ? "var(--color-success)" : g === "ME" ? "var(--color-teal)" : g === "AE" ? "var(--color-warning)" : "var(--color-danger)"}
                />
              ))
            )}
          </ChartCard>'''
content = content.replace(grade_chart, new_grade_chart)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Dashboard charts")
