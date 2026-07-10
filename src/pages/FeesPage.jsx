import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import RecordPaymentModal from "../components/RecordPaymentModal";
import PaymentReceipt from "../components/PaymentReceipt";
import { ALL_CLASSES } from "../lib/constants";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { getAuthHeaders } from "../lib/auth";
import { printHTML } from "../lib/print";
import discountService from "../services/discountService";
import { calculateStudentBalanceLocal } from "../services/studentBalanceUtils";
import { useCurrentTerm } from "../hooks/useCurrentTerm";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

// Inline helpers
function csv(filename, headers, rows) {
  const content = [headers, ...rows].map(r => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  a.download = filename; a.click();
}

function pager(items, page, size = 20) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const rows  = items.slice((page - 1) * size, page * size);
  return { pages, rows };
}

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center", marginTop: "var(--space-3)" }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === 1 ? "default" : "pointer" }}>‹</button>
      <span style={{ padding: "4px 10px", fontSize: "13px", color: "var(--color-text-secondary)" }}>{page} / {pages}</span>
      <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === pages ? "default" : "pointer" }}>›</button>
    </div>
  );
}

function normalisePayment(p) {
  return {
    id:          p.payment_id     ?? p.id,
    studentId:   p.student_id     ?? p.studentId,
    studentName: p.first_name ? `${p.first_name} ${p.last_name}` : (p.studentName ?? ""),
    className:   p.class_name     ?? p.className   ?? "",
    amount:      p.amount         ?? 0,
    feeType:     p.fee_type       ?? p.feeType     ?? "tuition",
    method:      p.payment_method ?? p.method      ?? "cash",
    date:        p.payment_date?.slice(0,10) ?? p.date ?? "",
    status:      p.status         ?? "paid",
    reference:   p.reference_number ?? p.reference ?? "",
    paidBy:      p.paid_by          ?? p.paidBy    ?? "",
    admissionNumber: p.admission_number ?? p.admissionNumber ?? "",
    parentPhone: p.parent_phone ?? p.parentPhone ?? "",
    parentName:  p.parent_name ?? p.parentName ?? "",
  };
}

function normaliseFeeStruct(f) {
  return {
    id:        f.fee_structure_id ?? f.id,
    className: f.class_name       ?? f.className ?? "",
    tuition:   f.tuition          ?? 0,
    activity:  f.activity         ?? 0,
    misc:      f.misc             ?? 0,
    term:      f.term             ?? "Term 2",
  };
}

