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
import AdmissionsPage from "./pages/AdmissionsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ReportCardsPage from "./pages/ReportCardsPage";
import HRPage from "./pages/HRPage";
import LibraryPage from "./pages/LibraryPage";
import StaffPage from "./pages/StaffPage";
import { Toasts, Forbidden, NotFound } from "./components/Helpers";

const ROLE_COLORS = {
  admin:"#3B82F6", teacher:"#14B8A6", finance:"#F59E0B",
  hr:"#A855F7", librarian:"#22C55E", parent:"#F43F5E", student:"#38BDF8",
};

const ROLE_AVATARS = {
  admin:"A", teacher:"T", finance:"F", hr:"H", librarian:"L", parent:"P", student:"S",
};

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
  const [sideCollapsed, setSideCollapsed] = useState(false);

  const toast = (text, type = "success") => {
    const id = genId();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    if (auth && ["admin","teacher","finance"].includes(auth.role)) {
      setNotifications(prev => [{ id: genId(), message: text, read: false, time: new Date().toLocaleString() }, ...prev].slice(0, 80));
    }
  };

  const perms    = auth ? (ROLE[auth.role] || null) : null;
  const isPortal = auth?.role === "parent" || auth?.role === "student";
  const isParent = auth?.role === "parent";
  const canEdit  = Boolean(perms?.edit);

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
    <LoginView onLogin={u => { setAuth(u); setActiveChildId(null); localStorage.setItem("educore.auth", JSON.stringify(u)); toast(`Welcome, ${u.name}`, "success"); }} />
  );

  const pageExists = NAV.some(n => n.id === page);
  const allowed    = perms?.pages.includes(page);
  const roleColor  = ROLE_COLORS[auth.role] || C.accent;
  const sideW      = sideCollapsed ? 64 : 240;

  const pages = {
    dashboard:     <DashboardPage auth={auth} school={school} students={myStudents} teachers={teachers} attendance={myAttendance} payments={myPayments} feeStructures={feeStructures} results={myResults} toast={toast} />,
    students:      <StudentsPage auth={auth} students={myStudents} setStudents={setStudents} canEdit={canEdit} results={myResults} payments={myPayments} feeStructures={feeStructures} toast={toast} />,
    teachers:      <TeachersPage auth={auth} teachers={teachers} setTeachers={setTeachers} canEdit={canEdit} toast={toast} />,
    attendance:    <AttendancePage auth={auth} students={myStudents} attendance={myAttendance} setAttendance={setAttendance} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    grades:        <GradesPage auth={auth} students={myStudents} results={myResults} setResults={setResults} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    fees:          <FeesPage auth={auth} students={myStudents} feeStructures={feeStructures} setFeeStructures={setFeeStructures} payments={myPayments} setPayments={setPayments} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    admissions:    <AdmissionsPage auth={auth} canEdit={canEdit} toast={toast} />,
    invoices:      <InvoicesPage auth={auth} students={students} canEdit={canEdit} toast={toast} />,
    reportcards:   <ReportCardsPage auth={auth} students={myStudents} canEdit={canEdit} toast={toast} />,
    hr:            ["admin","hr"].includes(auth.role) ? <HRPage auth={auth} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    staff:         ["admin","hr"].includes(auth.role) ? <StaffPage auth={auth} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    library:       <LibraryPage auth={auth} students={myStudents} teachers={teachers} toast={toast} />,
    discipline:    <DisciplinePage auth={auth} students={myStudents} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    transport:     <TransportPage auth={auth} canEdit={canEdit} toast={toast} />,
    communication: <CommunicationPage auth={auth} canEdit={canEdit} toast={toast} />,
    timetable:     <TimetablePage auth={auth} teachers={teachers} canEdit={canEdit} toast={toast} />,
    reports:       ["admin","teacher"].includes(auth.role) ? <ReportsPage auth={auth} toast={toast} /> : <Forbidden />,
    accounts:      auth.role === "admin" ? <AccountsPage auth={auth} students={students} toast={toast} /> : <Forbidden />,
    settings:      auth.role === "admin"
      ? <div><SettingsPage school={school} setSchool={setSchool} users={users} setUsers={setUsers} toast={toast} /><div style={{ marginTop:12 }}><Btn variant="danger" onClick={() => { if (window.confirm("Reset demo data?")) resetDemo(); }}>Reset Demo Data</Btn></div></div>
      : <Forbidden />,
  };

  const currentNav = nav.find(n => n.id === page);

  return (
    <div style={{ minHeight:"100vh", display:"flex", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width: sideW, height:"100vh", background:C.surface,
        borderRight:`1px solid ${C.border}`, position:"fixed", top:0, left:0,
        display:"flex", flexDirection:"column", zIndex:50,
        transition:"width 0.2s ease", overflow:"hidden",
      }}>
        {/* Logo row */}
        <div style={{ padding:"16px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, minHeight:64 }}>
          <div style={{
            width:36, height:36, borderRadius:10, flexShrink:0,
            background:`linear-gradient(135deg, ${C.accent}, #6366f1)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, fontSize:16, color:"#fff", letterSpacing:-1,
          }}>E</div>
          {!sideCollapsed && (
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:C.text, lineHeight:1.1 }}>EduCore</div>
              <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{school.name}</div>
            </div>
          )}
          <button onClick={() => setSideCollapsed(v => !v)} style={{
            marginLeft:"auto", background:"transparent", border:`1px solid ${C.border}`,
            borderRadius:7, color:C.textMuted, cursor:"pointer", padding:"3px 7px", fontSize:12, flexShrink:0,
          }}>{sideCollapsed ? "▶" : "◀"}</button>
        </div>

        {/* Child selector for parents */}
        {!sideCollapsed && isParent && myChildren.length > 0 && (
          <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, background:C.bg }}>
            <div style={{ fontSize:10, color:C.textMuted, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Viewing child</div>
            {myChildren.length === 1 ? (
              <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{activeChild?.firstName} {activeChild?.lastName}</div>
            ) : (
              <select style={{ width:"100%", background:C.card, color:C.text, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 8px", fontSize:13 }}
                value={linkedStudentId || ""} onChange={e => { setActiveChildId(Number(e.target.value)); setPage("dashboard"); }}>
                {myChildren.map(s => {
                  const sid  = s.id ?? s.student_id;
                  const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                  return <option key={sid} value={sid}>{name}</option>;
                })}
              </select>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px", minHeight:0 }}>
          {nav.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)} title={sideCollapsed ? n.label : ""} style={{
                width:"100%", textAlign:"left", marginBottom:3,
                border:`1px solid ${active ? C.accentDim : "transparent"}`,
                borderRadius:9, padding: sideCollapsed ? "9px 0" : "9px 11px",
                background: active ? C.accentGlow : "transparent",
                color: active ? C.accent : C.textSub,
                cursor:"pointer", fontSize:13, display:"flex", alignItems:"center",
                gap:9, justifyContent: sideCollapsed ? "center" : "flex-start",
                transition:"background 0.15s, color 0.15s",
              }}>
                <span style={{ fontSize:15, flexShrink:0 }}>{n.icon}</span>
                {!sideCollapsed && <span>{n.label}</span>}
                {!sideCollapsed && active && <span style={{ marginLeft:"auto", width:5, height:5, borderRadius:"50%", background:C.accent, flexShrink:0 }} />}
              </button>
            );
          })}
        </nav>

        {/* User card */}
        <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
          {!sideCollapsed ? (
            <div style={{ background:C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{
                  width:32, height:32, borderRadius:8, background:`${roleColor}22`,
                  border:`1px solid ${roleColor}44`, display:"flex", alignItems:"center",
                  justifyContent:"center", fontWeight:800, fontSize:14, color:roleColor, flexShrink:0,
                }}>{ROLE_AVATARS[auth.role] || "?"}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{auth.name}</div>
                  <div style={{ fontSize:10, color:roleColor, textTransform:"capitalize", fontWeight:600 }}>{auth.role}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:`${roleColor}22`, border:`1px solid ${roleColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:roleColor }}>
                {ROLE_AVATARS[auth.role] || "?"}
              </div>
            </div>
          )}
          <button onClick={() => { localStorage.removeItem("educore.auth"); setAuth(null); setActiveChildId(null); }} style={{
            width:"100%", padding: sideCollapsed ? "7px 0" : "7px 12px", borderRadius:8,
            background:"transparent", border:`1px solid ${C.border}`,
            color:C.textSub, cursor:"pointer", fontSize:12,
            display:"flex", alignItems:"center", justifyContent: sideCollapsed ? "center" : "flex-start", gap:7,
          }} title="Logout">
            <span>⇐</span>
            {!sideCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main style={{ marginLeft:sideW, flex:1, transition:"margin-left 0.2s ease" }}>

        {/* Topbar */}
        <div style={{
          height:62, background:C.surface, borderBottom:`1px solid ${C.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"0 20px", position:"sticky", top:0, zIndex:40,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {/* Breadcrumb */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:16 }}>{currentNav?.icon}</span>
                <span style={{ fontWeight:800, fontSize:18, color:C.text }}>{currentNav?.label || page}</span>
              </div>
              <div style={{ color:C.textMuted, fontSize:11, marginTop:1 }}>
                {isPortal
                  ? `${isParent ? "Parent" : "Student"} · ${activeChild ? `${activeChild.firstName ?? activeChild.first_name} ${activeChild.lastName ?? activeChild.last_name}` : auth.name}`
                  : school.name + " · " + school.term + " " + school.year}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Role badge */}
            <div style={{ background:`${roleColor}18`, border:`1px solid ${roleColor}44`, borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700, color:roleColor, textTransform:"capitalize" }}>
              {auth.role}
            </div>

            {/* Bell */}
            {["admin","teacher","finance"].includes(auth.role) && (
              <div style={{ position:"relative" }}>
                <button onClick={() => setShowBell(!showBell)} style={{
                  border:`1px solid ${C.border}`, borderRadius:9, background:C.card,
                  color:C.textSub, cursor:"pointer", padding:"7px 11px", fontSize:13, position:"relative",
                }}>
                  🔔
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span style={{
                      position:"absolute", top:4, right:5, width:8, height:8, borderRadius:"50%",
                      background:C.rose, border:`2px solid ${C.surface}`,
                    }} />
                  )}
                </button>
                {showBell && <NotificationPanel list={notifications} markAll={() => setNotifications(notifications.map(n => ({ ...n, read:true })))} />}
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding:20 }}>
          {!pageExists ? <NotFound /> : !allowed ? <Forbidden /> : (pages[page] || <NotFound />)}
        </div>
      </main>

      <Toasts items={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}