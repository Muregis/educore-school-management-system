import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULTS, NAV, ROLE, NAV_EXTRAS } from "./lib/constants";
import { C, applyBrandColorTokens } from "./lib/theme";
import { genId } from "./lib/utils";
import { useLocalState } from "./hooks/useLocalState";
import { useCurrentTerm } from "./hooks/useCurrentTerm";
import Btn from "./components/Btn";
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
import AdminSettings from "./pages/AdminSettings";
import ReportsPage from "./pages/ReportsPage";
import ExpendituresPage from "./pages/ExpendituresPage";
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
import AnnouncementsPage from "./pages/AnnouncementsPage";
import PortalDashboardPage from "./pages/PortalDashboardPage";
import SubjectsPage from "./pages/SubjectsPage";
import MpesaReconciliationPage from "./pages/MpesaReconciliationPage";
import BulkImportPage from "./pages/BulkImportPage";
import ExamsPage from "./pages/ExamsPage";
import FinancialReportsPage from "./pages/FinancialReportsPage";
import QRVerificationPage from "./pages/QRVerificationPage";
import UpdateRequestsPage from "./pages/UpdateRequestsPage";
import TrialBalancePage from "./pages/TrialBalancePage";
import IncomeStatementPage from "./pages/IncomeStatementPage";
import ChartOfAccountsPage from "./pages/ChartOfAccountsPage";
import JournalEntriesPage from "./pages/JournalEntriesPage";
import GeneralLedgerPage from "./pages/GeneralLedgerPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import OfflineStatusBar from "./components/OfflineStatusBar"; // NEW: Offline/sync status indicator
import ParentGuard from "./components/ParentGuard"; // NEW: Parent-student binding enforcement
import { Toasts, Forbidden, NotFound } from "./components/Helpers";
import SidebarModern from "./components/SidebarModern";
import BranchSelector from "./components/BranchSelector";
import Topbar from "./components/Topbar";
import { API_BASE, apiFetch } from "./lib/api";
import { TermManagementPage } from "./components/enhanced_frontend_components";
import AcademicTransitionPage from "./pages/AcademicTransitionPage";
import { clearSession, getSession, logout, saveSession } from "./lib/auth";

// Mobile portal imports
import ParentPortalMobile from "./pages/ParentPortalMobile";
import StudentPortalMobile from "./pages/StudentPortalMobile";

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
  ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }
  @media (max-width: 767px) {
    .ec-page-content { padding-bottom: 80px !important; }
    .ec-topbar { padding: 0 16px !important; }
    table { font-size: 12px !important; }
    table td, table th { padding: 6px 8px !important; }
  }
  .ec-bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: var(--color-bg-surface); border-top: 1px solid var(--color-border);
    display: flex; align-items: stretch;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
  }
  .ec-bottom-nav-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 8px 4px 6px; gap: 3px;
    background: none; border: none; cursor: pointer;
    color: var(--color-text-muted); font-size: 10px; font-weight: 600;
    letter-spacing: 0.03em; transition: color 0.15s; min-height: 56px;
  }
  .ec-bottom-nav-item.active { color: var(--color-primary); }
  .ec-bottom-nav-item .icon { font-size: 20px; line-height: 1; }
  .ec-drawer-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 60; backdrop-filter: blur(2px);
  }
  .ec-drawer {
    position: fixed; top: 0; left: 0; bottom: 0; width: 280px; z-index: 70;
    background: var(--color-bg-surface); border-right: 1px solid var(--color-border);
    display: flex; flex-direction: column;
    transform: translateX(-100%); transition: transform 0.25s ease; overflow: hidden;
  }
  .ec-drawer.open { transform: translateX(0); }
