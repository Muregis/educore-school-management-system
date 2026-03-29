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
  admin:     { pages:["dashboard","students","staff","attendance","grades","fees","admissions","invoices","reportcards","discipline","transport","communication","timetable","reports","analysis","accounts","hr","library","lessonplans","pendingplans","settings","announcements"], edit:true },
  teacher:   { pages:["dashboard","students","attendance","grades","reportcards","discipline","timetable","communication","library","analysis","lessonplans","announcements"], edit:true },
  finance:   { pages:["dashboard","fees","invoices","announcements"], edit:true },
  hr:        { pages:["dashboard","hr","staff","announcements"], edit:true },
  librarian: { pages:["dashboard","library","announcements"], edit:true },
  parent:    { pages:["dashboard","grades","fees","reportcards","attendance","communication","announcements"], edit:false },
  student:   { pages:["dashboard","grades","attendance","reportcards","library","announcements"], edit:false },
};

export const NAV = [
  { id:"dashboard",     label:"Dashboard",    icon:"⊞" },
  { id:"students",      label:"Students",     icon:"👥" },
  { id:"staff",         label:"Staff",        icon:"🏫" },
  { id:"attendance",    label:"Attendance",   icon:"✓"  },
  { id:"grades",        label:"Grades",       icon:"📊" },
  { id:"fees",          label:"Fees",         icon:"💳" },
  { id:"admissions",    label:"Admissions",   icon:"📋" },
  { id:"invoices",      label:"Invoices",     icon:"🧾" },
  { id:"reportcards",   label:"Report Cards", icon:"📄" },
  { id:"discipline",    label:"Discipline",   icon:"⚖"  },
  { id:"transport",     label:"Transport",    icon:"🚌" },
  { id:"communication", label:"Communication",icon:"💬" },
  { id:"timetable",     label:"Timetable",    icon:"🗓" },
  { id:"reports",       label:"Reports",      icon:"📈" },
  { id:"analysis",      label:"Analysis",     icon:"🤖" },
  { id:"accounts",      label:"Accounts",     icon:"🔑" },
  { id:"hr",            label:"HR",           icon:"🧑" },
  { id:"library",       label:"Library",      icon:"📚" },
  { id:"announcements", label:"Announcements", icon:"📢" },
  { id:"settings",      label:"Settings",     icon:"⚙"  },
];
