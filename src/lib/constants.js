export const ALL_CLASSES = ["Playgroup","PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
export const SUBJECTS   = ["Mathematics","English","Kiswahili","Computer Science","Biology","Physics","Chemistry","History","Geography","CRE"];

export const DEFAULTS = {
  school: { name:"", term:"", year:"", email:"", phone:"", address:"", county:"", whatsapp_business_number:"", logo:"" },
  users: [],
  students: [],
  teachers: [],
  attendance:[], results:[], payments:[], smsLogs:[], notifications:[],
  feeStructures: [],
};

export const ROLE = {
  admin:     { pages:["dashboard","upgrade","students","teachers","staff","attendance","grades","subjects","fees","mpesa-reconcile","admissions","invoices","reportcards","discipline","transport","communication","messaging","timetable","reports","analytics","accounts","hr","library","lessonplans","pendingplans","settings","announcements","admin-settings","bulk-import","exams","medical"], edit:true },
  teacher:   { pages:["dashboard","students","teachers","attendance","grades","subjects","reportcards","discipline","timetable","communication","messaging","library","analysis","lessonplans","announcements","exams"], edit:true },
  finance:   { pages:["dashboard","fees","mpesa-reconcile","invoices","announcements","upgrade"], edit:true },
  hr:        { pages:["dashboard","hr","staff","announcements","upgrade"], edit:true },
  librarian: { pages:["dashboard","library","announcements"], edit:true },
  parent:    { pages:["dashboard","grades","fees","reportcards","attendance","communication","announcements"], edit:false },
  student:   { pages:["dashboard","grades","attendance","reportcards","library","announcements"], edit:false },
};

export const NAV = [
  { id:"dashboard",     label:"Dashboard",    icon:"⊞" },
  { id:"upgrade",       label:"Upgrade Plan", icon:"⭐" },
  { id:"students",      label:"Students",     icon:"👥" },
  { id:"teachers",     label:"Teachers",     icon:"👨‍🏫" },
  { id:"staff",         label:"Staff",        icon:"🏫" },
  { id:"attendance",    label:"Attendance",   icon:"✓"  },
  { id:"grades",        label:"Grades",       icon:"📊" },
  { id:"subjects",      label:"Subjects",     icon:"📖" },
  { id:"fees",          label:"Fees",         icon:"💳" },
  { id:"mpesa-reconcile", label:"M-Pesa Reconcile", icon:"📲" },
  { id:"admissions",    label:"Admissions",   icon:"📋" },
  { id:"invoices",      label:"Invoices",     icon:"🧾" },
  { id:"reportcards",   label:"Report Cards", icon:"📄" },
  { id:"discipline",    label:"Discipline",   icon:"⚖"  },
  { id:"transport",     label:"Transport",    icon:"🚌" },
  { id:"communication", label:"Communication",icon:"💬" },
  { id:"messaging",      label:"Messaging",    icon:"💬" },
  { id:"timetable",     label:"Timetable",    icon:"🗓" },
  { id:"reports",       label:"Reports",      icon:"📊" },
  { id:"analytics",     label:"Analytics",    icon:"📈" },
  { id:"analysis",      label:"Analysis",     icon:"🔍" },
  { id:"accounts",      label:"Accounts",     icon:"🔑" },
  { id:"hr",            label:"HR",           icon:"🧑" },
  { id:"library",       label:"Library",      icon:"📚" },
  { id:"announcements", label:"Announcements", icon:"📢" },
  { id:"exams",         label:"Exams",         icon:"📝" },
  { id:"bulk-import",   label:"Import/Export", icon:"📁" },
  { id:"medical",       label:"Medical",      icon:"🏥" },
  { id:"admin-settings", label:"Admin Settings", icon:"⚙"  },
  { id:"settings",      label:"Settings",     icon:"⚙"  },
];
