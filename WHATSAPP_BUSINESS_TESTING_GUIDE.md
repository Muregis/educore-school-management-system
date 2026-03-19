# WhatsApp Business Per-School Mobile App - Testing Guide

## 🎯 OVERVIEW
This guide provides comprehensive testing instructions for the migrated WhatsApp Business system that replaces Africa's Talking SMS with zero-cost per-school WhatsApp Business mobile apps.

## 📋 PRE-TESTING REQUIREMENTS

### Backend Server Setup
```bash
cd educore/backend
npm start
# Server should run on http://localhost:4000
```

### Frontend Setup
```bash
cd educore
npm run dev
# Frontend should run on http://localhost:5173
```

### Database Setup
- ✅ Supabase database connected
- ✅ Schools table has `whatsapp_business_number` column
- ✅ Students table has `parent_phone` column
- ✅ All migrations applied

---

## 🧪 PHASE 6 TESTING SCENARIOS

### **TEST 1: School WhatsApp Number Configuration**
**Objective:** Verify school can configure their WhatsApp Business number

**Steps:**
1. Login as admin user
2. Navigate to **Settings → School Info**
3. Find "WhatsApp Business Number" field
4. Enter: `254712345678`
5. Click "Save Changes"

**Expected Results:**
- ✅ Success message: "School info saved"
- ✅ Number persists after page refresh
- ✅ No 401/404 errors
- ✅ Validation accepts Kenyan format

---

### **TEST 2: Student WhatsApp Number Collection**
**Objective:** Verify parent WhatsApp numbers are properly validated

**Steps:**
1. Navigate to **Students** page
2. Click "Add Student"
3. Fill in required fields
4. In "Parent WhatsApp" field, test:
   - ✅ `254712345678` (should accept)
   - ✅ `+254712345678` (should accept)
   - ❌ `0712345678` (should show error)
   - ❌ `12345` (should show error)
5. Click "Save"

**Expected Results:**
- ✅ Valid formats save successfully
- ✅ Invalid formats show error message
- ✅ Error message: "Invalid WhatsApp number format. Use: 2547xxxxxxxx or +2547xxxxxxxx"

---

### **TEST 3: Manual Payment Receipt via WhatsApp**
**Objective:** Test WhatsApp receipt for manual payment recording

**Steps:**
1. Navigate to **Fees** page
2. Click "Record Payment"
3. Fill payment details:
   - Student: Select any student
   - Amount: `1500`
   - Method: `Cash`
   - Reference: `MANUAL_001`
4. Click "Record Payment"
5. Receipt modal should appear
6. Click "📱 Send Receipt via WhatsApp"

**Expected Results:**
- ✅ Receipt modal shows payment details
- ✅ WhatsApp button is visible
- ✅ WhatsApp opens with pre-filled message
- ✅ Message format:
  ```
  💰 PAYMENT RECEIPT
  📚 Student Name
  💳 Amount: KES 1,500
  🔹 Method: Cash
  📋 Reference: MANUAL_001
  📅 Date: [current date]
  
  ✅ Payment received successfully!
  Thank you for your payment.
  ```

---

### **TEST 4: Bank Deposit with WhatsApp Proof**
**Objective:** Test bank deposit workflow with WhatsApp proof

**Steps:**
1. Navigate to **Fees** page → **Balances** tab
2. Find student with outstanding balance
3. Click "🏦 Bank Deposit" button
4. Fill deposit details:
   - Amount: `2000`
   - Upload any test file (PDF/JPG)
5. Click "Record Bank Deposit"
6. Receipt modal appears
7. Click "📱 Send Proof via WhatsApp"

**Expected Results:**
- ✅ Bank deposit recorded as "pending"
- ✅ Receipt shows proof upload status
- ✅ WhatsApp button sends different message format:
  ```
  🏦 BANK DEPOSIT NOTIFICATION
  📚 School: Grade 7
  👤 Student: Student Name
  💰 Amount: KES 2,000
  📋 Reference: BANK_001
  📅 Date: [current date]
  📎 Proof: View attachment
  
  ✅ Please confirm and approve this bank deposit.
  ```

---

### **TEST 5: M-Pesa Payment Integration**
**Objective:** Test M-Pesa payment triggers WhatsApp receipt

**Steps:**
1. Navigate to **Fees** page
2. Click "M-Pesa" button
3. Enter phone: `254712345678`
4. Enter amount: `1000`
5. Click "Send STK Push"
6. **(Backend Test)** Simulate M-Pesa callback success

**Expected Results:**
- ✅ STK push initiated
- ✅ Payment recorded as "paid" after callback
- ✅ WhatsApp receipt automatically sent
- ✅ No SMS sent from Africa's Talking

---

### **TEST 6: Paystack Payment Integration**
**Objective:** Test Paystack payment triggers WhatsApp receipt

**Steps:**
1. Navigate to **Fees** page
2. Click "Paystack" button
3. Enter email: `test@example.com`
4. Enter amount: `3000`
5. Complete Paystack payment flow
6. Return to application

**Expected Results:**
- ✅ Paystack modal opens
- ✅ Payment processed successfully
- ✅ WhatsApp receipt automatically sent
- ✅ No SMS sent from Africa's Talking

---

## 🔧 TROUBLESHOOTING GUIDE

### Backend Issues
**Error:** `404 Not Found` for API endpoints
**Solution:** 
```bash
cd educore/backend
npm start
# Check server is running on port 4000
```

**Error:** `401 Unauthorized` 
**Solution:** Ensure user is logged in and token is valid

### WhatsApp Issues
**Error:** "School WhatsApp number not configured"
**Solution:** Configure WhatsApp number in Settings → School Info

**Error:** WhatsApp doesn't open
**Solution:** Check school WhatsApp number format is correct

### Validation Issues
**Error:** "Invalid WhatsApp number format"
**Solution:** Use format: `2547xxxxxxxx` or `+2547xxxxxxxx`

---

## 📊 SUCCESS METRICS

### ✅ Expected Results
- **Zero SMS costs:** No Africa's Talking SMS sent
- **WhatsApp integration:** All receipts via WhatsApp
- **Proper validation:** Kenyan number format enforced
- **User experience:** Seamless wa.me link generation
- **Tenant isolation:** Each school uses their own WhatsApp

### 📈 Performance Metrics
- **Cost:** KSh 0 ongoing (vs previous SMS costs)
- **Delivery:** Instant via WhatsApp Business app
- **Reliability:** Uses official wa.me links
- **Scalability:** Per-school model scales infinitely

---

## 🚀 DEPLOYMENT READINESS CHECKLIST

### Backend ✅
- [ ] Server starts successfully on port 4000
- [ ] All API endpoints respond correctly
- [ ] Database connections working
- [ ] WhatsApp service configured (optional for wa.me links)

### Frontend ✅
- [ ] All WhatsApp buttons visible in receipt modals
- [ ] School settings page has WhatsApp field
- [ ] Student form validates WhatsApp numbers
- [ ] No console errors

### Database ✅
- [ ] Schools table has whatsapp_business_number column
- [ ] Students table has parent_phone column
- [ ] All migrations applied successfully

### Integration ✅
- [ ] Manual payments trigger WhatsApp receipts
- [ ] Bank deposits support WhatsApp proof
- [ ] M-Pesa payments send WhatsApp receipts
- [ ] Paystack payments send WhatsApp receipts

---

## 🎯 FINAL VALIDATION

Once all tests pass, the WhatsApp Business per-school mobile app migration is complete and ready for production deployment with zero ongoing costs!
