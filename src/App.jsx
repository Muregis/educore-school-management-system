import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULTS, NAV, ROLE } from "./lib/constants";
import { C } from "./lib/theme";
import { genId } from "./lib/utils";
import { PLAN_FEATURES } from "./lib/plans";
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
import AnalyticsPage from "./pages/AnalyticsPage";
import AnalysisPage from "./pages/AnalysisPage";
import TimetablePage from "./pages/TimetablePage";
import AdmissionsPage from "./pages/AdmissionsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ReportCardsPage from "./pages/ReportCardsPage";
import HRPage from "./pages/HRPage";
import LibraryPage from "./pages/LibraryPage";
import StaffPage from "./pages/StaffPage";
import LessonPlansPage from "./pages/LessonPlansPage";
import PendingPlansPage from "./pages/PendingPlansPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import PortalDashboardPage from "./pages/PortalDashboardPage";
import SubjectsPage from "./pages/SubjectsPage";
import MpesaReconciliationPage from "./pages/MpesaReconciliationPage";
import BulkImportPage from "./pages/BulkImportPage";
import ExamsPage from "./pages/ExamsPage";
import MedicalRecordsPage from "./pages/MedicalRecordsPage";
import { Toasts, Forbidden, NotFound } from "./components/Helpers";
import { apiFetch } from "./lib/api";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

const RESPONSIVE_CSS = `
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1A2A42; border-radius: 10px; }
  @media (max-width: 767px) {
    .ec-page-content { padding-bottom: 80px !important; }
    .ec-topbar { padding: 0 16px !important; }
    table { font-size: 12px !important; }
    table td, table th { padding: 6px 8px !important; }
  }
  .ec-bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: #0B1120; border-top: 1px solid #1A2A42;
    display: flex; align-items: stretch;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
  }
  .ec-bottom-nav-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 8px 4px 6px; gap: 3px;
    background: none; border: none; cursor: pointer;
    color: #3D5070; font-size: 10px; font-weight: 600;
    letter-spacing: 0.03em; transition: color 0.15s; min-height: 56px;
  }
  .ec-bottom-nav-item.active { color: #3B82F6; }
  .ec-bottom-nav-item .icon { font-size: 20px; line-height: 1; }
  .ec-drawer-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 60; backdrop-filter: blur(2px);
  }
  .ec-drawer {
    position: fixed; top: 0; left: 0; bottom: 0; width: 280px; z-index: 70;
    background: #0B1120; border-right: 1px solid #1A2A42;
    display: flex; flex-direction: column;
    transform: translateX(-100%); transition: transform 0.25s ease; overflow: hidden;
  }
  .ec-drawer.open { transform: translateX(0); }
`;

const ROLE_COLORS  = { admin:"#3B82F6", teacher:"#14B8A6", finance:"#F59E0B", hr:"#A855F7", librarian:"#22C55E", parent:"#F43F5E", student:"#38BDF8" };
const ROLE_AVATARS = { admin:"A", teacher:"T", finance:"F", hr:"H", librarian:"L", parent:"P", student:"S" };
const BOTTOM_NAV_PAGES = {
  admin:     ["dashboard","students","grades","fees","reports"],
  teacher:   ["dashboard","students","grades","attendance","timetable"],
  finance:   ["dashboard","fees","invoices"],
  hr:        ["dashboard","hr","staff"],
  librarian: ["dashboard","library"],
  parent:    ["dashboard","grades","fees","attendance","communication"],
  student:   ["dashboard","grades","attendance","timetable","library"],
};

const NAV_EXTRAS = [
  { id: "lessonplans",  label: "Lesson Plans",  icon: "📝" },
  { id: "pendingplans", label: "Pending Plans", icon: "⏳" },
];


const TENANT_STATE_KEYS = [
  "educore.school",
  "educore.users",
  "educore.students",
  "educore.teachers",
  "educore.attendance",
  "educore.results",
  "educore.feeStructures",
  "educore.payments",
  "educore.notifications",
];

