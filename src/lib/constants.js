export const ALL_CLASSES = ["Playgroup","PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
export const SUBJECTS   = ["Mathematics","English","Kiswahili","Computer Science","Biology","Physics","Chemistry","History","Geography","CRE"];

export const DEFAULTS = {
  school: { name:"", term:"", year:"", email:"", phone:"", address:"", county:"", whatsapp_business_number:"", logo:"" },
  users: [],
  students: [],
  teachers: [],
  attendance:[], results:[], payments:[], smsLogs:[], notifications:[],
  feeStructures: [],
  timetable: [],
  pendingUpdates: [],
};

export const ROLE = {
  // Director - HIGHEST ROLE - Full control over all schools, can delegate permissions
  director:  { pages:["dashboard","students","teachers","staff","attendance","grades","subjects","fees","expenditures","mpesa-reconcile","admissions","invoices","reportcards","discipline","transport","communication","timetable","reports","financial-reports","analytics","analysis","accounts","hr","library","lessonplans","settings","announcements","bulk-import","exams","update-requests","trial-balance","income-statement","chart-of-accounts","journal-entries","general-ledger","balance-sheet","term-management"], edit:true, canDelegate:true },
  // Superadmin - System-level full access
  superadmin:{ pages:["dashboard","students","teachers","staff","attendance","grades","subjects","fees","expenditures","mpesa-reconcile","admissions","invoices","reportcards","discipline","transport","communication","timetable","reports","financial-reports","analytics","accounts","hr","library","lessonplans","settings","announcements","bulk-import","exams","update-requests","trial-balance","income-statement","chart-of-accounts","journal-entries","general-ledger","balance-sheet","term-management"], edit:true },
  // Admin - School administrator with full school-level access
  admin:     { pages:["dashboard","students","subjects","attendance","grades","fees","expenditures","invoices","reportcards","discipline","transport","communication","timetable","library","lessonplans","announcements","exams","admissions","trial-balance","income-statement","chart-of-accounts","journal-entries","general-ledger","balance-sheet","term-management"], edit:true },
  // Teacher - Classroom operations
  teacher:   { pages:["dashboard","subjects","attendance","grades","reportcards","discipline","timetable","communication","library","analysis","lessonplans","announcements","exams"], edit:true },
  // Finance - Fee operations
  finance:   { pages:["dashboard","fees","expenditures","mpesa-reconcile","invoices","announcements","reports","financial-reports","trial-balance","income-statement","chart-of-accounts","journal-entries","general-ledger","balance-sheet"], edit:true },
  // HR - Staff management
  hr:        { pages:["dashboard","hr","staff","expenditures","announcements"], edit:true },
  // Librarian - Library management
  librarian: { pages:["dashboard","library","announcements"], edit:true },
  // Parent - View child data (minimal essential pages only)
  parent:    { pages:["dashboard","grades","fees","attendance","communication","announcements"], edit:false },
  // Student - View own data
  student:   { pages:["dashboard","grades","attendance","reportcards","library","announcements"], edit:false },
};

export const NAV = [
  { id:"dashboard",       label:"Dashboard",      icon:"\u{1F4CA}" },
  { id:"students",        label:"Students",       icon:"\u{1F465}" },
  { id:"teachers",        label:"Teachers",       icon:"\u{1F9D1}\u200D\u{1F3EB}" },
  { id:"staff",           label:"Staff",          icon:"\u{1F3EB}" },
  { id:"attendance",      label:"Attendance",     icon:"\u2714" },
  { id:"grades",          label:"Grades",         icon:"\u{1F4CA}" },
  { id:"subjects",        label:"Subjects",       icon:"\u{1F4D6}" },
  { id:"fees",            label:"Fees",           icon:"\u{1F4B3}" },
  { id:"expenditures",    label:"Expenditures",   icon:"\u{1F4B8}" },
  { id:"mpesa-reconcile", label:"M-Pesa Reconcile", icon:"\u{1F4F2}" },
  { id:"admissions",      label:"Admissions",     icon:"\u{1F4CB}" },
  { id:"invoices",        label:"Invoices",       icon:"\u{1F9FE}" },
  { id:"reportcards",     label:"Report Cards",   icon:"\u{1F4C4}" },
  { id:"discipline",      label:"Discipline",     icon:"\u2696" },
  { id:"transport",       label:"Transport",      icon:"\u{1F68C}" },
  { id:"communication",   label:"Communication",  icon:"\u{1F4AC}" },
  { id:"timetable",       label:"Timetable",      icon:"\u{1F5D3}" },
  { id:"reports",         label:"Reports",        icon:"\u{1F4CA}" },
  { id:"financial-reports",label:"Financial Reports",icon:"\u{1F4B0}" },
  { id:"analytics",       label:"Analytics",      icon:"\u{1F4C8}" },
  { id:"analysis",        label:"Analysis",       icon:"\u{1F50D}" },
  { id:"accounts",        label:"Accounts",       icon:"\u{1F511}" },
  { id:"hr",              label:"HR",             icon:"\u{1F9D1}" },
  { id:"library",         label:"Library",        icon:"\u{1F4DA}" },
  { id:"announcements",   label:"Announcements",  icon:"\u{1F4E2}" },
  { id:"exams",           label:"Exams",          icon:"\u{1F4DD}" },
  { id:"bulk-import",     label:"Import/Export",  icon:"\u{1F4C1}" },
  { id:"update-requests", label:"Update Requests",icon:"\u{1F4DD}" },
  { id:"trial-balance",   label:"Trial Balance",  icon:"\u2696" },
  { id:"income-statement",label:"Income Statement",icon:"\u{1F4C8}" },
  { id:"chart-of-accounts",label:"Chart of Accounts",icon:"\u{1F4CA}" },
  { id:"journal-entries", label:"Journal Entries",icon:"\u{1F4DD}" },
  { id:"general-ledger",  label:"General Ledger", icon:"\u{1F4D6}" },
  { id:"balance-sheet",   label:"Balance Sheet",  icon:"\u{1F4CA}" },
  { id:"term-management", label:"Term Management",icon:"📅" },
  { id:"settings",        label:"Settings",       icon:"⚙" },
];

export const NAV_EXTRAS = [
  { id: "lessonplans",  label: "Lesson Plans",  icon: "\u{1F4DD}" },
];
