export const ALL_CLASSES = ["Playgroup", "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"];
export const SUBJECTS = ["Mathematics", "English", "Biology", "Physics", "Chemistry", "History", "CRE"];

export const DEFAULTS = {
  school: { name: "Greenfield Academy", term: "Term 2", year: "2026", email: "admin@greenfield.ac.ke", phone: "+254 712 345 678", address: "Nairobi", logo: "" },
  users: [
    { id: 1, name: "Mrs. Wanjiku", email: "admin@greenfield.ac.ke", password: "admin123", role: "admin", status: "active" },
    { id: 2, name: "Grace Akinyi", email: "teacher@greenfield.ac.ke", password: "teacher123", role: "teacher", status: "active" },
    { id: 3, name: "Demo Viewer", email: "viewer@greenfield.ac.ke", password: "viewer123", role: "viewer", status: "active" },
    { id: 4, name: "Family Account (Parent)", email: "family@greenfield.ac.ke", password: "family123", role: "parent", status: "active" },
    { id: 5, name: "Family Account (Student)", email: "family@greenfield.ac.ke", password: "family123", role: "student", status: "active" }
  ],
  students: [
    { id: 1, admission: "ADM-2020-001", firstName: "Amara", lastName: "Osei", className: "Grade 7", gender: "female", parentName: "Mr. Osei", parentPhone: "0712345678", dob: "2012-03-14", status: "active" },
    { id: 2, admission: "ADM-2019-002", firstName: "Brian", lastName: "Kamau", className: "Grade 8", gender: "male", parentName: "Mrs. Kamau", parentPhone: "0723456789", dob: "2011-07-22", status: "active" },
    { id: 3, admission: "ADM-2021-003", firstName: "Chloe", lastName: "Mutua", className: "Grade 6", gender: "female", parentName: "Mr. Mutua", parentPhone: "0734567890", dob: "2013-01-05", status: "active" }
  ],
  teachers: [
    { id: 1, firstName: "Grace", lastName: "Akinyi", email: "g.akinyi@school.com", phone: "0711222333", status: "active", classes: ["Grade 7", "Grade 8"], timetable: "Mon-Fri 8:00-15:30", subjects: ["Mathematics", "Physics"] },
    { id: 2, firstName: "James", lastName: "Mwangi", email: "j.mwangi@school.com", phone: "0722333444", status: "active", classes: ["Grade 6"], timetable: "Mon-Fri 8:00-15:30", subjects: ["English", "History"] }
  ],
  attendance: [],
  results: [],
  feeStructures: [
    { id: 1, className: "Grade 6", term: "Term 2", tuition: 15000, activity: 2000, misc: 500 },
    { id: 2, className: "Grade 7", term: "Term 2", tuition: 16000, activity: 2000, misc: 500 },
    { id: 3, className: "Grade 8", term: "Term 2", tuition: 17000, activity: 2000, misc: 500 }
  ],
  payments: [],
  smsLogs: [],
  integrations: {
    mpesa: { enabled: false, shortcode: "", consumerKey: "", consumerSecret: "" },
    bank: { enabled: false, bankName: "", accountNumber: "" }
  },
  notifications: []
};

export const ROLE = {
  admin: { pages: ["dashboard", "students", "teachers", "attendance", "grades", "fees", "discipline", "transport", "communication", "settings"], edit: true },
  teacher: { pages: ["dashboard", "students", "attendance", "grades", "discipline"], edit: true },
  parent: { pages: ["dashboard", "students", "grades"], edit: false },
  student: { pages: ["dashboard", "grades"], edit: false },
  viewer: { pages: ["dashboard", "students", "teachers", "attendance", "grades"], edit: false }
};

export const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "students", label: "Students" },
  { id: "teachers", label: "Teachers" },
  { id: "attendance", label: "Attendance" },
  { id: "grades", label: "Grades" },
  { id: "fees", label: "Fees" },
  { id: "discipline", label: "Discipline" },
  { id: "transport", label: "Transport" },
  { id: "communication", label: "Communication" },
  { id: "settings", label: "Settings" }
];