// Load Paystack inline script once
function loadPaystackScript() {
  return new Promise(resolve => {
    if (window.PaystackPop) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

export default function FeesPage({ auth, students, feeStructures, setFeeStructures, payments, setPayments, canEdit, canViewTotals, canDeletePayments, toast, linkedStudentId, school }) {
  const { term, academicYear, startDate, endDate } = useCurrentTerm(auth);
  const [tab, setTab]                 = useState("payments");
  const [showPayment, setShowPayment] = useState(false);
  const [showStruct, setShowStruct]   = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);
  const [showMpesa, setShowMpesa]       = useState(false);
  const [mpesaTarget, setMpesaTarget]   = useState(null);
  const [mpesaForm, setMpesaForm]       = useState({ phone:"", amount:"" });
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [mpesaStatus, setMpesaStatus]   = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt]         = useState(null);
  const [paystackTarget, setPaystackTarget] = useState(null);
  const [paystackForm, setPaystackForm]     = useState({ email: "", amount: "" });
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [editStruct, setEditStruct]   = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [filterClass, setFilterClass] = useState("all");
  const [filterDate, setFilterDate] = useState("all"); // 'all' | 'today'
  const [filterStudent, setFilterStudent] = useState("all"); // 'all' | studentId
  const [studentSearch, setStudentSearch] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [page, setPage]               = useState(1);
  const [paymentForm, setPaymentForm] = useState({ studentId: "", amount: "", feeType: "tuition", method: "cash", date: startDate || new Date().toISOString().slice(0,10), status: "paid", paidBy: "" });
  const [paymentClass, setPaymentClass] = useState("");
  const [structForm, setStructForm]   = useState({ className: "Grade 7", term: term || "Term 1", tuition: "", activity: "", misc: "" });
  const [bankDetails, setBankDetails] = useState(null);
  const [schoolWhatsApp, setSchoolWhatsApp] = useState("");
  const [schoolData, setSchoolData] = useState(null);
  const [bankDepositTarget, setBankDepositTarget] = useState(null);
  const [showBankDeposit, setShowBankDeposit] = useState(false);
  const [bankDepositForm, setBankDepositForm] = useState({ studentId: "", amount: "", proofFile: null });
  const [bankDepositLoading, setBankDepositLoading] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [studentDiscounts, setStudentDiscounts] = useState({});
  const [ledgerBalances, setLedgerBalances] = useState({});

  const getBusinessToday = () => new Date().toISOString().split('T')[0];
  const businessToday = getBusinessToday();

  const [dayEndTime, setDayEndTime] = useState(() => localStorage.getItem('dayEndTime') || '18:00');
  const [lastDayClosed, setLastDayClosed] = useState(() => localStorage.getItem('lastDayClosed') || null);

  const refreshLedgerBalances = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const data = await apiFetch('/ledger/balances', { token: auth.token });
      const map = {};
      (data.students || []).forEach(s => {
        const sid = s.student_id ?? s.id;
        if (sid !== undefined && sid !== null) {
          map[sid] = s.balance_after ?? s.balance ?? 0;
        }
      });
      setLedgerBalances(map);
    } catch (e) {
      console.warn('Ledger balances:', e);
    }
  }, [auth?.token]);

  useEffect(() => {
    refreshLedgerBalances();
  }, [refreshLedgerBalances]);

  const normalisedPayments   = payments.map(p => p.payment_id ? normalisePayment(p) : p);
  const normalisedStructures = feeStructures.map(f => f.fee_structure_id ? normaliseFeeStruct(f) : f);

  const calculateLedgerBalance = (student, studentDiscounts = []) => {
    const sid = student?.id ?? student?.student_id;
    const cls = student?.className ?? student?.class_name ?? "";
    const balanceInfo = calculateStudentBalanceLocal({
      student: student || {},
      feeStructures: normalisedStructures,
      payments: normalisedPayments,
      discounts: studentDiscounts,
      schoolSettings: schoolData || {}
    });

    const ledgerBalanceAfter = ledgerBalances[sid];

    let balance = balanceInfo.balance;
    let rawBalance = balanceInfo.rawBalance;
    let overpaymentAmount = balanceInfo.overpaymentAmount;
    let isOverpaid = balanceInfo.isOverpaid;
    let paid = balanceInfo.paid;

    if (typeof ledgerBalanceAfter === 'number') {
      if (ledgerBalanceAfter < 0) {
        balance = Math.abs(ledgerBalanceAfter);
        rawBalance = ledgerBalanceAfter;
        overpaymentAmount = 0;
        isOverpaid = false;
      } else {
        balance = 0;
        rawBalance = ledgerBalanceAfter;
        overpaymentAmount = ledgerBalanceAfter;
        isOverpaid = true;
      }
    }

    return {
      studentId: sid,
      name: student?.firstName ? `${student.firstName} ${student.lastName}` : (student?.first_name ? `${student.first_name} ${student.last_name}` : "Unknown"),
      className: cls,
      expected: balanceInfo.expected,
      grossAmount: balanceInfo.grossAmount,
      totalDiscount: balanceInfo.totalDiscount,
      discountPercent: balanceInfo.discountPercent,
      discountType: balanceInfo.discountType,
      discountLabel: balanceInfo.discountLabel,
      hasDiscount: balanceInfo.hasDiscount,
      paid,
      balance,
      rawBalance,
      overpaymentAmount,
      isOverpaid,
      openingBalance: balanceInfo.openingBalance,
      transportFee: balanceInfo.transportFee,
      lunchFee: balanceInfo.lunchFee,
      breakfastFee: balanceInfo.breakfastFee,
      baseFee: balanceInfo.baseFee,
      admissionNumber: student?.admission ?? student?.admission_number ?? "",
      email: student?.email ?? student?.parentEmail ?? "",
      transportDirection: student?.transport_direction || 'none',
      lunchEnabled: student?.lunch_enabled || false,
      breakfastEnabled: student?.breakfast_enabled || false
    };
  };

  const balances = students.map(s => calculateLedgerBalance(s, studentDiscounts[s.id ?? s.student_id] || []))
    .filter(b => filterClass === "all" || b.className === filterClass)
    .filter(b => (!filterClass || filterClass === "all" || b.className === filterClass))
    .filter(b => {
      if (!recordSearch) return true;
      const q = recordSearch.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        String(b.studentId).includes(q) ||
        b.className.toLowerCase().includes(q) ||
        b.admissionNumber.toLowerCase().includes(q)
      );
    });

  const filteredPayments = normalisedPayments.filter(p => 
    (filterClass === "all" || p.className === filterClass) &&
    (!recordSearch || (
      (p.studentName || "").toLowerCase().includes(recordSearch.toLowerCase()) ||
      String(p.studentId).includes(recordSearch) ||
      (p.className || "").toLowerCase().includes(recordSearch.toLowerCase()) ||
      (p.reference || "").toLowerCase().includes(recordSearch.toLowerCase()) ||
      (p.admissionNumber || "").toLowerCase().includes(recordSearch.toLowerCase()) ||
      (p.parentPhone || "").includes(recordSearch) ||
      (p.parentName || "").toLowerCase().includes(recordSearch.toLowerCase()) ||
      String(p.id || p.payment_id || "").includes(recordSearch)
    ))
  );
  const { pages, rows }  = pager(filteredPayments, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  const openPaystack = (b) => {
    setPaystackTarget(b);
    setPaystackForm({ email: b.email || "", amount: String(b.balance) });
    setShowPaystack(true);
  };

  const initiatePaystack = async () => {
    if (!paystackForm.email) return toast("Parent email is required for Paystack", "error");
    const amount = Number(paystackForm.amount);
    if (!amount || amount <= 0) return toast("Enter a valid amount", "error");
    if (amount > paystackTarget.balance) return toast("Cannot exceed outstanding balance", "error");

    setPaystackLoading(true);
    try {
      const data = await apiFetch("/paystack/initialize", {
        method: "POST",
        body: {
          email:           paystackForm.email,
          amount,
          studentId:       paystackTarget.studentId,
          studentName:     paystackTarget.name,
          admissionNumber: paystackTarget.admissionNumber,
        },
        token: auth?.token,
      });

      localStorage.setItem("ps_pending_ref",     data.reference);
      localStorage.setItem("ps_pending_name",    paystackTarget.name);
      localStorage.setItem("ps_pending_amount",  amount);
      localStorage.setItem("ps_pending_balance", paystackTarget.balance);

      window.location.href = data.authorizationUrl;
    } catch (err) {
      toast(err.message || "Paystack init failed", "error");
    }
    setPaystackLoading(false);
  };

  const openMpesa = (b) => {
    setMpesaTarget(b);
    setMpesaForm({ phone:"", amount:String(b.balance) });
    setMpesaStatus(null);
    setShowMpesa(true);
  };

  const initiateMpesa = async () => {
    if (!mpesaForm.phone) return toast("Phone number required (e.g. 0712345678)", "error");
    const amount = Number(mpesaForm.amount);
    if (!amount || amount <= 0) return toast("Enter a valid amount", "error");
    if (amount > mpesaTarget.balance) return toast("Cannot exceed outstanding balance", "error");

    setMpesaLoading(true);
    setMpesaStatus(null);
    try {
      let phone = mpesaForm.phone.trim().replace(/\s+/g, "");
      if (!phone) return toast("Phone number required", "error");
      if (phone.startsWith("+")) phone = phone.slice(1);
      if (phone.startsWith("0")) phone = "254" + phone.slice(1);
      if (!phone.startsWith("254")) phone = "254" + phone;

      const data = await apiFetch("/mpesa/stk-push", {
        method: "POST",
        body: {
          phone,
          amount,
          studentId:   mpesaTarget.studentId,
          studentName: mpesaTarget.name,
        },
        token: auth?.token,
      });
      setMpesaStatus({ ok:true, checkoutRequestId: data.checkoutRequestId });
      toast("STK push sent — check your phone", "success");
    } catch (err) {
      toast(err.message || "Mpesa STK push failed", "error");
    }
    setMpesaLoading(false);
  };

  const checkMpesaStatus = async () => {
    if (!mpesaStatus?.checkoutRequestId) return;
    try {
      const data = await apiFetch(`/mpesa/status/${mpesaStatus.checkoutRequestId}`, { token: auth?.token });
      if (data.status === "paid") {
        await reloadPayments();
        setShowMpesa(false);
        toast("Mpesa payment confirmed!", "success");
      } else {
        toast(`Status: ${data.status} — payment not yet confirmed`, "warning");
      }
    } catch { toast("Could not check status", "error"); }
  };

  const savePayment = async () => {
    const sid = Number(paymentForm.studentId);
    const s   = students.find(x => (x.id ?? x.student_id) === sid);
    const amt = Number(paymentForm.amount);
    const balance = balances.find(b => b.studentId === sid)?.balance || 0;

    if (!s)   return toast("Select student", "error");
    if (!amt || amt <= 0) return toast("Amount required", "error");
    if (amt > balance) return toast("Cannot exceed outstanding balance", "error");

    const methodMap = { cash: 'cash', mpesa: 'mpesa_manual', bank: 'bank_transfer' };
    const paymentMethod = methodMap[paymentForm.method] || paymentForm.method;

    console.log('[FeesPage] savePayment payload:', {
      studentId: sid,
      amount: amt,
      paymentMethod,
      paymentDate: paymentForm.date,
      term: displayTerm
    });

    try {
      await apiFetch("/payments/record-manual", {
        method: "POST",
        token: auth?.token,
        body: {
          studentId: sid,
          amount: amt,
          paymentMethod,
          paymentDate: paymentForm.date,
          term: displayTerm,
        },
      });
      await reloadPayments();
      await refreshLedgerBalances();
      setShowPayment(false);
      const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
      const studentBalance = calculateLedgerBalance(s, studentDiscounts[sid] || []);
      const newBalance = Math.max(0, studentBalance.balance - amt);
      setReceipt({ 
        studentName: name, 
        amount: amt, 
        reference: `CASH-${Date.now()}`, 
        method: paymentForm.method, 
        date: paymentForm.date,
        balance: newBalance
      });
      setShowReceipt(true);
      toast("Payment recorded", "success");
    } catch (err) { toast(err.message || "Payment failed", "error"); }
  };

  const savePaymentEdit = async () => {
    if (!editingPayment) return;
    const amt = Number(editingPayment.amount);
    if (!amt || amt <= 0) return toast("Amount required", "error");

    try {
      await apiFetch(`/payments/${editingPayment.id}`, {
        method: "PUT",
        token: auth?.token,
        body: {
          amount: amt,
          feeType: editingPayment.feeType,
          paymentMethod: editingPayment.method,
          referenceNumber: editingPayment.reference,
          paymentDate: editingPayment.date,
          status: editingPayment.status,
          paidBy: editingPayment.paidBy,
        },
      });
      await reloadPayments();
      setEditingPayment(null);
      toast("Payment updated successfully", "success");
    } catch (err) {
      toast(err.message || "Update failed", "error");
    }
  };

  const saveStructure = async () => {
    if (!structForm.className) return toast("Class required", "error");
    try {
      await apiFetch("/payments/fee-structures", {
        method: "POST",
        body: { className: structForm.className, term: structForm.term || "Term 1", tuition: Number(structForm.tuition)||0, activity: Number(structForm.activity)||0, misc: Number(structForm.misc)||0 },
        token: auth?.token,
      });
      const data = await apiFetch("/payments/fee-structures", { token: auth?.token });
      setFeeStructures(data.map(normaliseFeeStruct));
      setShowStruct(false); setEditStruct(null);
      toast("Fee structure saved", "success");
    } catch (err) { toast(err.message || "Save failed", "error"); }
  };

  const delPayment = async id => {
    if (!window.confirm("Delete this payment?")) return;
    try {
      await apiFetch(`/payments/${id}`, { method: "DELETE", token: auth?.token });
      setPayments(prev => prev.filter(p => (p.id ?? p.payment_id) !== id));
      toast("Deleted", "success");
    } catch (err) { toast(err.message || "Delete failed", "error"); }
  };

  const openBankDeposit = (b) => {
    setBankDepositTarget(b);
    setBankDepositForm({ studentId: b.studentId, amount: String(b.balance) });
    setShowBankDeposit(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast("Please upload an image (JPG/PNG) or PDF file", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast("File size must be less than 5MB", "error");
        return;
      }
      setBankDepositForm({ ...bankDepositForm, proofFile: file });
    }
  };

  const saveBankDeposit = async () => {
    const sid = Number(bankDepositForm.studentId);
    const s = students.find(x => (x.id ?? x.student_id) === sid);
    const amt = Number(bankDepositForm.amount);
    const balance = balances.find(b => b.studentId === sid)?.balance || 0;

    if (!s) return toast("Select student", "error");
    if (!amt || amt <= 0) return toast("Amount required", "error");
    if (amt > balance) return toast("Cannot exceed outstanding balance", "error");
    if (!bankDepositForm.proofFile) return toast("Proof of payment is required", "error");

    setBankDepositLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', bankDepositForm.proofFile);
      formData.append('studentId', sid);
      formData.append('amount', amt);
      
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const uploadResponse = await fetch(`${API_BASE}/api/payments/upload-proof`, {
        method: 'POST',
        headers: getAuthHeaders(auth.token),
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload proof');
      }
      
      const { proofUrl } = await uploadResponse.json();
      
      await apiFetch("/payments", {
        method: "POST",
        body: {
          studentId: sid,
          amount: amt,
          feeType: "tuition",
          paymentMethod: "bank",
          paymentDate: new Date().toISOString().slice(0,10),
          status: "pending",
          paidBy: "Bank Deposit",
          proofUrl: proofUrl
        },
        token: auth?.token,
      });
      
      await reloadPayments();
      await refreshLedgerBalances();
      setShowBankDeposit(false);
      setBankDepositForm({ studentId: "", amount: "", proofFile: null });
      
      const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
      const studentBalance = calculateLedgerBalance(s, studentDiscounts[sid] || []);
      const newBalance = Math.max(0, studentBalance.balance - amt);
      setReceipt({
        studentName: name,
        amount: amt,
        reference: `BANK-${Date.now()}`,
        method: "Bank Deposit",
        date: new Date().toLocaleDateString(),
        proofUrl: proofUrl,
        balance: newBalance
      });
      setShowReceipt(true);
      toast("Bank deposit recorded", "success");
    } catch (err) { toast(err.message || "Bank deposit failed", "error"); }
    setBankDepositLoading(false);
  };

  const todayPayments = normalisedPayments.filter(p => {
    const paymentDate = p.date || p.payment_date;
    if (lastDayClosed && new Date(paymentDate) <= new Date(lastDayClosed)) {
      return false;
    }
    return p.status === "paid" && paymentDate && paymentDate.startsWith(businessToday);
  });
  const todayCollection = todayPayments.reduce((s, p) => s + Number(p.amount), 0);

  const filteredBalances = filterDate === "today"
    ? balances.filter(b => {
        const hasPaymentToday = todayPayments.some(p => String(p.studentId) === String(b.studentId));
        return hasPaymentToday || (b.balance > 0);
      })
    : balances;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Top Stats */}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Badge text={`Today's Collection: ${money(todayCollection)}`} variant="success" />
        <Badge text={`Students: ${students.length}`} variant="primary" />
        {filterDate === "today" && <Badge text="Showing: Today Only" variant="warning" />}
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)", marginLeft: "auto", fontWeight: 500 }}>
          Day ends at {dayEndTime} • Business day: {businessToday}
        </span>
      </div>

      {/* Controls Container */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "end" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Select 
              value={tab} 
              onChange={e => setTab(e.target.value)}
              options={[
                { value: "payments", label: "Payments" },
                { value: "balances", label: "Balances" },
                { value: "structure", label: "Fee Structure" }
              ]}
            />
            <Select 
              value={filterClass} 
              onChange={e => setFilterClass(e.target.value)}
              options={[
                { value: "all", label: "All classes" },
                ...ALL_CLASSES.map(c => ({ value: c, label: c }))
              ]}
            />
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flex: "1 1 320px", minWidth: "280px" }}>
              <Input
                placeholder="Search by name, admission, receipt, phone, class, transaction ID..."
                value={recordSearch}
                onChange={e => {
                  setRecordSearch(e.target.value);
                  if (e.target.value) setFilterStudent("all");
                }}
                style={{ flex: 1, minWidth: "240px" }}
              />
              {/* Removed limiting filterStudent Select in favor of live searchable input */}
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant={filterDate==="all" ? "primary" : "ghost"} onClick={() => setFilterDate("all")}>All Time</Button>
            <Button variant={filterDate==="today" ? "primary" : "ghost"} onClick={() => setFilterDate("today")}>Today</Button>
          </div>
          
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginLeft: "auto" }}>
            {canViewTotals && <Button variant="ghost" onClick={()=>{
              if (tab==="payments") csv("payments.csv",["Date","Student","Class","Amount","Type","Method","Status","Ref"],filteredPayments.map(p=>[p.date,p.studentName,p.className,p.amount,p.feeType,p.method,p.status,p.reference]));
              if (tab==="balances") csv("balances.csv",["Student","Class","Paid","Balance"],balances.map(b=>[b.name,b.className,b.paid,b.balance]));
              toast("CSV exported","success");
            }}>Export CSV</Button>}
            {canViewTotals && tab === "payments" && <Button variant="ghost" onClick={() => {
              const schoolInfo = schoolData || school || {};
              const schoolName = schoolInfo.name || schoolInfo.school_name || "School";
              const logoUrl = schoolInfo.logo_url || "";
              const printDate = new Date().toLocaleDateString();
              const uniqueStudents = [...new Set(filteredPayments.map(p => String(p.studentId)))];
              const statementTitle = uniqueStudents.length === 1 ? `Payment Statement - ${filteredPayments[0].studentName}` : "Payment History Statement";

              const rowsHtml = filteredPayments.map(p => `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.date}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.studentName}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.className}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">KES ${Number(p.amount).toLocaleString()}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.method}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.reference || '-'}</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd;">${p.paidBy || 'System'}</td>
                </tr>
              `).join("");
              
              let currentBalanceHtml = "";
              if (uniqueStudents.length === 1) {
                const studentBal = balances.find(b => String(b.studentId) === uniqueStudents[0]);
                if (studentBal) {
                   currentBalanceHtml = `<p style="margin: 5px 0 0 0; color: #333; font-weight: bold;">Outstanding Balance: KES ${Number(studentBal.balance).toLocaleString()}</p>`;
                }
              }

              const html = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height: 80px;" alt="Logo" />` : ''}
                    <h1 style="margin: 10px 0 5px 0;">${schoolName}</h1>
                    <h2 style="margin: 0; color: #555; font-size: 18px;">${statementTitle}</h2>
                    <p style="margin: 5px 0 0 0; color: #777;">Generated on ${printDate}</p>
                    ${currentBalanceHtml}
                  </div>
                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                      <tr style="background-color: #f8f9fa;">
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Date</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Student</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Class</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Amount</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Method</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Ref</th>
                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Cashier</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rowsHtml}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold; border-top: 2px solid #ddd;">Total Paid:</td>
                        <td colspan="4" style="padding: 8px; font-weight: bold; border-top: 2px solid #ddd;">KES ${filteredPayments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              `;
              printHTML(html, { title: statementTitle });
            }}>🖨️ Print Statement</Button>}
            {canEdit && tab==="payments" && <Button onClick={() => setShowPayment(true)}>+ Record Payment</Button>}
            {canEdit && tab==="payments" && <Button variant="secondary" onClick={() => setShowRecordPaymentModal(true)}>📝 Manual Payment</Button>}
            {canEdit && tab==="structure" && <Button onClick={() => { setEditStruct(null); setStructForm({className:"Grade 7",term:"Term 1",tuition:"",activity:"",misc:""}); setShowStruct(true); }}>Set Fee Structure</Button>}
            {canEdit && <Button variant="ghost" onClick={() => setShowDayEndSettings(true)}>⚙️ Day Settings</Button>}
            {canEdit && <Button variant="primary" onClick={closeDay}>🔒 Close Day</Button>}
          </div>
        </div>
      </Card>

      {/* Payments Tab */}
      {tab === "payments" && (
        filteredPayments.length === 0 ? (
          <EmptyState icon="💳" title="No Payments" description="There are no payment records matching the selected criteria." />
        ) : (
          <>
            {(() => {
              const uniqueStudents = [...new Set(filteredPayments.map(p => String(p.studentId)))];
              const activeStudentIdForProgress = uniqueStudents.length === 1 ? uniqueStudents[0] : null;
              if (!activeStudentIdForProgress) return null;
              
              return (
              <Card style={{ marginBottom: "var(--space-4)", background: "var(--color-info-muted)", borderColor: "var(--color-info-border)" }}>
                <div style={{ fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-info)" }}>
                  📊 Payment Progress for {students.find(s => String(s.id ?? s.student_id) === activeStudentIdForProgress)?.first_name} {students.find(s => String(s.id ?? s.student_id) === activeStudentIdForProgress)?.last_name}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-3)" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Total Paid</div>
                    <div style={{ fontWeight: 600, color: "var(--color-info)" }}>
                      {money(filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Payment Count</div>
                    <div style={{ fontWeight: 600, color: "var(--color-info)" }}>
                      {filteredPayments.length} payments
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Outstanding Balance</div>
                    <div style={{ fontWeight: 600, color: "var(--color-info)" }}>
                      {money(balances.find(b => String(b.studentId) === activeStudentIdForProgress)?.balance || 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Completion</div>
                    <div style={{ fontWeight: 600, color: "var(--color-info)" }}>
                      {(() => {
                        const studentBal = balances.find(b => String(b.studentId) === activeStudentIdForProgress);
                        if (!studentBal || studentBal.expected === 0) return "0%";
                        const percent = Math.round((studentBal.paid / studentBal.expected) * 100);
                        return `${percent}%`;
                      })()}
                    </div>
                  </div>
                </div>
              </Card>
              );
            })()}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <Table
                headers={["Date", "Student", "Class", "Amount", "Method", "Paid By", "Status", "Ref", "Actions"]}
                data={rows.map(p => [
                  p.date,
                  <span key={p.id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{p.studentName}</span>,
                  p.className,
                  money(p.amount),
                  p.method,
                  <span key="pb" style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{p.paidBy || "—"}</span>,
                  <Badge key="st" text={p.status} variant={p.status==="paid" ? "success" : p.status==="pending" ? "warning" : "danger"} />,
                  <span key="ref" style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{p.reference || "—"}</span>,
                  <div key="actions" style={{ display: "flex", gap: "var(--space-2)" }}>
                    {["admin", "director", "superadmin"].includes(auth?.role) && (
                      <Button size="sm" variant="secondary" onClick={() => setEditingPayment({
                        id: p.id,
                        studentId: p.studentId,
                        studentName: p.studentName,
                        className: p.className,
                        amount: p.amount,
                        feeType: p.feeType,
                        method: p.method,
                        date: p.date,
                        status: p.status,
                        reference: p.reference,
                        paidBy: p.paidBy
                      })}>Edit</Button>
                    )}
                    {canDeletePayments && (
                      <Button size="sm" variant="danger" onClick={() => delPayment(p.id)}>Delete</Button>
                    )}
                    {!["admin", "director", "superadmin"].includes(auth?.role) && !canDeletePayments && "—"}
                  </div>
                ])}
              />
              <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
                <Pager page={page} pages={pages} setPage={setPage} />
              </div>
            </Card>
          </>
        )
      )}

      {/* Balances Tab */}
      {tab === "balances" && (
        <>
          {/* Bank Instructions */}
          {bankDetails && (bankDetails.bank_name || bankDetails.bank_account_number) && (
            <Card style={{ background: "var(--color-info-muted)", borderColor: "var(--color-info-border)", marginBottom: "var(--space-4)" }}>
              <div style={{ fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-info)" }}>🏦 Bank Deposit Instructions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Bank Name</div>
                  <div style={{ fontWeight: 600, color: "var(--color-info)" }}>{bankDetails.bank_name || "Not set"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Account Number</div>
                  <div style={{ fontWeight: 600, color: "var(--color-info)" }}>{bankDetails.bank_account_number || "Not set"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Account Name</div>
                  <div style={{ fontWeight: 600, color: "var(--color-info)" }}>{bankDetails.account_name || "Not set"}</div>
                </div>
                {bankDetails.bank_branch && (
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--color-info)", opacity: 0.8, marginBottom: "4px" }}>Branch</div>
                    <div style={{ fontWeight: 600, color: "var(--color-info)" }}>{bankDetails.bank_branch}</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: "11px", color: "var(--color-info)", opacity: 0.8, marginTop: "var(--space-3)" }}>
                💡 Make deposits to this account and record them below with proof of payment
              </div>
            </Card>
          )}

          {filteredBalances.length === 0 ? (
            <EmptyState icon="⚖️" title="No Balances" description={filterDate === "today" ? "No balances for today." : "No balances available."} />
          ) : (
            <>
              {/* Class Summary Cards - Director/Superadmin only */}
              {["director", "superadmin"].includes(auth?.role) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                  {ALL_CLASSES.map(cls => {
                    const classBalances = balances.filter(b => b.className === cls);
                    const classStudents = classBalances.length;
                    const totalOutstanding = classBalances.reduce((sum, b) => sum + b.balance, 0);
                    const totalPaid = classBalances.reduce((sum, b) => sum + b.paid, 0);
                    const totalExpected = classBalances.reduce((sum, b) => sum + b.expected, 0);
                    if (classStudents === 0) return null;
                    return (
                      <Card key={cls} style={{ padding: "var(--space-3)" }}>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>{cls}</div>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: totalOutstanding > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {money(totalOutstanding)}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "8px" }}>
                          {classStudents} students · {money(totalPaid)} paid
                        </div>
                        {totalExpected > 0 && (
                          <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                            Expected: {money(totalExpected)}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}

              <Card style={{ padding: 0, overflow: "hidden" }}>
                <Table
                  headers={["Student","Class","Base Fee","+Transport","+Lunch","+Breakfast","+Opening",...(canViewTotals ? ["Paid"] : []),"Discount","Balance","Status","Pay"]}
                  data={filteredBalances.map(b => [
                    <span key={b.studentId} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{b.name}</span>,
                    b.className,
                    <span key="base" style={{ fontSize: "13px" }}>{money(b.baseFee)}</span>,
                    <span key="transport" style={{ fontSize: "13px", color: b.transportFee > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                      {b.transportFee > 0 ? money(b.transportFee) : "—"}
                      {b.transportDirection !== 'none' && <small style={{ display: 'block', fontSize: "10px", color: "var(--color-text-muted)" }}>{b.transportDirection.replace('_',' ')}</small>}
                    </span>,
                    <span key="lunch" style={{ fontSize: "13px", color: b.lunchFee > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                      {b.lunchFee > 0 ? money(b.lunchFee) : "—"}
                    </span>,
                    <span key="breakfast" style={{ fontSize: "13px", color: b.breakfastFee > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                      {b.breakfastFee > 0 ? money(b.breakfastFee) : "—"}
                    </span>,
                    <span key="opening" style={{ fontSize: "13px", color: b.openingBalance > 0 ? 'var(--color-warning)' : b.openingBalance < 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {b.openingBalance !== 0 ? money(Math.abs(b.openingBalance)) : "—"}
                      {b.openingBalance !== 0 && <small style={{ display: 'block', fontSize: "10px" }}>{b.openingBalance > 0 ? '(owing)' : '(credit)'}</small>}
                    </span>,
                    ...(canViewTotals ? [<span key="paid" style={{ color: 'var(--color-success)', fontWeight: 600 }}>{money(b.paid)}</span>] : []),
                    <span key="discount" style={{ fontSize: "13px", color: b.hasDiscount ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {b.hasDiscount ? (
                        <>
                          <span style={{ fontWeight: 600 }}>{b.discountPercent}%</span>
                          <small style={{ display: 'block', fontSize: "10px" }}>{b.discountLabel}</small>
                        </>
                      ) : "—"}
                    </span>,
                    <span key="balance" style={{ fontWeight: 700, fontSize: "15px", color: b.isOverpaid ? 'var(--color-success)' : b.balance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {b.isOverpaid ? `-${money(b.overpaymentAmount)}` : money(b.balance)}
                    </span>,
                    b.expected === 0
                      ? <Badge key="bdg" text="No Structure" variant="neutral" />
                      : <Badge key="bdg" text={b.isOverpaid ? "Credit" : b.balance > 0 ? "Pending" : "Cleared"} variant={b.isOverpaid ? "success" : b.balance > 0 ? "warning" : "success"} />,
                    b.expected > 0 && b.balance > 0 ? (
                      <div key="pay" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                        <Button size="sm" onClick={() => openPaystack(b)}>💳 Paystack</Button>
                        <Button variant="secondary" size="sm" onClick={() => openMpesa(b)}>📱 Mpesa</Button>
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => openBankDeposit(b)}>🏦 Bank</Button>
                        )}
                      </div>
                    ) : "—"
                  ])}
                />
              </Card>

              {/* Legend */}
              <div style={{ marginTop: "var(--space-4)", fontSize: "12px", color: "var(--color-text-muted)", display: "flex", gap: "var(--space-4)", flexWrap: "wrap", justifyContent: "center" }}>
                <span>💡 <strong>Base Fee:</strong> Tuition + Activity + Misc</span>
                <span>🚌 <strong>Transport:</strong> 1-way or 2-way</span>
                <span>🍽️ <strong>Lunch:</strong> Daily or termly rate</span>
                <span>🥐 <strong>Breakfast:</strong> Daily or termly rate</span>
                <span>📖 <strong>Opening:</strong> Balance carried forward</span>
                <span>🎁 <strong>Discount:</strong> Sibling/Staff/Scholarship</span>
              </div>
            </>
          )}
        </>
      )}

      {/* Fee Structure Tab */}
      {tab === "structure" && (
        normalisedStructures.length === 0 ? (
          <EmptyState icon="📋" title="No Fee Structures" description="There are no fee structures set. Create one to begin." />
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Table
              headers={["Class", "Term", "Tuition", "Activity", "Misc", "Total", "Actions"]}
              data={normalisedStructures.map(f => [
                <span key={f.id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{f.className}</span>,
                <span key="term" style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{f.term || "—"}</span>,
                money(f.tuition), 
                money(f.activity), 
                money(f.misc),
                <strong key="total">{money(Number(f.tuition) + Number(f.activity) + Number(f.misc))}</strong>,
                canEdit ? <Button key="ed" size="sm" variant="secondary" onClick={() => { setEditStruct(f); setStructForm({ className: f.className, term: f.term || "Term 1", tuition: String(f.tuition), activity: String(f.activity), misc: String(f.misc) }); setShowStruct(true); }}>Edit</Button> : "—"
              ])}
            />
          </Card>
        )
      )}

      {/* Paystack Modal */}
      <Modal isOpen={showPaystack && !!paystackTarget} title={`Pay Online — ${paystackTarget?.name}`} onClose={() => setShowPaystack(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowPaystack(false)}>Cancel</Button>
          <Button 
            onClick={initiatePaystack} 
            loading={paystackLoading}
            disabled={!paystackForm.email || Number(paystackForm.amount) < 100 || Number(paystackForm.amount) > (paystackTarget?.balance || 0)}
          >
            Open Payment
          </Button>
        </>
      }>
        <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-3)", fontSize: "14px" }}>
          Outstanding balance: <strong style={{ color: "var(--color-text-primary)", fontSize: "18px" }}>{money(paystackTarget?.balance || 0)}</strong>
        </div>
        <div style={{ background: "var(--color-primary-muted)", border: "1px solid var(--color-primary-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-4)", fontSize: "13px", color: "var(--color-primary)" }}>
          💳 Payment will be processed securely via <strong>Paystack</strong> — supports card, bank transfer & mobile money.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <Input label="Parent Email (for receipt)" value={paystackForm.email} onChange={e => setPaystackForm({ ...paystackForm, email: e.target.value })} placeholder="parent@email.com" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Input 
              label="Amount (KES)"
              type="number" 
              value={paystackForm.amount} 
              onChange={e => setPaystackForm({ ...paystackForm, amount: e.target.value })} 
            />
            {Number(paystackForm.amount) > (paystackTarget?.balance || 0) && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Cannot exceed balance</span>
            )}
            {Number(paystackForm.amount) < 100 && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Minimum KSh 100</span>
            )}
          </div>
        </div>
      </Modal>

      {/* Mpesa STK Push Modal */}
      <Modal isOpen={showMpesa && !!mpesaTarget} title={`Mpesa Payment — ${mpesaTarget?.name}`} onClose={() => setShowMpesa(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowMpesa(false)}>Cancel</Button>
          {!mpesaStatus?.ok && (
            <Button 
              onClick={initiateMpesa} 
              loading={mpesaLoading}
              disabled={!mpesaForm.phone || Number(mpesaForm.amount) < 100 || Number(mpesaForm.amount) > (mpesaTarget?.balance || 0)}
            >
              Send STK Push
            </Button>
          )}
        </>
      }>
        <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-3)", fontSize: "14px" }}>
          Outstanding balance: <strong style={{ color: "var(--color-text-primary)", fontSize: "18px" }}>{money(mpesaTarget?.balance || 0)}</strong>
        </div>
        <div style={{ background: "var(--color-success-muted)", border: "1px solid var(--color-success-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-4)", fontSize: "13px", color: "var(--color-success)" }}>
          📱 An STK push will be sent to the parent's phone. They will enter their M-Pesa PIN to complete payment.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <Input 
            label="Phone Number"
            value={mpesaForm.phone}
            onChange={e => setMpesaForm({ ...mpesaForm, phone: e.target.value })}
            placeholder="0712345678 or 254712345678" 
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Input 
              label="Amount (KES)"
              type="number" 
              value={mpesaForm.amount}
              onChange={e => setMpesaForm({ ...mpesaForm, amount: e.target.value })} 
            />
            {Number(mpesaForm.amount) > (mpesaTarget?.balance || 0) && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Cannot exceed balance</span>
            )}
            {Number(mpesaForm.amount) < 100 && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Minimum KSh 100</span>
            )}
          </div>
        </div>
        {mpesaStatus?.ok && (
          <div style={{ background: "var(--color-success-muted)", border: "1px solid var(--color-success-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginTop: "var(--space-3)", fontSize: "13px", color: "var(--color-success)" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>✅ STK push sent! Ask parent to check their phone.</div>
            <Button variant="ghost" size="sm" onClick={checkMpesaStatus}>🔄 Check Payment Status</Button>
          </div>
        )}
      </Modal>

      {/* Manual Payment Modal */}
      <Modal isOpen={showPayment} title="Record Manual Payment" onClose={() => setShowPayment(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowPayment(false)}>Cancel</Button>
          <Button 
            disabled={Number(paymentForm.amount) <= 0 || !paymentForm.studentId || Number(paymentForm.amount) > (balances.find(b => b.studentId === paymentForm.studentId)?.balance || 0)}
            onClick={savePayment}
          >
            Save Payment
          </Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Select 
              label="Class"
              value={paymentClass} 
              onChange={e => { setPaymentClass(e.target.value); setPaymentForm({ ...paymentForm, studentId: "" }); }}
              options={[
                { value: "", label: "-- Select class first --" },
                ...ALL_CLASSES.map(c => ({ value: c, label: c }))
              ]}
            />
            <Select 
              label="Student"
              value={paymentForm.studentId} 
              onChange={e => setPaymentForm({ ...paymentForm, studentId: Number(e.target.value) })} 
              disabled={!paymentClass}
              options={[
                { value: "", label: paymentClass ? "-- Select student --" : "-- Select class first --" },
                ...students.filter(s => (s.className ?? s.class_name) === paymentClass).map(s => ({
                  value: s.id ?? s.student_id,
                  label: s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`
                }))
              ]}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <Input 
              label="Amount (KES)"
              type="number" 
              value={paymentForm.amount} 
              onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
            />
            {Number(paymentForm.amount) > (balances.find(b => b.studentId === paymentForm.studentId)?.balance || 0) && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Cannot exceed balance</span>
            )}
            {Number(paymentForm.amount) < 100 && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Minimum KSh 100</span>
            )}
          </div>

          <Select 
            label="Type"
            value={paymentForm.feeType} 
            onChange={e => setPaymentForm({ ...paymentForm, feeType: e.target.value })}
            options={[
              { value: "tuition", label: "Tuition" },
              { value: "activity", label: "Activity" },
              { value: "misc", label: "Misc" }
            ]}
          />

          <Select 
            label="Method"
            value={paymentForm.method} 
            onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
            options={[
              { value: "cash", label: "Cash" },
              { value: "mpesa", label: "Mpesa" },
              { value: "bank", label: "Bank" }
            ]}
          />

          <Input 
            label="Date"
            type="date" 
            value={paymentForm.date} 
            onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} 
          />

          <Select 
            label="Status"
            value={paymentForm.status} 
            onChange={e => setPaymentForm({ ...paymentForm, status: e.target.value })}
            options={[
              { value: "paid", label: "Paid" },
              { value: "pending", label: "Pending" }
            ]}
          />

          <div style={{ gridColumn: "1 / -1" }}>
            <Input 
              label="Paid By (parent/guardian/sponsor)"
              value={paymentForm.paidBy} 
              onChange={e => setPaymentForm({ ...paymentForm, paidBy: e.target.value })} 
              placeholder="e.g. John Kamau (Father)" 
            />
          </div>
        </div>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal isOpen={!!editingPayment} title={`Edit Payment — ${editingPayment?.studentName}`} onClose={() => setEditingPayment(null)} footer={
        <>
          <Button variant="ghost" onClick={() => setEditingPayment(null)}>Cancel</Button>
          <Button 
            disabled={!editingPayment || Number(editingPayment.amount) <= 0}
            onClick={savePaymentEdit}
          >
            Save Changes
          </Button>
        </>
      }>
        {editingPayment && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Input label="Student" value={editingPayment.studentName} disabled />
            <Input label="Class" value={editingPayment.className} disabled />
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Input 
                label="Amount (KES)"
                type="number" 
                value={editingPayment.amount} 
                onChange={e => setEditingPayment({ ...editingPayment, amount: e.target.value })} 
              />
              {Number(editingPayment.amount) < 100 && (
                <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Minimum KSh 100</span>
              )}
            </div>

            <Select 
              label="Type"
              value={editingPayment.feeType} 
              onChange={e => setEditingPayment({ ...editingPayment, feeType: e.target.value })}
              options={[
                { value: "tuition", label: "Tuition" },
                { value: "activity", label: "Activity" },
                { value: "misc", label: "Misc" }
              ]}
            />

            <Select 
              label="Method"
              value={editingPayment.method} 
              onChange={e => setEditingPayment({ ...editingPayment, method: e.target.value })}
              options={[
                { value: "cash", label: "Cash" },
                { value: "mpesa", label: "Mpesa" },
                { value: "bank", label: "Bank" }
              ]}
            />

            <Input 
              label="Date"
              type="date" 
              value={editingPayment.date} 
              onChange={e => setEditingPayment({ ...editingPayment, date: e.target.value })} 
            />

            <Select 
              label="Status"
              value={editingPayment.status} 
              onChange={e => setEditingPayment({ ...editingPayment, status: e.target.value })}
              options={[
                { value: "paid", label: "Paid" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
                { value: "reversed", label: "Reversed" }
              ]}
            />

            <Input 
              label="Reference Number / Receipt"
              value={editingPayment.reference} 
              onChange={e => setEditingPayment({ ...editingPayment, reference: e.target.value })} 
            />

            <div style={{ gridColumn: "1 / -1" }}>
              <Input 
                label="Paid By (parent/guardian/sponsor)"
                value={editingPayment.paidBy} 
                onChange={e => setEditingPayment({ ...editingPayment, paidBy: e.target.value })} 
                placeholder="e.g. John Kamau (Father)" 
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Fee Structure Modal */}
      <Modal isOpen={showStruct} title={editStruct ? "Edit Fee Structure" : "Set Fee Structure"} onClose={() => setShowStruct(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowStruct(false)}>Cancel</Button>
          <Button onClick={saveStructure}>Save Structure</Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Select 
            label="Class"
            value={structForm.className} 
            onChange={e => setStructForm({ ...structForm, className: e.target.value })}
            options={ALL_CLASSES.map(c => ({ value: c, label: c }))}
          />
          <Select 
            label="Term"
            value={structForm.term || "Term 1"} 
            onChange={e => setStructForm({ ...structForm, term: e.target.value })}
            options={[
              { value: "Term 1", label: "Term 1" },
              { value: "Term 2", label: "Term 2" },
              { value: "Term 3", label: "Term 3" }
            ]}
          />
          <Input 
            label="Tuition Fee"
            type="number" 
            value={structForm.tuition} 
            onChange={e => setStructForm({ ...structForm, tuition: e.target.value })} 
          />
          <Input 
            label="Activity Fee"
            type="number" 
            value={structForm.activity} 
            onChange={e => setStructForm({ ...structForm, activity: e.target.value })} 
          />
          <Input 
            label="Misc Fee"
            type="number" 
            value={structForm.misc} 
            onChange={e => setStructForm({ ...structForm, misc: e.target.value })} 
          />
        </div>
      </Modal>

      {/* Bank Deposit Modal */}
      <Modal isOpen={showBankDeposit} title="Record Bank Deposit" onClose={() => setShowBankDeposit(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowBankDeposit(false)}>Cancel</Button>
          <Button 
            onClick={saveBankDeposit}
            loading={bankDepositLoading}
            disabled={!bankDepositForm.studentId || Number(bankDepositForm.amount) <= 0 || Number(bankDepositForm.amount) > (balances.find(b => b.studentId === bankDepositForm.studentId)?.balance || 0) || !bankDepositForm.proofFile}
          >
            Save Bank Deposit
          </Button>
        </>
      }>
        <div style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-3)", fontSize: "14px" }}>
          Upload proof of bank deposit to record payment pending verification.
        </div>
        <div style={{ background: "var(--color-info-muted)", border: "1px solid var(--color-info-border)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-4)", fontSize: "13px", color: "var(--color-info)" }}>
          📎 Attach deposit slip, receipt, or transaction confirmation. Payment will be marked as pending until approved.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Select 
            label="Student"
            value={bankDepositForm.studentId} 
            onChange={e => setBankDepositForm({ ...bankDepositForm, studentId: e.target.value })}
            options={balances.map(b => ({ value: b.studentId, label: b.name }))}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Input 
              label="Amount (KES)"
              type="number" 
              value={bankDepositForm.amount}
              onChange={e => setBankDepositForm({ ...bankDepositForm, amount: e.target.value })} 
            />
            {Number(bankDepositForm.amount) > (balances.find(b => b.studentId === bankDepositForm.studentId)?.balance || 0) && (
              <span style={{ color: "var(--color-danger)", fontSize: "12px", marginTop: "4px" }}>Cannot exceed balance</span>
            )}
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Proof of Payment</label>
            <input 
              type="file" 
              onChange={handleFileUpload}
              accept="image/*,.pdf"
              style={{ padding: "var(--space-2) 0", color: "var(--color-text-primary)" }}
            />
          </div>
        </div>
      </Modal>

      {/* Day End Settings Modal */}
      <Modal isOpen={showDayEndSettings} title="Day End Settings" onClose={() => setShowDayEndSettings(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowDayEndSettings(false)}>Close</Button>
          <Button variant="danger" onClick={() => {
            localStorage.removeItem('lastDayClosed');
            setLastDayClosed(null);
            toast('Day closure reset', 'success');
          }}>Reset Day Closure</Button>
        </>
      }>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Input
            label="Business Day End Time"
            type="time"
            value={dayEndTime}
            onChange={(e) => saveDayEndTime(e.target.value)}
          />
          <small style={{ color: "var(--color-text-muted)", fontSize: "12px", display: 'block', marginTop: "var(--space-2)" }}>
            After this time, "Today's Collection" will reset for the next business day.
          </small>
        </div>
        
        <div style={{ padding: "var(--space-3)", background: "var(--color-bg-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)", textTransform: "uppercase", fontWeight: 600 }}>Current Status</div>
          <div style={{ fontSize: "14px", color: "var(--color-text-primary)", lineHeight: 1.6 }}>
            Day ends at: <strong>{dayEndTime}</strong><br/>
            Business date: <strong>{businessToday}</strong><br/>
            Last closed: {lastDayClosed ? new Date(lastDayClosed).toLocaleString() : 'Never'}
          </div>
        </div>
      </Modal>

      {/* RecordPaymentModal Component (External) */}
      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => setShowRecordPaymentModal(false)}
        students={students}
        auth={auth}
        school={school}
        toast={toast}
        onSuccess={(response) => {
          reloadPayments();
          refreshLedgerBalances();
          const sid = String(response.studentId);
          const student = students.find(s => String(s.id || s.student_id) === sid);
          const firstName = student?.firstName || student?.first_name || "";
          const lastName = student?.lastName || student?.last_name || "";
          const studentName = `${firstName} ${lastName}`.trim() || "Student";
          const studentBalance = calculateLedgerBalance(student, studentDiscounts[String(response.studentId)] || []);
          const methodLabels = { 'cash': 'Cash', 'bank_transfer': 'Bank Transfer', 'mpesa_manual': 'M-Pesa Manual' };

          setReceipt({
            studentName: studentName,
            amount: response.amount,
            reference: response.receiptNumber,
            method: methodLabels[response.paymentMethod] || response.paymentMethod,
            date: new Date(response.date).toLocaleDateString(),
            balance: Math.max(0, (studentBalance?.balance || 0) - response.amount)
          });
          setShowReceipt(true);
        }}
      />

      {/* Receipt Modal Component (External) */}
      <PaymentReceipt
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receipt={receipt}
        school={schoolData || school}
      />
    </div>
  );
}

FeesPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  feeStructures: PropTypes.array.isRequired,
  setFeeStructures: PropTypes.func.isRequired,
  payments: PropTypes.array.isRequired,
  setPayments: PropTypes.func.isRequired,
  canEdit: PropTypes.bool.isRequired,
  canViewTotals: PropTypes.bool,
  canDeletePayments: PropTypes.bool,
  toast: PropTypes.func.isRequired,
  linkedStudentId: PropTypes.number,
  school: PropTypes.shape({
    name: PropTypes.string,
    school_name: PropTypes.string,
    logo_url: PropTypes.string,
    motto: PropTypes.string,
    tagline: PropTypes.string,
    address: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
  }),
};