`;

const ROLE_COLORS  = { admin:"#3B82F6", teacher:"#14B8A6", finance:"#F59E0B", hr:"#A855F7", librarian:"#22C55E", parent:"#F43F5E", student:"#38BDF8" };
const ROLE_AVATARS = { admin:"🛡️", teacher:"👩‍🏫", finance:"💳", hr:"🧑‍💼", librarian:"📚", parent:"👪", student:"🎒" };
const BOTTOM_NAV_PAGES = {
  director:  ["dashboard","students","staff","attendance","fees"],
  superadmin:["dashboard","students","staff","attendance","fees"],
  admin:     ["dashboard","students","grades","fees","reports"],
  teacher:   ["dashboard","grades","attendance","timetable"],
  finance:   ["dashboard","fees","expenditures","invoices"],
  hr:        ["dashboard","hr","staff","expenditures"],
  librarian: ["dashboard","library"],
  parent:    ["dashboard","grades","fees","attendance","communication"],
  student:   ["dashboard","grades","attendance","timetable","library"],
};

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
  "educore.timetable",
  "educore.pendingUpdates",
];

function clearTenantLocalState() {
  TENANT_STATE_KEYS.forEach((key) => localStorage.removeItem(key));
  clearSession();
}
export default function App() {
  // Check if this is a QR verification URL
  const urlPath = window.location.pathname;
  const verifyMatch = urlPath.match(/^\/verify\/(.+)$/);
  const isQRVerification = !!verifyMatch;
  const studentId = verifyMatch ? verifyMatch[1] : null;

  const [school, setSchool]               = useLocalState("educore.school",        DEFAULTS.school);
  const [users, setUsers]                 = useLocalState("educore.users",          DEFAULTS.users);
  const [students, setStudents]           = useLocalState("educore.students",       DEFAULTS.students);
  const [teachers, setTeachers]           = useLocalState("educore.teachers",       DEFAULTS.teachers);
  const [attendance, setAttendance]       = useLocalState("educore.attendance",     DEFAULTS.attendance);
  const [results, setResults]             = useLocalState("educore.results",        DEFAULTS.results);
  const [feeStructures, setFeeStructures] = useLocalState("educore.feeStructures",  DEFAULTS.feeStructures);
  const [payments, setPayments]           = useLocalState("educore.payments",       DEFAULTS.payments);
  const [notifications, setNotifications] = useLocalState("educore.notifications",  DEFAULTS.notifications);
  const [timetable, setTimetable]         = useLocalState("educore.timetable",      DEFAULTS.timetable);
  const [pendingUpdates, setPendingUpdates] = useLocalState("educore.pendingUpdates", DEFAULTS.pendingUpdates);
  const [fetchOnMount] = useState(() => Date.now());

  const [auth, setAuth] = useState(() => {
    const session = getSession();
    return session?.user ? { ...session.user, token: session.token, sessionId: session.sessionId } : null;
  });

  const [page, setPage]                   = useState("dashboard");
  const [showBell, setShowBell]           = useState(false);
  const [toasts, setToasts]               = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [rolePermissions, setRolePermissions] = useState(null);
  const [activeSchoolId, setActiveSchoolId] = useState(() => {
    try {
      return localStorage.getItem("educore.activeSchool") || getSession()?.user?.schoolId || null;
    } catch {
      return getSession()?.user?.schoolId || null;
    }
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    const id = "ec-responsive";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id; el.textContent = RESPONSIVE_CSS;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    if (school?.primary_color) {
      applyBrandColorTokens(school.primary_color, document.documentElement);
    }
  }, [school?.primary_color]);

  useEffect(() => { setDrawerOpen(false); }, [page]);

  const toast = useCallback((text, type = "success", category = "general") => {
    const id = genId();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    if (auth && ["admin","teacher","finance"].includes(auth.role)) {
      setNotifications(prev => [{ 
        id: genId(), 
        message: text, 
        read: false, 
        time: new Date().toLocaleString(),
        category: category
      }, ...prev].slice(0, 80));
    }
  }, [auth, setNotifications]);

  const loadRolePermissions = useCallback(async (token) => {
    if (!token) {
      setRolePermissions(null);
      return;
    }
    try {
      const res = await apiFetch("/settings/permissions", { token });
      setRolePermissions(res.permissions || {});
    } catch (err) {
      console.error("[permissions] Failed to load role permissions:", err.message || err);
      setRolePermissions({});
    }
  }, []);

  useEffect(() => {
    if (auth?.token) {
      loadRolePermissions(auth.token);
    } else {
      setRolePermissions(null);
    }
  }, [auth?.token, loadRolePermissions]);

  // Merge backend permissions with ROLE defaults so newly added pages are always available
  const perms = useMemo(() => {
    if (!auth) return null;
    const rolePages = ROLE[auth.role]?.pages || [];
    const backend = rolePermissions?.[auth.role];
    const backendPages = backend?.pages || [];
    const mergedPages = [...new Set([...backendPages, ...rolePages])];
    return {
      edit: backend?.edit ?? ROLE[auth.role]?.edit,
      pages: mergedPages,
    };
  }, [auth, rolePermissions]);
  const isPortal = auth?.role === "parent" || auth?.role === "student";
  const isParent = auth?.role === "parent";
  const canEdit  = Boolean(perms?.edit);
  const canViewTotals = ["finance", "director", "superadmin", "admin"].includes(auth?.role);
  const canDeletePayments = ["director", "superadmin"].includes(auth?.role); // Only director/superadmin can delete payments

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

  // STRICT: For portal users, only show data if linkedStudentId is valid
  const validLinkedId = linkedStudentId && Number(linkedStudentId) > 0 ? Number(linkedStudentId) : null;
  
  const myStudents   = isPortal 
    ? (validLinkedId ? students.filter(s => Number(s.id ?? s.student_id) === validLinkedId) : []) 
    : students;
  const myAttendance = isPortal 
    ? (validLinkedId ? attendance.filter(a => Number(a.studentId ?? a.student_id) === validLinkedId) : []) 
    : attendance;
  const myResults    = isPortal 
    ? (validLinkedId ? results.filter(r => Number(r.studentId ?? r.student_id) === validLinkedId) : []) 
    : results;
  const myPayments   = isPortal 
    ? (validLinkedId ? payments.filter(p => Number(p.studentId ?? p.student_id) === validLinkedId) : []) 
    : payments;

  const fullNav = useMemo(() => {
    const existing = new Set(NAV.map(n => n.id));
    return [...NAV, ...NAV_EXTRAS.filter(n => !existing.has(n.id))];
  }, []);

  const nav = useMemo(() => {
    if (!perms) return [];
    return fullNav.filter(n => perms.pages.includes(n.id));
  }, [perms, fullNav]);
  useEffect(() => { if (perms && !perms.pages.includes(page)) setPage(perms.pages[0]); }, [perms, page]);

  const resetClientData = useCallback(() => {
    setSchool(DEFAULTS.school); setUsers(DEFAULTS.users); setStudents(DEFAULTS.students);
    setTeachers(DEFAULTS.teachers); setAttendance(DEFAULTS.attendance); setResults(DEFAULTS.results);
    setFeeStructures(DEFAULTS.feeStructures); setPayments(DEFAULTS.payments); setNotifications(DEFAULTS.notifications);
    setTimetable(DEFAULTS.timetable); setPendingUpdates(DEFAULTS.pendingUpdates);
  }, [setSchool, setUsers, setStudents, setTeachers, setAttendance, setResults, setFeeStructures, setPayments, setNotifications, setTimetable, setPendingUpdates]);

  const { term: currentTerm } = useCurrentTerm(auth);

  const hydrateTenantData = useCallback(async (loggedInAuth) => {
    if (!loggedInAuth?.token) return;
    const token = loggedInAuth.token;
    const termParam = currentTerm ? `?term=${encodeURIComponent(currentTerm)}` : '';
    const [schoolRes, studentsRes, teachersRes, attendanceRes, gradesRes, paymentsRes, feeRes, timetableRes] = await Promise.allSettled([
      apiFetch("/settings/school", { token }),
      apiFetch("/students", { token }),
      apiFetch("/teachers", { token }),
      apiFetch("/attendance", { token }),
      apiFetch("/grades", { token }),
      apiFetch(`/payments${termParam}`, { token }),
      apiFetch(`/payments/fee-structures${termParam}`, { token }),
      apiFetch("/timetable", { token }),
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
    setTimetable(timetableRes.status === "fulfilled" ? (timetableRes.value || []) : []);
  }, [setSchool, setStudents, setTeachers, setAttendance, setResults, setPayments, setFeeStructures, setTimetable, currentTerm]);

  useEffect(() => {
    const ping = () => fetch(`${API_BASE}/health`).catch(() => {});
    ping();
    const interval = setInterval(ping, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!auth?.token) return;
    hydrateTenantData(auth).catch((err) => {
      console.error("[tenant_hydrate] Failed to refresh tenant data:", err.message);
    });
  }, [auth?.token, auth?.schoolId, activeSchoolId, hydrateTenantData, fetchOnMount]);

  const handleSchoolSwitch = useCallback(async (schoolId, selectedSchool) => {
    const nextSchoolId = Number(schoolId);
    if (!nextSchoolId || !auth?.token) return;

    localStorage.setItem("educore.activeSchool", String(nextSchoolId));
    setActiveSchoolId(String(nextSchoolId));

    const nextAuth = {
      ...auth,
      schoolId: nextSchoolId,
      school_id: nextSchoolId,
    };
    saveSession({ token: auth.token, sessionId: auth.sessionId, user: nextAuth });
    setAuth(nextAuth);

    if (selectedSchool) {
      setSchool(prev => ({ ...prev, ...selectedSchool, school_id: nextSchoolId }));
    }

    await hydrateTenantData(nextAuth);
    toast(`Switched to ${selectedSchool?.name || "selected school"}`, "success");
  }, [auth, hydrateTenantData, setSchool, toast]);

  const handleLogout = useCallback(() => {
    logout();
    clearTenantLocalState();
    resetClientData();
    setAuth(null);
    setActiveChildId(null);
    setPage("dashboard");
  }, [resetClientData]);

  const handleLogin = useCallback(async (u) => {
    clearTenantLocalState();
    resetClientData();

    saveSession({ token: u.token, sessionId: u.sessionId, user: u });

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

  useEffect(() => {
    if (!auth) return undefined;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, 10 * 60 * 1000);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach(eventName => window.addEventListener(eventName, resetTimer, { passive: true }));

    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach(eventName => window.removeEventListener(eventName, resetTimer));
    };
  }, [auth]);

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

  if (isQRVerification) {
    return (
      <div className="school-theme-primary" style={{ minHeight:"100vh", display:"flex", background:C.bg, color:C.text, fontFamily:"var(--font-body)" }}>
        <QRVerificationPage studentId={studentId} />
        <Toasts items={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      </div>
    );
  }

  if (!auth) return (
    <LoginView onLogin={handleLogin} />
  );

  const pageExists = fullNav.some(n => n.id === page);
  const allowed    = perms?.pages.includes(page);
  const roleColor  = ROLE_COLORS[auth.role] || C.accent;
  const sideW      = sideCollapsed ? 64 : 240;

  const pages = {
    "term-management": <TermManagementPage auth={auth} />,
    "academic-transition": <AcademicTransitionPage auth={auth} />,
    dashboard: isPortal && isMobile
      ? (auth.role === "parent"
          ? <ParentGuard auth={auth} requiredPermission="view" redirectTo="/login">
              <ParentPortalMobile auth={auth} school={school} students={students} attendance={attendance} results={results} payments={payments} feeStructures={feeStructures} onNavigate={setPage} onLogout={handleLogout} />
            </ParentGuard>
          : <StudentPortalMobile auth={auth} school={school} student={activeChild} attendance={myAttendance} results={myResults} library={[]} timetable={timetable} onNavigate={setPage} onLogout={handleLogout} />
        )
      : (isPortal
          ? <ParentGuard auth={auth} requiredPermission="view" redirectTo="/login">
              <PortalDashboardPage auth={auth} school={school} student={activeChild} attendance={myAttendance} results={myResults} payments={myPayments} feeStructures={feeStructures} toast={toast} onViewGrades={() => setPage("grades")} onViewFees={() => setPage("fees")} onViewAttendance={() => setPage("attendance")} />
            </ParentGuard>
          : <DashboardPage auth={auth} school={school} students={myStudents} teachers={teachers} attendance={myAttendance} payments={myPayments} feeStructures={feeStructures} results={myResults} toast={toast} />
        ),
    students: <StudentsPage auth={auth} students={students} setStudents={setStudents} canEdit={canEdit} results={results} payments={payments} feeStructures={feeStructures} toast={toast} />,
    staff: ["admin","hr","director","superadmin"].includes(auth.role) ? <StaffPage auth={auth} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    teachers: ["director","superadmin"].includes(auth.role) ? <TeachersPage auth={auth} teachers={teachers} setTeachers={setTeachers} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    attendance: isPortal && isMobile ? (() => { setPage("dashboard"); return null; })() : <AttendancePage auth={auth} students={myStudents} attendance={myAttendance} setAttendance={setAttendance} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} feeBlocked={isParent && (auth?.feeBlocked ?? false)} onGoFees={() => setPage("fees")} />,
    grades: isPortal && isMobile ? (() => { setPage("dashboard"); return null; })() : <GradesPage auth={auth} students={myStudents} results={myResults} setResults={setResults} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} feeBlocked={isParent && (auth?.feeBlocked ?? false)} onGoFees={() => setPage("fees")} />,
    subjects: ["admin","teacher","director","superadmin"].includes(auth.role) ? <SubjectsPage auth={auth} toast={toast} canEdit={canEdit} /> : <Forbidden />,
    fees: isPortal && isMobile ? (() => { setPage("dashboard"); return null; })() : <FeesPage auth={auth} school={school} students={myStudents} feeStructures={feeStructures} setFeeStructures={setFeeStructures} payments={myPayments} setPayments={setPayments} canEdit={canEdit} canViewTotals={canViewTotals} canDeletePayments={canDeletePayments} toast={toast} linkedStudentId={linkedStudentId} />,
    expenditures: ["admin","finance","hr","director","superadmin"].includes(auth.role) ? <ExpendituresPage auth={auth} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    "mpesa-reconcile": <MpesaReconciliationPage auth={auth} students={students} toast={toast} />,
    "bulk-import": ["admin","director","superadmin"].includes(auth.role) ? <BulkImportPage auth={auth} students={students} setStudents={setStudents} toast={toast} payments={payments} feeStructures={feeStructures} results={results} /> : <Forbidden />,
    exams: <ExamsPage auth={auth} students={students} subjects={[]} toast={toast} />,
    admissions: <AdmissionsPage auth={auth} canEdit={canEdit} toast={toast} />,
    invoices: <InvoicesPage auth={auth} school={school} students={students} canEdit={canEdit} toast={toast} />,
    reportcards: <ReportCardsPage auth={auth} school={school} students={myStudents} results={results} canEdit={canEdit} toast={toast} feeBlocked={isParent && (auth?.feeBlocked ?? false)} onGoFees={() => setPage("fees")} />,
    hr: ["admin","hr","director","superadmin"].includes(auth.role) ? <HRPage auth={auth} school={school} canEdit={canEdit} toast={toast} /> : <Forbidden />,
    library: isPortal && isMobile && auth.role === "student" ? (() => { setPage("dashboard"); return null; })() : <LibraryPage auth={auth} students={myStudents} teachers={teachers} toast={toast} />,
    discipline: <DisciplinePage auth={auth} students={myStudents} canEdit={canEdit} toast={toast} linkedStudentId={linkedStudentId} />,
    transport: <TransportPage auth={auth} canEdit={canEdit} toast={toast} students={students} />,
    communication: isPortal && isMobile ? (() => { setPage("dashboard"); return null; })() : <CommunicationPage auth={auth} canEdit={canEdit} toast={toast} />,
    timetable: isPortal && isMobile ? (() => { setPage("dashboard"); return null; })() : <TimetablePage auth={auth} teachers={teachers} canEdit={canEdit} toast={toast} />,
    accounts: ["admin","director","superadmin"].includes(auth.role) ? <AccountsPage auth={auth} students={students} toast={toast} /> : <Forbidden />,
    lessonplans: ["admin","teacher","director","superadmin"].includes(auth.role) ? <LessonPlansPage auth={auth} toast={toast} /> : <Forbidden />,
    announcements: perms?.pages.includes("announcements") ? <AnnouncementsPage auth={auth} toast={toast} /> : <Forbidden />,
    analytics: ["director","superadmin"].includes(auth.role) ? <AnalyticsPage auth={auth} students={students} teachers={teachers} payments={payments} results={results} attendance={attendance} feeStructures={feeStructures} toast={toast} /> : <Forbidden />,
    reports: ["finance","director","superadmin"].includes(auth.role) ? <ReportsPage auth={auth} toast={toast} /> : <Forbidden />,
    "financial-reports": ["finance","director","superadmin"].includes(auth.role) ? <FinancialReportsPage auth={auth} toast={toast} /> : <Forbidden />,
    analysis: ["admin","teacher","director","superadmin"].includes(auth.role) ? <AnalysisPage auth={auth} toast={toast} /> : <Forbidden />,
    "update-requests": ["admin","parent"].includes(auth.role) ? <UpdateRequestsPage auth={auth} students={students} pendingUpdates={pendingUpdates} setPendingUpdates={setPendingUpdates} toast={toast} /> : <Forbidden />,
    "trial-balance": ["admin","finance","director","superadmin"].includes(auth.role) ? <TrialBalancePage auth={auth} toast={toast} /> : <Forbidden />,
    "income-statement": ["admin","finance","director","superadmin"].includes(auth.role) ? <IncomeStatementPage auth={auth} toast={toast} /> : <Forbidden />,
    "chart-of-accounts": ["admin","finance","director","superadmin"].includes(auth.role) ? <ChartOfAccountsPage auth={auth} toast={toast} /> : <Forbidden />,
    "journal-entries": ["admin","finance","director","superadmin"].includes(auth.role) ? <JournalEntriesPage auth={auth} toast={toast} /> : <Forbidden />,
    "general-ledger": ["admin","finance","director","superadmin"].includes(auth.role) ? <GeneralLedgerPage auth={auth} toast={toast} /> : <Forbidden />,
    "balance-sheet": ["admin","finance","director","superadmin"].includes(auth.role) ? <BalanceSheetPage auth={auth} toast={toast} /> : <Forbidden />,
    settings: ["director","superadmin"].includes(auth.role)
      ? <AdminSettings
          auth={auth}
          onPermissionsSaved={() => loadRolePermissions(auth.token)}
          onSchoolSaved={(savedSchool) => setSchool({ ...school, ...savedSchool })}
        />
      : <Forbidden />,
  };

  const currentNav = nav.find(n => n.id === page);
  const bottomNavIds = [...new Set(BOTTOM_NAV_PAGES[auth.role] || ["dashboard"])].slice(0, 5);
  const bottomNavItems = bottomNavIds.map(id => nav.find(n => n.id === id)).filter(Boolean);


  const SidebarContent = ({ collapsed }) => (
    <SidebarModern
      auth={auth}
      school={school}
      page={page}
      setPage={setPage}
      collapsed={collapsed}
      setSideCollapsed={setSideCollapsed}
      isMobile={isMobile}
      setDrawerOpen={setDrawerOpen}
      myChildren={myChildren}
      activeChild={activeChild}
      linkedStudentId={linkedStudentId}
      setActiveChildId={setActiveChildId}
      handleLogout={handleLogout}
      allowedPages={perms?.pages || []}
    />
  );

  return (
    <div className="school-theme-primary" style={{ minHeight:"100vh", display:"flex", background:C.bg, color:C.text, fontFamily:"var(--font-body)" }}>

      {/* QR Verification Page - Public Access */}
      {isQRVerification ? (
        <QRVerificationPage studentId={studentId} />
      ) : !auth ? (
        <LoginView
          onLogin={handleLogin}
          school={school}
          setSchool={setSchool}
          toast={toast}
        />
      ) : (
        <>
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
        <Topbar
          auth={auth}
          school={school}
          currentNav={currentNav}
          page={page}
          isPortal={isPortal}
          isParent={isParent}
          activeChild={activeChild}
          isMobile={isMobile}
          notifications={notifications}
          showBell={showBell}
          setShowBell={setShowBell}
          setDrawerOpen={setDrawerOpen}
          onLogout={handleLogout}
          activeSchoolId={activeSchoolId}
          onSchoolSwitch={handleSchoolSwitch}
        />

        <div className="ec-page-content" style={{ padding: isMobile ? "var(--space-4)" : "var(--space-5)" }}>
          {!pageExists ? <NotFound /> : !allowed ? <Forbidden /> : (pages[page] || <NotFound />)}
        </div>
      </main>

      {isMobile && (
        <nav className="ec-bottom-nav">
          {bottomNavItems.map(n => (
            <button key={n.id} className={`ec-bottom-nav-item ${page === n.id ? "active" : ""} touch-target`} onClick={() => setPage(n.id)}>
              <span className="icon">{n.icon}</span>
              <span>{n.label.length > 8 ? n.label.slice(0,7)+"…" : n.label}</span>
            </button>
          ))}
          <button className="ec-bottom-nav-item touch-target" onClick={() => setDrawerOpen(true)}>
            <span className="icon">⋯</span>
            <span>More</span>
          </button>
        </nav>
      )}
        </>
      )}

      <Toasts items={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
