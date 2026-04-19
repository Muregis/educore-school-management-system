# Student Update Requests API Documentation

This document outlines the API endpoints needed for the parent update approval feature.

## Endpoints

### 1. Get All Pending Updates
```
GET /api/students/pending-updates
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "update_123",
    "studentId": "student_456",
    "field": "parentPhone",
    "oldValue": "0712345678",
    "newValue": "0723456789",
    "reason": "Changed phone number",
    "status": "pending",
    "requestedBy": "user_789",
    "requestedByRole": "parent",
    "createdAt": "2024-01-15T10:30:00Z",
    "approvedAt": null,
    "approvedBy": null,
    "rejectedAt": null,
    "rejectedBy": null,
    "rejectionReason": null
  }
]
```

### 2. Create Update Request
```
POST /api/students/pending-updates
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "studentId": "student_456",
  "field": "parentPhone",
  "oldValue": "0712345678",
  "newValue": "0723456789",
  "reason": "Changed phone number",
  "requestedBy": "user_789",
  "requestedByRole": "parent"
}
```

**Response:** Same as the update request object in GET response

### 3. Approve Update Request
```
POST /api/students/pending-updates/{updateId}/approve
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "message": "Update request approved successfully"
}
```

### 4. Reject Update Request
```
POST /api/students/pending-updates/{updateId}/reject
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Invalid phone number format"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Update request rejected successfully"
}
```

## Database Schema

### Pending Updates Table
```sql
CREATE TABLE pending_updates (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  field VARCHAR(50) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  requested_by VARCHAR(50) NOT NULL,
  requested_by_role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  approved_by VARCHAR(50) NULL,
  rejected_at TIMESTAMP NULL,
  rejected_by VARCHAR(50) NULL,
  rejection_reason TEXT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (rejected_by) REFERENCES users(id)
);
```

## Business Logic

### When Approving:
1. Verify user has admin privileges
2. Update the student record with the new value
3. Update the pending update status to "approved"
4. Set approved_at and approved_by fields
5. Send notification to the parent who requested the update

### When Rejecting:
1. Verify user has admin privileges
2. Update the pending update status to "rejected"
3. Set rejected_at, rejected_by, and rejection_reason fields
4. Send notification to the parent who requested the update

### When Creating Request:
1. Verify user is a parent and the student belongs to them
2. Check if there's already a pending request for the same field and student
3. Validate the new value format (e.g., phone number format)
4. Create the pending update request
5. Send notification to all admin users

## Allowed Fields for Updates

Parents can request updates for the following fields:
- `parentPhone` - Parent phone number
- `parentName` - Parent name
- `emergencyContactName` - Emergency contact name
- `emergencyContactPhone` - Emergency contact phone
- `emergencyContactRelationship` - Emergency contact relationship
- `medicalConditions` - Medical conditions
- `allergies` - Allergies
- `bloodGroup` - Blood group

## Security Considerations

1. Parents can only request updates for their own children
2. Only admins can approve/reject requests
3. All actions should be logged for audit purposes
4. Input validation and sanitization for all fields
5. Rate limiting to prevent spam requests
