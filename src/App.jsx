import { useEffect, useMemo, useState } from "react";
import { DEFAULTS, NAV, ROLE } from "./lib/constants";
import { C } from "./lib/theme";
import { genId } from "./lib/utils";
import { useLocalState } from "./hooks/useLocalState";
import Btn from "./components/Btn";
import NotificationPanel from "./components/NotificationPanel";
import LoginView from "./pages/LoginView";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import TeachersPage from "./pages/TeachersPage";
import AttendancePage from "./pages/AttendancePage";
import GradesPage from "./pages/GradesPage";
import FeesPage from "./pages/FeesPage";
import SettingsPage from "./pages/SettingsPage";
import DisciplinePage from "./pages/DisciplinePage";
import TransportPage from "./pages/TransportPage";
import CommunicationPage from "./pages/CommunicationPage";
import AccountsPage from "./pages/AdminAccountsPage";
import ReportsPage from "./pages/ReportsPage";
import TimetablePage from "./pages/TimetablePage";
import { Toasts, Forbidden, NotFound } from "./components/Helpers";

export default function App() {
  const [school, setSchool]               = useLocalState("educore.school",        DEFAULTS.school);
  const [users, setUsers]                 = useLocalState("educore.users",          DEFAULTS.users);
  const [students, setStudents]           = useLocalState("educore.students",       DEFAULTS.students);
  const [teachers, setTeachers]           = useLocalState("educore.teachers",       DEFAULTS.teachers);
  const [attendance, setAttendance]       = useLocalState("educore.attendance",     DEFAULTS.attendance);
  const [results, setResults]             = useLocalState("educore.results",        DEFAULTS.results);
  const [feeStructures, setFeeStructures] = useLocalState("educore.feeStructures",  DEFAULTS.feeStructures);
  const [payments, setPayments]           = useLocalState("educore.payments",       DEFAULTS.payments);
  const [notifications, setNotifications] = useLocalState("educore.notifications",  DEFAULTS.notifications);

  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem("educore.auth");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });

  const [page, setPage]                   = useState("dashboard");
  const [showBell, setShowBell]           = useState(false);
  const [toasts, setToasts]               = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);

  const toast = (text, type = "success") => {
    const id = genId();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    // Only log notifications for admin and teacher — not portal users
    if (auth && ["admin","teacher","finance"].includes(auth.role)) {
      setNotifications(prev => [{ id: genId(), message: text, read: false, time: new Date().toLocaleString() }, ...prev].slice(0, 80));
    }
  };

  const perms    = auth ? ROLE[auth.role] : null;
  const isPortal = auth?.role === "parent" || auth?.role === "student";
  const isParent = auth?.role === "parent";
  const canEdit  = Boolean(perms?.edit);

  // All children sharing same parentPhone
  const myChildren = useMemo(() => {
    if (!isParent) return [];
    const loginStudent = students.find(s => (s.id ?? s.student_id) === auth?.studentId);
    if (!loginStudent) return [];
    const phone = loginStudent.parentPhone ?? loginStudent.parent_phone ?? "";
    if (!phone) return [loginStudent];
    return students.filter(s => (s.parentPhone ?? s.parent_phone ?? "") === phone && s.status === "active");
  }, [isParent, students, auth]);

  const linkedStudentId = useMemo(() => {
    if (auth?.role === "student") return auth?.studentId ?? null;
    if (isParent) return activeChildId || auth?.studentId || (myChildren[0]?.id ?? myChildren[0]?.student_id ?? null);
    return null;
  }, [isParent, auth, activeChildId, myChildren]);

  const activeChild = useMemo(() =>
    myChildren.find(s => (s.id ?? s.student_id) === linkedStudentId) || myChildren[0],
    [myChildren, linkedStudentId]
  );

  const myStudents   = isPortal ? students.filter(s => (s.id ?? s.student_id) === linkedStudentId) : students;
  const myAttendance = isPortal ? attendance.filter(a => (a.studentId ?? a.student_id) === linkedStudentId) : attendance;
  const myResults    = isPortal ? results.filter(r => (r.studentId ?? r.student_id) === linkedStudentId) : results;
  const myPayments   = isPortal ? payments.filter(p => (p.studentId ?? p.student_id) === linkedStudentId) : payments;

  const nav = useMemo(() => perms ? NAV.filter(n => perms.pages.includes(n.id)) : [], [perms]);
  useEffect(() => { if (perms && !perms.pages.includes(page)) setPage(perms.pages[0]); }, [perms, page]);

  const resetDemo = () => {
    setSchool(DEFAULTS.school); setUsers(DEFAULTS.users); setStudents(DEFAULTS.students);
    setTeachers(DEFAULTS.teachers); setAttendance(DEFAULTS.attendance); setResults(DEFAULTS.results);
    setFeeStructures(DEFAULTS.feeStructures); setPayments(DEFAULTS.payments); setNotifications(DEFAULTS.notifications);
    toast("Demo data reset", "success");
  };

  if (!auth) return (
    <LoginView
      users={users}
      onLogin={u => { setAuth(u); setActiveChildId(null); localStorage.setItem("educore.auth", JSON.stringify(u)); toast(`Welcome, ${u.name}`, "success"); }}
    />
  );

  const pageExists = NAV.some(n => n.id === page) || ["accounts","reports","timetable"].includes(page);
  const allowed    = perms?.pages.includes(page) || (auth.role === "admin" && ["accounts","reports","timetable"].includes(page));

  const pages = {
    dashboard:     <DashboardPage students={myStudents} teachers={teachers} attendance={myAttendance} payments={myPayments} feeStructures={feeStructures} results={myResults} />,
    students:      <StudentsPage auth={auth} students={myStudents} setStudents={setStudents} canEdit={canEdit} results={myResults} payments={myPayments} feeStructures={feeStructures} toast={toast} />,
    teachers:      <TeachersPage auth={auth} teachers={teachers} setTeachers={setTeachers} canEdit={canEdit} toast={toast} />,
    attendance:    <AttendancePage auth={auth} students={myStudents} attendance={myAttendance} setAttendance={setAttendance} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    grades:        <GradesPage auth={auth} students={myStudents} results={myResults} setResults={setResults} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    fees:          <FeesPage auth={auth} students={myStudents} feeStructures={feeStructures} setFeeStructures={setFeeStructures} payments={myPayments} setPayments={setPayments} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    discipline:    <DisciplinePage auth={auth} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    transport:     <TransportPage auth={auth} canEdit={canEdit} toast={toast} />,
    communication: <CommunicationPage auth={auth} canEdit={canEdit} toast={toast} />,
    settings:      auth.role === "admin"
      ? <div><SettingsPage school={school} setSchool={setSchool} users={users} setUsers={setUsers} toast={toast} /><div style={{ marginTop: 12 }}><Btn variant="danger" onClick={() => { if (window.confirm("Reset demo data?")) resetDemo(); }}>Reset Demo Data</Btn></div></div>
      : <Forbidden />,
    accounts:   auth.role === "admin" ? <AccountsPage auth={auth} students={students} toast={toast} /> : <Forbidden />,
    reports:    auth.role === "admin" || auth.role === "teacher" ? <ReportsPage auth={auth} toast={toast} /> : <Forbidden />,
    timetable:  <TimetablePage auth={auth} teachers={teachers} canEdit={canEdit} toast={toast} />,
  };

  // Build nav including admin-only extras
  const fullNav = [
    ...nav,
    ...(auth.role === "admin" ? [
      { id: "accounts",  label: "Accounts" },
      { id: "reports",   label: "Reports" },
      { id: "timetable", label: "Timetable" },
    ] : auth.role === "teacher" ? [
      { id: "reports",   label: "Reports" },
      { id: "timetable", label: "Timetable" },
    ] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <aside style={{ width: 230, borderRight: `1px solid ${C.border}`, background: C.surface, position: "fixed", top: 0, left: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800 }}>EduCore</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{school.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{school.term} {school.year}</div>
        </div>

        {isParent && myChildren.length > 0 && (
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Viewing child</div>
            {myChildren.length === 1 ? (
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{activeChild?.firstName} {activeChild?.lastName}</div>
            ) : (
              <select
                style={{ width: "100%", background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}
                value={linkedStudentId || ""}
                onChange={e => { setActiveChildId(Number(e.target.value)); setPage("dashboard"); }}
              >
                {myChildren.map(s => {
                  const sid  = s.id ?? s.student_id;
                  const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                  return <option key={sid} value={sid}>{name}</option>;
                })}
              </select>
            )}
            {activeChild && (
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                {activeChild.className ?? activeChild.class_name} · {activeChild.admission ?? activeChild.admission_number}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: 10, flex: 1, overflowY: "auto" }}>
          {fullNav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ width: "100%", textAlign: "left", marginBottom: 4, border: `1px solid ${page === n.id ? C.accentDim : "transparent"}`, borderRadius: 9, padding: "8px 10px", background: page === n.id ? C.accentGlow : "transparent", color: page === n.id ? C.accent : C.textSub, cursor: "pointer" }}>
              {n.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.text }}>{auth.name}</div>
          <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 8, textTransform: "capitalize" }}>{auth.role}</div>
          <Btn variant="ghost" onClick={() => { localStorage.removeItem("educore.auth"); setAuth(null); setActiveChildId(null); }}>Logout</Btn>
        </div>
      </aside>

      <main style={{ marginLeft: 230, flex: 1 }}>
        <div style={{ height: 62, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", position: "sticky", top: 0, zIndex: 40 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{fullNav.find(n => n.id === page)?.label || page}</div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>
              {isPortal
                ? `${isParent ? "Parent" : "Student"} · ${activeChild ? `${activeChild.firstName ?? activeChild.first_name} ${activeChild.lastName ?? activeChild.last_name}` : auth.name}`
                : `Role: ${auth.role} | Edit: ${canEdit ? "Yes" : "No"}`}
            </div>
          </div>
          {["admin","teacher","finance"].includes(auth.role) && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowBell(!showBell)} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, color: C.textSub, cursor: "pointer", padding: "7px 10px" }}>
                🔔 {notifications.filter(n => !n.read).length}
              </button>
              {showBell && <NotificationPanel list={notifications} markAll={() => setNotifications(notifications.map(n => ({ ...n, read: true })))} />}
            </div>
          )}
        </div>
        <div style={{ padding: 16 }}>
          {!pageExists ? <NotFound /> : !allowed ? <Forbidden /> : (pages[page] || <NotFound />)}
        </div>
      </main>

      <Toasts items={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}