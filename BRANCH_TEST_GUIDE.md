# Branch/Campus Feature Test Guide

## 1. Setup Test Data

### Create Main School (if not exists):
```sql
INSERT INTO schools (school_id, name, code, email, phone, county, subscription_status)
VALUES (2, 'Real Peak Education Centre', 'RPE-MAIN', 'admin@realpeak.ac.ke', '+254712345678', 'Nairobi', 'active')
ON CONFLICT DO NOTHING;
```

### Create Branches:
```sql
-- Branch 1 (Nairobi)
INSERT INTO schools (name, code, parent_school_id, is_branch, branch_code, branch_address, county, subscription_status)
VALUES ('Real Peak - Nairobi', 'RPE-NRB', 2, TRUE, '3.1', '123 Mombasa Road', 'Nairobi', 'active');

-- Branch 2 (Mombasa)  
INSERT INTO schools (name, code, parent_school_id, is_branch, branch_code, branch_address, county, subscription_status)
VALUES ('Real Peak - Mombasa', 'RPE-MBA', 2, TRUE, '3.2', '456 Beach Road', 'Mombasa', 'active');
```

### Create Test Users:
```sql
-- Admin for main school
INSERT INTO users (school_id, full_name, email, password_hash, role, status)
VALUES (2, 'School Admin', 'admin@realpeak.ac.ke', '$2a$10$hash', 'admin', 'active');

-- Director (can access ALL schools)
INSERT INTO users (school_id, full_name, email, password_hash, role, status)
VALUES (2, 'School Director', 'director@realpeak.ac.ke', '$2a$10$hash', 'director', 'active');

-- Parent in branch 1
INSERT INTO users (school_id, full_name, email, password_hash, role, status, student_id)
VALUES (3, 'Parent One', 'parent1@test.com', '$2a$10$hash', 'parent', 'active', 1);
```

## 2. Test Scenarios

### Test 1: Admin Views Branches
1. Login as `admin@realpeak.ac.ke`
2. **Expected:** See "Branch Selector" dropdown in topbar
3. Click dropdown → Shows:
   - Real Peak Education Centre (Main Campus)
   - Real Peak - Nairobi (3.1)
   - Real Peak - Mombasa (3.2)
4. Click "Branches" in sidebar → Branch Management page
5. **Expected:** Can create new branches

### Test 2: Director Views All Schools
1. Login as `director@realpeak.ac.ke`
2. **Expected:** See "All Schools (3 schools)" in dropdown
3. Click dropdown → Shows ALL schools including other main schools
4. **Expected:** Can switch to ANY school in system

### Test 3: Parent Cannot See Branches
1. Login as `parent1@test.com` (assigned to branch)
2. **Expected:** NO branch selector visible
3. **Expected:** School name shows as "Real Peak Education Centre" (no branch suffix)
4. **Expected:** Cannot access `/api/branches/*` endpoints (403 Forbidden)

### Test 4: Branch Switching
1. Login as admin
2. Click Branch Selector → Select "Real Peak - Nairobi"
3. **Expected:** Page reloads, school context changes
4. **Expected:** New data shows students/fees from Nairobi branch only
5. Check localStorage: `user.school_id` should be updated

### Test 5: Create Branch via UI
1. Login as admin/director
2. Go to "Branches" page
3. Click "Create Branch"
4. Fill form:
   - Name: `Real Peak - Kisumu`
   - Code: `3.3`
   - Address: `789 Lake Road`
   - County: `Kisumu`
5. Submit
6. **Expected:** New branch appears in list, selectable in dropdown

## 3. API Test Endpoints

```bash
# Get my branches (admin)
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/branches/my-branches

# Get specific school branches
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/branches/2

# Check access
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/branches/can-access

# Get accessible IDs
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/branches/accessible-ids

# Create branch (admin only)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Branch","branch_code":"TEST","parent_school_id":2}' \
  $API_URL/api/branches

# Switch branch
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/branches/switch/3
```

## 4. Privacy Verification

### Parent Login Response:
```json
{
  "user": {
    "schoolId": 3,
    "isBranch": false,      // HIDDEN
    "parentSchoolId": null,   // HIDDEN
    "branchCode": null        // HIDDEN
  }
}
```

### Admin Login Response:
```json
{
  "user": {
    "schoolId": 2,
    "isBranch": false,
    "parentSchoolId": null,
    "branchCode": null
  }
}
```

### Parent API Response (/my-branches):
```json
{
  "error": "Branch access not available"
}
```

## 5. Troubleshooting

| Issue | Solution |
|-------|----------|
| "No school context" error | Check JWT has `school_id` claim |
| "Cannot access this branch" | Verify `parent_school_id` links correctly |
| Branch not showing | Check `is_branch = true` and `is_deleted = false` |
| Parent sees branch info | Verify `role` is `parent` not `admin` |
| Director sees no schools | Add `director` role to user in database |

## 6. Files Modified/Created

### Backend:
- `backend/src/services/branch.service.js` ✅
- `backend/src/routes/branch.routes.js` ✅
- `backend/src/helpers/supabase-jwt.js` ✅
- `backend/src/routes/auth.routes.js` ✅
- `backend/src/app.js` ✅

### Frontend:
- `src/components/BranchSelector.jsx` ✅
- `src/utils/branchPrivacy.js` ✅
- `src/pages/BranchManagementPage.jsx` ✅
- `src/App.jsx` ✅
- `src/lib/constants.js` ✅

### Database:
- `database/add_branch_support_safe.sql` ✅
- `database/add_director_role.sql` ✅
