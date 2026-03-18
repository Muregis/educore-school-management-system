import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { ALL_CLASSES } from "../lib/constants";
import { C, inputStyle } from "../lib/theme";
import { money } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { Msg } from "../components/Helpers";

// Inline helpers (unchanged)
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
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", cursor: page === 1 ? "default" : "pointer" }}>‹</button>
      <span style={{ padding: "4px 10px", fontSize: 13, color: "#94a3b8" }}>{page} / {pages}</span>
      <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", cursor: page === pages ? "default" : "pointer" }}>›</button>
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

// Load Paystack inline script once (unchanged)
function loadPaystackScript() {
  return new Promise(resolve => {
    if (window.PaystackPop) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

export default function FeesPage({ auth, students, feeStructures, setFeeStructures, payments, setPayments, canEdit, toast, linkedStudentId }) {
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
  const [filterClass, setFilterClass] = useState("all");
  const [page, setPage]               = useState(1);
  const [paymentForm, setPaymentForm] = useState({ studentId: students[0]?.id || "", amount: "", feeType: "tuition", method: "cash", date: new Date().toISOString().slice(0,10), status: "paid", paidBy: "" });
  const [structForm, setStructForm]   = useState({ className: "Grade 7", tuition: "", activity: "", misc: "" });

  const reloadPayments = useCallback(async () => {
    if (!auth?.token) return;
    const data = await apiFetch("/payments", { token: auth.token });
    setPayments(data.map(normalisePayment));
  }, [auth, setPayments]);

  // Auto-verify Paystack when redirected back (unchanged)
  useEffect(() => {
    const ref    = localStorage.getItem("ps_pending_ref");
    const name   = localStorage.getItem("ps_pending_name");
    const amount = localStorage.getItem("ps_pending_amount");
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get("reference") || params.get("trxref");
    if (ref && urlRef && auth?.token) {
      localStorage.removeItem("ps_pending_ref");
      localStorage.removeItem("ps_pending_name");
      localStorage.removeItem("ps_pending_amount");
      window.history.replaceState({}, "", window.location.pathname);
      apiFetch(`/paystack/verify/${urlRef}`, { token: auth?.token })
        .then(result => {
          reloadPayments();
          setReceipt({
            studentName: name || "Student",
            amount:      result.amount || amount,
            reference:   urlRef,
            method:      "Paystack (" + (result.channel || "card") + ")",
            date:        new Date().toLocaleDateString(),
          });
          setShowReceipt(true);
          toast("Paystack payment confirmed!", "success");
        })
        .catch(() => toast("Payment received but verification failed — contact admin", "warning"));
    }
  }, [auth, reloadPayments, toast]);

  useEffect(() => {
    if (auth?.token) {
      apiFetch("/payments/fee-structures", { token: auth.token })
        .then(data => setFeeStructures(data.map(normaliseFeeStruct)))
        .catch(e => console.warn("Fee structures:", e));
      reloadPayments().catch(e => console.warn("Payments:", e));
    }
  }, [auth, setFeeStructures, reloadPayments]);

  const normalisedPayments   = payments.map(p => p.payment_id ? normalisePayment(p) : p);
  const normalisedStructures = feeStructures.map(f => f.fee_structure_id ? normaliseFeeStruct(f) : f);

  const expectedByClass = c => {
    const fs = normalisedStructures.find(f => f.className === c);
    return fs ? Number(fs.tuition) + Number(fs.activity) + Number(fs.misc) : 0;
  };

  const balances = students.map(s => {
    const sid  = s.id ?? s.student_id;
    const cls  = s.className ?? s.class_name ?? "";
    const exp  = expectedByClass(cls);
    const paid = normalisedPayments.filter(p => String(p.studentId) === String(sid) && p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
    const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
    const adm  = s.admission ?? s.admission_number ?? "";
    const email = s.email ?? s.parentEmail ?? "";
    return { studentId: sid, name, className: cls, expected: exp, paid, balance: Math.max(0, exp - paid), admissionNumber: adm, email };
  }).filter(b => filterClass === "all" || b.className === filterClass);

  const filteredPayments = normalisedPayments.filter(p => filterClass === "all" || p.className === filterClass);
  const { pages, rows }  = pager(filteredPayments, page);
  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  // ─── Paystack payment ───────────────────────────────────────────────────────
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
          amount,          // ← now custom amount
          studentId:       paystackTarget.studentId,
          studentName:     paystackTarget.name,
          admissionNumber: paystackTarget.admissionNumber,
        },
        token: auth?.token,
      });

      localStorage.setItem("ps_pending_ref",   data.reference);
      localStorage.setItem("ps_pending_name",  paystackTarget.name);
      localStorage.setItem("ps_pending_amount", amount);

      window.location.href = data.authorizationUrl;
    } catch (err) {
      toast(err.message || "Paystack init failed", "error");
    }
    setPaystackLoading(false);
  };

  // ─── Mpesa STK Push ──────────────────────────────────────────────────────────
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

  // ─── Manual payment ─────────────────────────────────────────────────────────
  const savePayment = async () => {
    const sid = Number(paymentForm.studentId);
    const s   = students.find(x => (x.id ?? x.student_id) === sid);
    const amt = Number(paymentForm.amount);
    const balance = balances.find(b => b.studentId === sid)?.balance || 0;

    if (!s)   return toast("Select student", "error");
    if (!amt || amt <= 0) return toast("Amount required", "error");
    if (amt > balance) return toast("Cannot exceed outstanding balance", "error");

    try {
      await apiFetch("/payments", {
        method: "POST",
        body: { 
          studentId: sid, 
          amount: amt, 
          feeType: paymentForm.feeType, 
          paymentMethod: paymentForm.method, 
          paymentDate: paymentForm.date, 
          status: paymentForm.status, 
          paidBy: paymentForm.paidBy || null 
        },
        token: auth?.token,
      });
      await reloadPayments();
      setShowPayment(false);
      const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
      setReceipt({ 
        studentName: name, 
        amount: amt, 
        reference: `CASH-${Date.now()}`, 
        method: paymentForm.method, 
        date: paymentForm.date 
      });
      setShowReceipt(true);
      toast("Payment recorded", "success");
    } catch (err) { toast(err.message || "Payment failed", "error"); }
  };

  const saveStructure = async () => {
    if (!structForm.className) return toast("Class required", "error");
    try {
      await apiFetch("/payments/fee-structures", {
        method: "POST",
        body: { className: structForm.className, term: "Term 2", tuition: Number(structForm.tuition)||0, activity: Number(structForm.activity)||0, misc: Number(structForm.misc)||0 },
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

  const printReceipt = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body {
          font-family: sans-serif;
          padding: 32px;
          max-width: 400px;
          margin: auto
        }
        h2 {
          margin-bottom: 4px
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee
        }
        @media print {
          button {
            display: none
          }
        }
      </style>
      </head><body>
        <h2>Payment Receipt</h2><p style="color: #888">EduCore School Management</p>
        <div class="row"><span>Student</span><strong>${receipt?.studentName}</strong></div>
        <div class="row"><span>Amount</span><strong>KES ${Number(receipt?.amount).toLocaleString()}</strong></div>
        <div class="row"><span>Method</span><strong>${receipt?.method}</strong></div>
        <div class="row"><span>Reference</span><strong>${receipt?.reference}</strong></div>
        <div class="row"><span>Date</span><strong>${receipt?.date}</strong></div>
        <p style="margin-top: 24px; color: #888; font-size: 12px">Thank you for your payment.</p>
        <button onclick="window.print()" style="margin-top: 16px; padding: 8px 16px; cursor: pointer">Print</button>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <Badge text={`Collected: ${money(normalisedPayments.filter(p=>p.status==="paid").reduce((s,p)=>s+Number(p.amount),0))}`} tone="success" />
        <Badge text={`Outstanding: ${money(balances.reduce((s,b)=>s+b.balance,0))}`} tone="warning" />
        <Badge text={`Students: ${students.length}`} tone="info" />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["payments","balances","structure"].map(t => (
          <Btn key={t} variant={tab===t?"primary":"ghost"} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</Btn>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <select style={inputStyle} value={filterClass} onChange={e=>setFilterClass(e.target.value)}>
          <option value="all">All classes</option>
          {ALL_CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
        <Btn variant="ghost" onClick={()=>{
          if (tab==="payments") csv("payments.csv",["Date","Student","Class","Amount","Type","Method","Status","Ref"],filteredPayments.map(p=>[p.date,p.studentName,p.className,p.amount,p.feeType,p.method,p.status,p.reference]));
          if (tab==="balances") csv("balances.csv",["Student","Class","Expected","Paid","Balance"],balances.map(b=>[b.name,b.className,b.expected,b.paid,b.balance]));
          toast("CSV exported","success");
        }}>Export CSV</Btn>
        {canEdit && tab==="payments" && <Btn onClick={()=>setShowPayment(true)}>+ Record Payment</Btn>}
        {canEdit && tab==="structure" && <Btn onClick={()=>{setEditStruct(null);setStructForm({className:"Grade 7",tuition:"",activity:"",misc:""});setShowStruct(true);}}>Set Fee Structure</Btn>}
      </div>

      {/* Payments Tab */}
      {tab==="payments" && (filteredPayments.length===0 ? <Msg text="No payment records." /> : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date","Student","Class","Amount","Method","Paid By","Status","Ref","Actions"]}
              rows={rows.map(p=>[
                p.date,
                <span key={p.id} style={{color:C.text,fontWeight:600}}>{p.studentName}</span>,
                p.className, money(p.amount), p.method,
                <span key="pb" style={{color:C.textSub,fontSize:12}}>{p.paidBy||"—"}</span>,
                <Badge key="st" text={p.status} tone={p.status==="paid"?"success":p.status==="pending"?"warning":"danger"} />,
                <span key="ref" style={{fontSize:11,color:C.textMuted}}>{p.reference||"—"}</span>,
                canEdit && <Btn key="del" variant="danger" onClick={()=>delPayment(p.id)}>Delete</Btn>
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      ))}

      {/* Balances Tab */}
      {tab==="balances" && (balances.length===0 ? <Msg text="No balances available." /> : (
        <div style={{ overflowX: "auto" }}>
          <Table
            headers={["Student","Class","Expected","Paid","Balance","Status","Pay"]}
            rows={balances.map(b=>[
              <span key={b.studentId} style={{color:C.text,fontWeight:600}}>{b.name}</span>,
              b.className, money(b.expected), money(b.paid), money(b.balance),
              b.expected === 0
                ? <Badge key="bdg" text="no structure" tone="info" />
                : <Badge key="bdg" text={b.balance>0?"pending":"cleared"} tone={b.balance>0?"warning":"success"} />,
              b.expected > 0 && b.balance > 0 ? (
                <div key="pay" style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Btn size="small" onClick={() => openPaystack(b)}>💳 Paystack</Btn>
                    <Btn variant="ghost" size="small" onClick={() => openMpesa(b)}>📱 Mpesa</Btn>
                  </div>
                  <Btn variant="ghost" size="small" onClick={() => {
                    setPaymentForm({
                      ...paymentForm,
                      studentId: b.studentId,
                      amount: String(b.balance),
                    });
                    setShowPayment(true);
                  }}>
                    Pay Custom Amount
                  </Btn>
                </div>
              ) : "—"
            ])}
          />
        </div>
      ))}

      {/* Fee Structure Tab */}
      {tab==="structure" && (normalisedStructures.length===0 ? <Msg text="No fee structures set." /> : (
        <div style={{ overflowX: "auto" }}>
          <Table
            headers={["Class","Tuition","Activity","Misc","Total","Actions"]}
            rows={normalisedStructures.map(f=>[
              <span key={f.id} style={{color:C.text,fontWeight:600}}>{f.className}</span>,
              money(f.tuition), money(f.activity), money(f.misc),
              money(Number(f.tuition)+Number(f.activity)+Number(f.misc)),
              canEdit && <Btn key="ed" variant="ghost" onClick={()=>{setEditStruct(f);setStructForm({className:f.className,tuition:String(f.tuition),activity:String(f.activity),misc:String(f.misc)});setShowStruct(true);}}>Edit</Btn>
            ])}
          />
        </div>
      ))}

      {/* Paystack Modal */}
      {showPaystack && paystackTarget && (
        <Modal title={`Pay Online — ${paystackTarget.name}`} onClose={()=>setShowPaystack(false)}>
          <div style={{color:C.textSub,marginBottom:12,fontSize:13}}>
            Outstanding balance: <strong style={{color:C.text}}>{money(paystackTarget.balance)}</strong>
          </div>
          <div style={{background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:10,padding:12,marginBottom:12,fontSize:12,color:"#60a5fa"}}>
            💳 Payment will be processed securely via <strong>Paystack</strong> — supports card, bank transfer & mobile money
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Parent Email (for receipt)">
              <input style={inputStyle} value={paystackForm.email} onChange={e=>setPaystackForm({...paystackForm,email:e.target.value})} placeholder="parent@email.com" />
            </Field>
            <Field label="Amount (KES)">
              <input 
                type="number" 
                min="100" 
                max={paystackTarget.balance} 
                style={inputStyle} 
                value={paystackForm.amount} 
                onChange={e=>setPaystackForm({...paystackForm,amount:e.target.value})} 
              />
              {Number(paystackForm.amount) > paystackTarget.balance && (
                <p style={{color:"red",fontSize:12,marginTop:4}}>Cannot exceed balance</p>
              )}
              {Number(paystackForm.amount) < 100 && (
                <p style={{color:"red",fontSize:12,marginTop:4}}>Minimum KSh 100</p>
              )}
            </Field>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <Btn variant="ghost" onClick={()=>setShowPaystack(false)}>Cancel</Btn>
            <Btn 
              onClick={initiatePaystack} 
              disabled={paystackLoading || !paystackForm.email || Number(paystackForm.amount) < 100 || Number(paystackForm.amount) > paystackTarget.balance}
            >
              {paystackLoading ? "Opening..." : "Open Payment"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Mpesa STK Push Modal */}
      {showMpesa && mpesaTarget && (
        <Modal title={`Mpesa Payment — ${mpesaTarget.name}`} onClose={()=>setShowMpesa(false)}>
          <div style={{color:C.textSub,marginBottom:12,fontSize:13}}>
            Outstanding balance: <strong style={{color:C.text}}>{money(mpesaTarget.balance)}</strong>
          </div>
          <div style={{background:"#052e16",border:"1px solid #16a34a",borderRadius:10,padding:12,marginBottom:12,fontSize:12,color:"#86efac"}}>
            📱 An STK push will be sent to the parent&apos;s phone. They will enter their Mpesa PIN to complete payment.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:4}}>Phone Number</div>
              <input 
                style={{...inputStyle,width:"100%"}} 
                value={mpesaForm.phone}
                onChange={e=>setMpesaForm({...mpesaForm,phone:e.target.value})}
                placeholder="0712345678 or 254712345678" 
              />
            </div>
            <div>
              <div style={{fontSize:12,color:C.textMuted,marginBottom:4}}>Amount (KES)</div>
              <input 
                type="number" 
                min="100" 
                max={mpesaTarget.balance} 
                style={{...inputStyle,width:"100%"}} 
                value={mpesaForm.amount}
                onChange={e=>setMpesaForm({...mpesaForm,amount:e.target.value})} 
              />
              {Number(mpesaForm.amount) > mpesaTarget.balance && (
                <p style={{color:"red",fontSize:12,marginTop:4}}>Cannot exceed balance</p>
              )}
              {Number(mpesaForm.amount) < 100 && (
                <p style={{color:"red",fontSize:12,marginTop:4}}>Minimum KSh 100</p>
              )}
            </div>
          </div>
          {mpesaStatus?.ok && (
            <div style={{background:"#052e16",border:"1px solid #16a34a",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#86efac"}}>
              ✅ STK push sent! Ask parent to check their phone and enter Mpesa PIN.
              <div style={{marginTop:8}}>
                <Btn variant="ghost" onClick={checkMpesaStatus}>🔄 Check Payment Status</Btn>
              </div>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn variant="ghost" onClick={()=>setShowMpesa(false)}>Cancel</Btn>
            {!mpesaStatus?.ok && (
              <Btn 
                onClick={initiateMpesa} 
                disabled={mpesaLoading || !mpesaForm.phone || Number(mpesaForm.amount) < 100 || Number(mpesaForm.amount) > mpesaTarget.balance}
              >
                {mpesaLoading ? "Sending..." : "Send STK Push"}
              </Btn>
            )}
          </div>
        </Modal>
      )}

      {/* Manual Payment Modal */}
      {showPayment && (
        <Modal title="Record Manual Payment" onClose={()=>setShowPayment(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Student">
              <select style={inputStyle} value={paymentForm.studentId} onChange={e=>setPaymentForm({...paymentForm,studentId:Number(e.target.value)})}>
                {students.map(s=>{ 
                  const sid=s.id??s.student_id; 
                  const name=s.firstName?`${s.firstName} ${s.lastName}`:`${s.first_name} ${s.last_name}`; 
                  return <option key={sid} value={sid}>{name}</option>; 
                })}
              </select>
            </Field>
            <Field label="Amount (KES)">
              <input 
                type="number" 
                min="100" 
                max={balances.find(b => b.studentId === paymentForm.studentId)?.balance || 100000} 
                style={inputStyle} 
                value={paymentForm.amount} 
                onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} 
              />
              {Number(paymentForm.amount) > (balances.find(b => b.studentId === paymentForm.studentId)?.balance || 0) && (
                <p style={{color:"red",fontSize:12,marginTop:4}}>Cannot exceed outstanding balance</p>
              )}
              {Number(paymentForm.amount) < 100 && (
                <p style={{color:"red",fontSize:12,marginTop:4}}>Minimum KSh 100</p>
              )}
            </Field>
            <Field label="Type">
              <select style={inputStyle} value={paymentForm.feeType} onChange={e=>setPaymentForm({...paymentForm,feeType:e.target.value})}>
                <option value="tuition">Tuition</option>
                <option value="activity">Activity</option>
                <option value="misc">Misc</option>
              </select>
            </Field>
            <Field label="Method">
              <select style={inputStyle} value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm,method:e.target.value})}>
                <option value="cash">Cash</option>
                <option value="mpesa">Mpesa</option>
                <option value="bank">Bank</option>
              </select>
            </Field>
            <Field label="Date">
              <input type="date" style={inputStyle} value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm,date:e.target.value})} />
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={paymentForm.status} onChange={e=>setPaymentForm({...paymentForm,status:e.target.value})}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </Field>
            <Field label="Paid By (parent/guardian/sponsor)" style={{gridColumn:"1 / -1"}}>
              <input style={inputStyle} value={paymentForm.paidBy} onChange={e=>setPaymentForm({...paymentForm,paidBy:e.target.value})} placeholder="e.g. John Kamau (Father)" />
            </Field>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10}}>
            <Btn variant="ghost" onClick={()=>setShowPayment(false)}>Cancel</Btn>
            <Btn 
              disabled={Number(paymentForm.amount) <= 0 || !paymentForm.studentId || Number(paymentForm.amount) > (balances.find(b => b.studentId === paymentForm.studentId)?.balance || 0)}
              onClick={savePayment}
            >
              Save
            </Btn>
          </div>
        </Modal>
      )}

      {/* Fee Structure Modal */}
      {showStruct && (
        <Modal title={editStruct?"Edit Fee Structure":"Set Fee Structure"} onClose={()=>setShowStruct(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Class">
              <select style={inputStyle} value={structForm.className} onChange={e=>setStructForm({...structForm,className:e.target.value})}>
                {ALL_CLASSES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Tuition">
              <input type="number" style={inputStyle} value={structForm.tuition} onChange={e=>setStructForm({...structForm,tuition:e.target.value})} />
            </Field>
            <Field label="Activity">
              <input type="number" style={inputStyle} value={structForm.activity} onChange={e=>setStructForm({...structForm,activity:e.target.value})} />
            </Field>
            <Field label="Misc">
              <input type="number" style={inputStyle} value={structForm.misc} onChange={e=>setStructForm({...structForm,misc:e.target.value})} />
            </Field>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10}}>
            <Btn variant="ghost" onClick={()=>setShowStruct(false)}>Cancel</Btn>
            <Btn onClick={saveStructure}>Save</Btn>
          </div>
        </Modal>
      )}

      {/* Receipt Modal */}
      {showReceipt && receipt && (
        <Modal title="Payment Receipt" onClose={()=>setShowReceipt(false)}>
          <div style={{background:C.card,borderRadius:12,padding:16}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:32}}>✅</div>
              <div style={{fontWeight:800,fontSize:18,color:C.text}}>Payment Confirmed</div>
            </div>
            <div className="row"><span>Student</span><strong>{receipt?.studentName}</strong></div>
            <div className="row"><span>Amount</span><strong>KES {Number(receipt?.amount).toLocaleString()}</strong></div>
            <div className="row"><span>Method</span><strong>{receipt?.method}</strong></div>
            <div className="row"><span>Reference</span><strong>{receipt?.reference}</strong></div>
            <div className="row"><span>Date</span><strong>{receipt?.date}</strong></div>
            <p style={{marginTop: 24, color: "rgb(136, 136, 136)", fontSize: 12}}>Thank you for your payment.</p>
          </div>
          <div style={{display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12}}>
            <Btn variant="ghost" onClick={()=>setShowReceipt(false)}>Close</Btn>
            <Btn onClick={printReceipt}>🖨 Print</Btn>
          </div>
        </Modal>
      )}
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
  toast: PropTypes.func.isRequired,
  linkedStudentId: PropTypes.number,
};