function clearTenantLocalState() {
  TENANT_STATE_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.removeItem("educore.auth");
  sessionStorage.removeItem("token");
}
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
    // Check if this is a new browser session
    // sessionStorage is cleared when browser closes, so if sessionStart is missing, it's a new session
    const sessionStart = sessionStorage.getItem("educore.sessionStart");
    
    if (!sessionStart) {
      // New browser session - clear any leftover auth and require login
      sessionStorage.setItem("educore.sessionStart", Date.now().toString());
      sessionStorage.removeItem("educore.auth");
      sessionStorage.removeItem("token");
      return null;
    }
    
    // Existing session (page refresh) - restore auth from sessionStorage
    const raw = sessionStorage.getItem("educore.auth");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });

  const [page, setPage]                   = useState("dashboard");
  const [showBell, setShowBell]           = useState(false);
  const [toasts, setToasts]               = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const id = "ec-responsive";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = RESPONSIVE_CSS;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [page]);

  const toast = useCallback((text, type = "success") => {
    const id = genId();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    if (auth && ["admin","teacher","finance"].includes(auth.role)) {
      setNotifications(prev => [{ id: genId(), message: text, read: false, time: new Date().toLocaleString() }, ...prev].slice(0, 80));
    }
  }, [auth, setNotifications]);

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

  const planFeatures = PLAN_FEATURES[auth?.plan || "starter"];
  const fullNav = useMemo(() => {
    const existing = new Set(NAV.map(n => n.id));
    return [...NAV, ...NAV_EXTRAS.filter(n => !existing.has(n.id))];
  }, []);

  const nav = useMemo(() => {
    if (!perms) return [];
    return fullNav.filter(n => perms.pages.includes(n.id) && (!planFeatures.pages || planFeatures.pages.includes(n.id)));
  }, [perms, fullNav, planFeatures]);
  useEffect(() => { if (perms && !perms.pages.includes(page)) setPage(perms.pages[0]); }, [perms, page]);

  const resetClientData = useCallback(() => {
    setSchool(DEFAULTS.school); setUsers(DEFAULTS.users); setStudents(DEFAULTS.students);
    setTeachers(DEFAULTS.teachers); setAttendance(DEFAULTS.attendance); setResults(DEFAULTS.results);
    setFeeStructures(DEFAULTS.feeStructures); setPayments(DEFAULTS.payments); setNotifications(DEFAULTS.notifications);
  }, [setSchool, setUsers, setStudents, setTeachers, setAttendance, setResults, setFeeStructures, setPayments, setNotifications]);

  const hydrateTenantData = useCallback(async (loggedInAuth) => {
    if (!loggedInAuth?.token) return;
    const token = loggedInAuth.token;
    const [schoolRes, studentsRes, teachersRes, attendanceRes, gradesRes, paymentsRes, feeRes] = await Promise.allSettled([
      apiFetch("/settings/school", { token }),
      apiFetch("/students", { token }),
      apiFetch("/teachers", { token }),
      apiFetch("/attendance", { token }),
      apiFetch("/grades", { token }),
      apiFetch("/payments", { token }),
      apiFetch("/payments/fee-structures", { token }),
    ]);

    if (schoolRes.status === "fulfilled" && schoolRes.value) {
      setSchool({ ...DEFAULTS.school, ...schoolRes.value });
    } else {
      setSchool(DEFAULTS.school);
    }

    setStudents(studentsRes.status === "fulfilled" ? (studentsRes.value || []) : []);
    setTeachers(teachersRes.status === "fulfilled" ? (teachersRes.value || []) : []);
    setAttendance(attendanceRes.status === "fulfilled" ? (attendanceRes.value || []) : []);
    setResults(gradesRes.status === "fulfilled" ? (gradesRes.value || []) : []);
    setPayments(paymentsRes.status === "fulfilled" ? (paymentsRes.value || []) : []);
    setFeeStructures(feeRes.status === "fulfilled" ? (feeRes.value || []) : []);
  }, [setSchool, setStudents, setTeachers, setAttendance, setResults, setPayments, setFeeStructures]);

  const handleLogout = useCallback(() => {
    clearTenantLocalState();
    resetClientData();
    setAuth(null);
    setActiveChildId(null);
    setPage("dashboard");
  }, [resetClientData]);

  const handleLogin = useCallback(async (u) => {
    clearTenantLocalState();
    resetClientData();

    sessionStorage.setItem("educore.auth", JSON.stringify(u));
    if (u?.token) sessionStorage.setItem("token", u.token);

    setAuth(u);
    setActiveChildId(null);
    setPage("dashboard");
    toast(`Welcome, ${u.name}`, "success");

    try {
      await hydrateTenantData(u);
    } catch (err) {
      console.error("[tenant_hydrate] Failed to load fresh tenant data:", err.message);
    }
  }, [hydrateTenantData, resetClientData, toast]);

  const resetDemo = useCallback(async () => {
    if (!auth?.token || !auth?.schoolId) {
      toast("Missing school context. Please log in again.", "error");
      return;
    }

    try {
      const response = await apiFetch("/admin/reset-demo-data", {
        method: "POST",
        token: auth.token,
        body: { school_id: auth.schoolId },
      });

      resetClientData();
      await hydrateTenantData(auth);
      toast(`Demo data reset for school ${response.school_id}`, "success");
    } catch (err) {
      toast(err.message || "Failed to reset demo data", "error");
    }
  }, [auth, hydrateTenantData, resetClientData, toast]);

  if (!auth) return (
    <LoginView onLogin={handleLogin} />
  );

  const pageExists = fullNav.some(n => n.id === page);
  const allowed    = perms?.pages.includes(page);
  const roleColor  = ROLE_COLORS[auth.role] || C.accent;
  const sideW      = sideCollapsed ? 64 : 240;

  const pages = {
    dashboard: isPortal 
      ? <PortalDashboardPage auth={auth} school={school} student={activeChild} attendance={myAttendance} results={myResults} payments={myPayments} feeStructures={feeStructures} toast={toast} onViewGrades={() => setPage("grades")} onViewFees={() => setPage("fees")} onViewAttendance={() => setPage("attendance")} />
      : <DashboardPage auth={auth} school={school} students={myStudents} teachers={teachers} attendance={myAttendance} payments={myPayments} feeStructures={feeStructures} results={myResults} toast={toast} />,
    students: <StudentsPage auth={auth} students={students} setStudents={setStudents} canEdit={canEdit} results={results} payments={payments} feeStructures={feeStructures} toast={toast} />,
    staff: ["admin","hr"].includes(auth.role) ? <StaffPage auth={auth} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    attendance: <AttendancePage auth={auth} students={myStudents} attendance={myAttendance} setAttendance={setAttendance} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} feeBlocked={isParent && (auth?.feeBlocked ?? false)} onGoFees={() => setPage("fees")} />,
    grades: <GradesPage auth={auth} students={myStudents} results={myResults} setResults={setResults} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} feeBlocked={isParent && (auth?.feeBlocked ?? false)} onGoFees={() => setPage("fees")} />,
    subjects: <SubjectsPage auth={auth} toast={toast} />,
    fees: <FeesPage auth={auth} students={myStudents} feeStructures={feeStructures} setFeeStructures={setFeeStructures} payments={myPayments} setPayments={setPayments} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    "mpesa-reconcile": <MpesaReconciliationPage auth={auth} students={students} toast={toast} />,
    "bulk-import": <BulkImportPage auth={auth} students={students} setStudents={setStudents} toast={toast} payments={payments} feeStructures={feeStructures} />,
    exams: <ExamsPage auth={auth} students={students} subjects={[]} toast={toast} />,
    admissions: <AdmissionsPage auth={auth} canEdit={canEdit} toast={toast} />,
    invoices: <InvoicesPage auth={auth} school={school} students={students} canEdit={canEdit} toast={toast} />,
    reportcards: <ReportCardsPage auth={auth} school={school} students={myStudents} canEdit={canEdit} toast={toast} feeBlocked={isParent && (auth?.feeBlocked ?? false)} onGoFees={() => setPage("fees")} />,
    hr: ["admin","hr"].includes(auth.role) ? <HRPage auth={auth} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    library: <LibraryPage auth={auth} students={myStudents} teachers={teachers} toast={toast} />,
    discipline: <DisciplinePage auth={auth} students={myStudents} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    transport: <TransportPage auth={auth} canEdit={canEdit} toast={toast} students={students} />,
    communication: <CommunicationPage auth={auth} canEdit={canEdit} toast={toast} />,
    timetable: <TimetablePage auth={auth} teachers={teachers} canEdit={canEdit} toast={toast} />,
    accounts: auth.role === "admin" ? <AccountsPage auth={auth} students={students} toast={toast} /> : <Forbidden />,
    lessonplans: ["admin","teacher"].includes(auth.role) ? <LessonPlansPage auth={auth} toast={toast} /> : <Forbidden />,
    pendingplans: auth.role === "admin" ? <PendingPlansPage auth={auth} toast={toast} /> : <Forbidden />,
    announcements: perms?.pages.includes("announcements") ? <AnnouncementsPage auth={auth} toast={toast} /> : <Forbidden />,
    analytics: auth.role === "admin" ? <AnalyticsPage auth={auth} students={students} teachers={teachers} payments={payments} results={results} attendance={attendance} feeStructures={feeStructures} toast={toast} /> : <Forbidden />,
    reports: ["admin","teacher"].includes(auth.role) ? <ReportsPage auth={auth} toast={toast} /> : <Forbidden />,
    analysis: ["admin","teacher"].includes(auth.role) ? <AnalysisPage auth={auth} toast={toast} /> : <Forbidden />,
    medical: auth.role === "admin" ? <MedicalRecordsPage auth={auth} students={students} toast={toast} /> : <Forbidden />,
    settings: auth.role === "admin"
      ? <div><SettingsPage auth={auth} school={school} setSchool={setSchool} users={users} setUsers={setUsers} toast={toast} /><div style={{ marginTop:12 }}><Btn variant="danger" onClick={() => { if (window.confirm("Reset demo data?")) resetDemo(); }}>Reset Demo Data</Btn></div></div>
      : <Forbidden />,
  };

  const currentNav = nav.find(n => n.id === page);
  const bottomNavIds = [...new Set(BOTTOM_NAV_PAGES[auth.role] || ["dashboard"])].slice(0, 5);
  const bottomNavItems = bottomNavIds.map(id => nav.find(n => n.id === id)).filter(Boolean);


  const SidebarContent = ({ collapsed }) => (
    <>
      <div style={{ padding:"16px 12px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, minHeight:64 }}>
        {school.logo_url ? (
          <img src={school.logo_url} alt="Logo" style={{ width:36, height:36, borderRadius:10, objectFit:"cover", flexShrink:0 }} />
        ) : (
          <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:`linear-gradient(135deg, ${C.accent}, #6366f1)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:16, color:"#fff", letterSpacing:-1 }}>E</div>
        )}
        {!collapsed && (
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.text, lineHeight:1.1 }}>EduCore</div>
            <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>{school.name}</div>
          </div>
        )}
        {isMobile ? (
          <button onClick={() => setDrawerOpen(false)} style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${C.border}`, borderRadius:7, color:C.textMuted, cursor:"pointer", padding:"3px 8px", fontSize:14 }}>✕</button>
        ) : (
          <button onClick={() => setSideCollapsed(v => !v)} style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${C.border}`, borderRadius:7, color:C.textMuted, cursor:"pointer", padding:"3px 7px", fontSize:12, flexShrink:0 }}>{collapsed ? "▶" : "◀"}</button>
        )}
      </div>

      {!collapsed && isParent && myChildren.length > 0 && (
        <div style={{ padding:"8px 12px", borderBottom:`1px solid ${C.border}`, background:C.bg }}>
          <div style={{ fontSize:10, color:C.textMuted, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>Viewing child</div>
          {myChildren.length === 1 ? (
            <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>{activeChild?.firstName} {activeChild?.lastName}</div>
          ) : (
            <select style={{ width:"100%", background:C.card, color:C.text, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 8px", fontSize:13 }}
              value={linkedStudentId || ""} onChange={e => { setActiveChildId(Number(e.target.value)); setPage("dashboard"); if (isMobile) setDrawerOpen(false); }}>
              {myChildren.map(s => {
                const sid  = s.id ?? s.student_id;
                const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                return <option key={sid} value={sid}>{name}</option>;
              })}
            </select>
          )}
        </div>
      )}

      <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px", minHeight:0 }}>
        {nav.map(n => {
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => { setPage(n.id); if (isMobile) setDrawerOpen(false); }} title={collapsed ? n.label : ""} style={{
              width:"100%", textAlign:"left", marginBottom:3,
              border:`1px solid ${active ? C.accentDim : "transparent"}`,
              borderRadius:9, padding: collapsed ? "9px 0" : "9px 11px",
              background: active ? C.accentGlow : "transparent",
              color: active ? C.accent : C.textSub,
              cursor:"pointer", fontSize:13, display:"flex", alignItems:"center",
              gap:9, justifyContent: collapsed ? "center" : "flex-start",
              transition:"background 0.15s, color 0.15s",
            }}>
              <span style={{ fontSize:15, flexShrink:0 }}>{n.icon}</span>
              {!collapsed && <span>{n.label}</span>}
              {!collapsed && active && <span style={{ marginLeft:"auto", width:5, height:5, borderRadius:"50%", background:C.accent, flexShrink:0 }} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding:"10px 8px", borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
        {!collapsed ? (
          <div style={{ background:C.card, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`, marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:`${roleColor}22`, border:`1px solid ${roleColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:roleColor, flexShrink:0 }}>{ROLE_AVATARS[auth.role] || "?"}</div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{auth.name}</div>
                <div style={{ fontSize:10, color:roleColor, textTransform:"capitalize", fontWeight:600 }}>{auth.role}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`${roleColor}22`, border:`1px solid ${roleColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:roleColor }}>{ROLE_AVATARS[auth.role] || "?"}</div>
          </div>
        )}
        <button onClick={handleLogout} style={{
          width:"100%", padding: collapsed ? "7px 0" : "7px 12px", borderRadius:8,
          background:"transparent", border:`1px solid ${C.border}`,
          color:C.textSub, cursor:"pointer", fontSize:12,
          display:"flex", alignItems:"center", justifyContent: collapsed ? "center" : "flex-start", gap:7,
        }} title="Logout">
          <span>⇐</span>{!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div style={{ minHeight:"100vh", display:"flex", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

      {!isMobile && (
        <aside style={{ width:sideW, height:"100vh", background:C.surface, borderRight:`1px solid ${C.border}`, position:"fixed", top:0, left:0, display:"flex", flexDirection:"column", zIndex:50, transition:"width 0.2s ease", overflow:"hidden" }}>
          <SidebarContent collapsed={sideCollapsed} />
        </aside>
      )}

      {isMobile && drawerOpen && (
        <>
          <div className="ec-drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className={`ec-drawer ${drawerOpen ? "open" : ""}`}>
            <SidebarContent collapsed={false} />
          </div>
        </>
      )}

      <main style={{ marginLeft: isMobile ? 0 : sideW, flex:1, transition:"margin-left 0.2s ease", minWidth:0 }}>
        <div className="ec-topbar" style={{ height:62, background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 20px", position:"sticky", top:0, zIndex:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {isMobile && (
              <button onClick={() => setDrawerOpen(true)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.textMuted, cursor:"pointer", padding:"6px 10px", fontSize:16 }}>☰</button>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {school.logo_url && !isMobile && (
                <img src={school.logo_url} alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
              )}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:16 }}>{currentNav?.icon}</span>
                  <span style={{ fontWeight:800, fontSize: isMobile ? 15 : 18, color:C.text }}>{currentNav?.label || page}</span>
                </div>
                {!isMobile && (
                  <div style={{ color:C.textMuted, fontSize:11, marginTop:1 }}>
                    {isPortal
                      ? `${isParent ? "Parent" : "Student"} · ${activeChild ? `${activeChild.firstName ?? activeChild.first_name} ${activeChild.lastName ?? activeChild.last_name}` : auth.name}`
                      : school.name + " · " + school.term + " " + school.year}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {!isMobile && (
              <div style={{ background:`${roleColor}18`, border:`1px solid ${roleColor}44`, borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:700, color:roleColor, textTransform:"capitalize" }}>{auth.role}</div>
            )}
            {["admin","teacher","finance"].includes(auth.role) && (
              <div style={{ position:"relative" }}>
                <button onClick={() => setShowBell(!showBell)} style={{ border:`1px solid ${C.border}`, borderRadius:9, background:C.card, color:C.textSub, cursor:"pointer", padding:"7px 11px", fontSize:13, position:"relative" }}>
                  🔔
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span style={{ position:"absolute", top:4, right:5, width:8, height:8, borderRadius:"50%", background:C.rose, border:`2px solid ${C.surface}` }} />
                  )}
                </button>
                {showBell && <NotificationPanel list={notifications} markAll={() => setNotifications(notifications.map(n => ({ ...n, read:true })))} />}
              </div>
            )}
            {isMobile && (
              <button onClick={handleLogout} style={{ width:34, height:34, borderRadius:8, background:`${roleColor}22`, border:`1px solid ${roleColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:roleColor, cursor:"pointer" }} title="Logout">
                {ROLE_AVATARS[auth.role] || "?"}
              </button>
            )}
          </div>
        </div>

        <div className="ec-page-content" style={{ padding: isMobile ? 14 : 20 }}>
          {!pageExists ? <NotFound /> : !allowed ? <Forbidden /> : (pages[page] || <NotFound />)}
        </div>
      </main>

      {isMobile && (
        <nav className="ec-bottom-nav">
          {bottomNavItems.map(n => (
            <button key={n.id} className={`ec-bottom-nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
              <span className="icon">{n.icon}</span>
              <span>{n.label.length > 8 ? n.label.slice(0,7)+"…" : n.label}</span>
            </button>
          ))}
          <button className="ec-bottom-nav-item" onClick={() => setDrawerOpen(true)}>
            <span className="icon">⋯</span>
            <span>More</span>
          </button>
        </nav>
      )}

      <Toasts items={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
