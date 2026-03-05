# EduCore MVP Task Board (Now -> May)

## Goal
Deliver a demo-ready MVP with:
1. Student management
2. Fee management
3. Exam results
4. Admin dashboard
5. Basic analytics

---

## Sprint 1 - Foundation and Structure
Status: In Progress

### 1.1 Refactor app structure out of single `App.jsx`
- [ ] Create `src/pages/`:
  - `DashboardPage.jsx`
  - `StudentsPage.jsx`
  - `TeachersPage.jsx`
  - `AttendancePage.jsx`
  - `GradesPage.jsx`
  - `FeesPage.jsx`
  - `SettingsPage.jsx`
- [ ] Create `src/components/`:
  - `Modal.jsx`
  - `Table.jsx`
  - `Field.jsx`
  - `Button.jsx`
  - `Badge.jsx`
  - `NotificationPanel.jsx`
- [ ] Create `src/lib/`:
  - `storage.js` (`useLocalState` + keys)
  - `constants.js` (roles, nav, classes, subjects)
  - `format.js` (money/date helpers)
- [ ] Keep behavior unchanged while extracting.

Acceptance
- `npm run lint` passes
- `npm run build` passes
- App behavior same as current version

### 1.2 Role-based route guard hardening
- [ ] Centralize permission check helper:
  - `canViewPage(role, page)`
  - `canEdit(role)`
- [ ] Prevent page state from entering unauthorized pages.
- [ ] Disable edit actions globally by role helper.

Acceptance
- Viewer cannot access Settings
- Teacher can edit attendance/results/students only where intended
- Admin sees all modules and all edit actions

---

## Sprint 2 - Student Management (MVP Core)
Status: Pending

### 2.1 Student CRUD completeness
- [ ] Add validation:
  - required `firstName`, `lastName`, `className`
  - admission format auto-generate if empty
- [ ] Add edit/delete confirmation modal
- [ ] Improve search:
  - name/admission/class/parent phone

### 2.2 Student profile details
- [ ] Add profile sections:
  - Bio/contact
  - Results summary
  - Fee summary (expected, paid, balance)
- [ ] Report export button keeps printable student summary

### 2.3 Student gender stats
- [ ] Keep boys/girls/total summary visible on:
  - Dashboard
  - Students page

Acceptance
- Full student lifecycle works (create -> edit -> view profile -> delete)
- Gender counters update live after CRUD

---

## Sprint 3 - Fees Management (MVP Core)
Status: Pending

### 3.1 Fee structure setup
- [ ] Per class: tuition/activity/misc with persistence
- [ ] Input validation (non-negative numbers)

### 3.2 Payments ledger
- [ ] Payment create/edit/delete
- [ ] Status handling (`paid`, `pending`)
- [ ] Date + method capture

### 3.3 Balance tracking
- [ ] Compute per-student expected vs paid vs balance
- [ ] Add quick filter for defaulters (`balance > 0`)

Acceptance
- Fee structure changes reflect in student balances immediately
- Payment updates recalculate balances correctly

---

## Sprint 4 - Results and Reports (MVP Core)
Status: Pending

### 4.1 Bulk results entry
- [ ] Keep one-student-many-subjects entry
- [ ] Add mark validation (`0 <= marks <= total`)

### 4.2 Results table improvements
- [ ] Filter by class/term/student
- [ ] Delete/edit result row

### 4.3 Report export
- [ ] Class report print/export view
- [ ] Student report remains from profile page

Acceptance
- Teacher can enter all subject marks for a student in one save
- Admin can filter and export report views

---

## Sprint 5 - Dashboard and Analytics (MVP Core)
Status: Pending

### 5.1 Admin analytics widgets
- [ ] Students total + boys + girls
- [ ] Fees collected this term
- [ ] Outstanding balances total
- [ ] Attendance rate

### 5.2 Visual charts (basic)
- [ ] Attendance by day (last 7 records)
- [ ] Fee collection vs outstanding
- [ ] Results distribution (EE/ME/AE/BE)

Acceptance
- Dashboard gives at-a-glance school status without opening tables

---

## Sprint 6 - Polish, Demo Readiness, QA
Status: Pending

### 6.1 UX polish
- [ ] Empty states
- [ ] Error states
- [ ] Success toasts for all major actions
- [ ] Mobile responsiveness pass

### 6.2 Data reset/demo mode
- [ ] Add `Reset Demo Data` button in Settings (admin only)
- [ ] Re-seed localStorage from defaults

### 6.3 QA checklist
- [ ] Auth scenarios (admin/teacher/viewer)
- [ ] CRUD scenarios all modules
- [ ] Print/export flows
- [ ] Persistence after refresh

Acceptance
- End-to-end demo runs cleanly in one session

---

## Out of MVP (After May)
- Parent portal
- MPesa automation
- CBC competency matrix
- Multi-tenant backend + subdomains
- SMS gateway integration

---

## Immediate Next Task
Start with Sprint 1.1: extract current monolithic `src/App.jsx` into page/component files with no behavior change.
