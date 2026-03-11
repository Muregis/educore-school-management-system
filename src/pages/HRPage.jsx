import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { Pager, Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";

const DEPARTMENTS    = ["Administration","Academic","Finance","Support Staff","Security","Catering","Transport","Library","HR"];
const CONTRACT_TYPES = ["Permanent","Contract","Part-time","Volunteer"];
const LEAVE_TYPES    = ["Annual","Sick","Maternity","Paternity","Compassionate","Study","Unpaid"];
const MONTHS         = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS_TONE    = { active: "success", inactive: "danger", "on-leave": "warning" };
const money  = n => `KES ${Number(n||0).toLocaleString()}`;
const today  = () => new Date().toISOString().slice(0,10);
const PAGE   = 12;
const pager  = (arr, p) => ({ pages: Math.max(1,Math.ceil(arr.length/PAGE)), rows: arr.slice((p-1)*PAGE, p*PAGE) });

const BLANK_STAFF = { fullName:"", email:"", phone:"", department:"Academic", jobTitle:"", contractType:"Permanent", startDate:"", salary:"", status:"active", nationalId:"", notes:"" };
const BLANK_LEAVE = { staffId:"", leaveType:"Annual", fromDate:"", toDate:"", reason:"" };

export default function HRPage({ auth, canEdit, toast }) {
  const [tab, setTab]           = useState("staff");
  const [staff, setStaff]       = useState([]);
  const [leave, setLeave]       = useState([]);
  const [attendance, setAtt]    = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading]   = useState(true);

  // Staff state
  const [showStaff, setShowStaff] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [staffForm, setStaffForm] = useState(BLANK_STAFF);
  const [deptFilter, setDeptFilter] = useState("all");
  const [sPage, setSPage]           = useState(1);

  // Leave state
  const [showLeave, setShowLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState(BLANK_LEAVE);
  const [lPage, setLPage]         = useState(1);

  // Attendance state
  const [attDate, setAttDate]   = useState(today());
  const [bulkAtt, setBulkAtt]   = useState([]);
  const [attSaving, setAttSaving] = useState(false);

  // Payroll state
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear]   = useState(new Date().getFullYear());
  const [generating, setGen]    = useState(false);
  const [pPage, setPPage]       = useState(1);

  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const s = await apiFetch("/hr/staff", { token: auth.token });
      setStaff(Array.isArray(s) ? s : []);
    } catch (e) { toast(e.message, "error"); }
    try {
      const l = await apiFetch("/hr/leave", { token: auth.token });
      setLeave(Array.isArray(l) ? l : []);
    } catch { /* table may not exist yet */ }
    try {
      const a = await apiFetch("/hr/attendance", { token: auth.token });
      setAtt(Array.isArray(a) ? a : []);
    } catch { /* table may not exist yet */ }
    try {
      const p = await apiFetch("/hr/payslips", { token: auth.token });
      setPayslips(Array.isArray(p) ? p : []);
    } catch { /* table may not exist yet */ }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (auth?.token) load(); }, [auth]);

  // Init bulk attendance when date changes
  useEffect(() => {
    const existing = attendance.filter(a => a.attendance_date?.slice(0,10) === attDate);
    const bulk = staff.filter(s => s.status === "active").map(s => {
      const rec = existing.find(a => a.staff_id === s.staff_id);
      return { staffId: s.staff_id, name: s.full_name, dept: s.department,
               status: rec?.status || "present", checkIn: rec?.check_in || "", checkOut: rec?.check_out || "" };
    });
    setBulkAtt(bulk);
  }, [attDate, staff, attendance]);

  // ── Staff CRUD ─────────────────────────────────────────────────────────────
  const saveStaff = async () => {
    setErr("");
    if (!staffForm.fullName || !staffForm.jobTitle) return setErr("Full name and job title are required.");
    try {
      if (editStaff) {
        await apiFetch(`/hr/staff/${editStaff.staff_id}`, { method:"PUT", body:staffForm, token:auth.token });
        toast("Staff updated", "success");
      } else {
        await apiFetch("/hr/staff", { method:"POST", body:staffForm, token:auth.token });
        toast("Staff added", "success");
      }
      setShowStaff(false); setEditStaff(null); setStaffForm(BLANK_STAFF); load();
    } catch(e) { setErr(e.message); }
  };

  const deleteStaff = async (id) => {
    if (!window.confirm("Remove this staff member?")) return;
    try {
      await apiFetch(`/hr/staff/${id}`, { method:"DELETE", token:auth.token });
      setStaff(prev => prev.filter(s => s.staff_id !== id));
      toast("Removed", "success");
    } catch(e) { toast(e.message, "error"); }
  };

  // ── Leave ──────────────────────────────────────────────────────────────────
  const saveLeave = async () => {
    setErr("");
    if (!leaveForm.staffId || !leaveForm.fromDate || !leaveForm.toDate) return setErr("Staff, from date and to date are required.");
    try {
      await apiFetch("/hr/leave", { method:"POST", body:leaveForm, token:auth.token });
      toast("Leave request added", "success");
      setShowLeave(false); setLeaveForm(BLANK_LEAVE); load();
    } catch(e) { setErr(e.message); }
  };

  const updateLeave = async (id, status) => {
    try {
      await apiFetch(`/hr/leave/${id}`, { method:"PATCH", body:{ status }, token:auth.token });
      setLeave(prev => prev.map(l => l.leave_id === id ? { ...l, status } : l));
      toast(`Leave ${status}`, "success");
    } catch(e) { toast(e.message, "error"); }
  };

  // ── Staff Attendance ───────────────────────────────────────────────────────
  const saveAttendance = async () => {
    setAttSaving(true);
    try {
      await apiFetch("/hr/attendance/bulk", { method:"POST", body:{ date:attDate, records:bulkAtt }, token:auth.token });
      toast(`Attendance saved for ${attDate}`, "success");
      load();
    } catch(e) { toast(e.message, "error"); }
    setAttSaving(false);
  };

  // ── Payroll ────────────────────────────────────────────────────────────────
  const generatePayslips = async () => {
    setGen(true);
    try {
      const res = await apiFetch("/hr/payslips/generate", { method:"POST", body:{ month:payMonth, year:payYear }, token:auth.token });
      toast(`Generated ${res.generated} payslips`, "success");
      load();
    } catch(e) { toast(e.message, "error"); }
    setGen(false);
  };

  const approvePayroll = async () => {
    try {
      await apiFetch("/hr/payslips/approve", { method:"PATCH", body:{ month:payMonth, year:payYear }, token:auth.token });
      toast("Payroll approved", "success"); load();
    } catch(e) { toast(e.message, "error"); }
  };

  const markPaid = async () => {
    try {
      await apiFetch("/hr/payslips/mark-paid", { method:"PATCH", body:{ month:payMonth, year:payYear }, token:auth.token });
      toast("Payroll marked as paid", "success"); load();
    } catch(e) { toast(e.message, "error"); }
  };

  // Print single payslip
  const printPayslip = (p) => {
    const w = window.open("","_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Payslip - ${p.staff_name}</title>
      <style>body{font-family:Arial;padding:32px;max-width:600px;margin:auto}
      h2{color:#1e293b}table{width:100%;border-collapse:collapse;margin:16px 0}
      td,th{padding:8px 12px;border:1px solid #e2e8f0;font-size:13px}
      th{background:#f8fafc;font-weight:600}.total{font-weight:bold;font-size:15px}
      .net{color:#16a34a;font-size:18px;font-weight:800}.header{display:flex;justify-content:space-between}</style>
      </head><body>
      <div class="header"><div><h2>PAYSLIP</h2><p>${MONTHS[p.month-1]} ${p.year}</p></div>
      <div style="text-align:right"><strong>${p.staff_name}</strong><br>${p.job_title}<br>${p.department}<br>ID: ${p.national_id||"—"}</div></div>
      <hr>
      <table>
        <tr><th>Description</th><th>Amount (KES)</th></tr>
        <tr><td>Basic Salary</td><td>${Number(p.basic_salary).toLocaleString()}</td></tr>
        <tr><td>Allowances</td><td>${Number(p.allowances).toLocaleString()}</td></tr>
        <tr><td>Gross Pay</td><td class="total">${(Number(p.basic_salary)+Number(p.allowances)).toLocaleString()}</td></tr>
        <tr><td colspan="2" style="background:#fff8f8;font-weight:600">Deductions</td></tr>
        <tr><td>PAYE</td><td>- ${Number(p.paye).toLocaleString()}</td></tr>
        <tr><td>NHIF</td><td>- ${Number(p.nhif).toLocaleString()}</td></tr>
        <tr><td>NSSF</td><td>- ${Number(p.nssf).toLocaleString()}</td></tr>
        <tr><td>Total Deductions</td><td class="total">- ${Number(p.deductions).toLocaleString()}</td></tr>
        <tr><td><strong>NET PAY</strong></td><td class="net">${Number(p.net_pay).toLocaleString()}</td></tr>
      </table>
      <p style="color:#64748b;font-size:12px">Status: ${p.status.toUpperCase()} ${p.paid_date ? "· Paid: "+p.paid_date : ""}</p>
      <script>window.print();</script></body></html>
    `);
    w.document.close();
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalStaff    = staff.length;
  const activeStaff   = staff.filter(s => s.status === "active").length;
  const onLeave       = staff.filter(s => s.status === "on-leave").length;
  const totalPayroll  = staff.filter(s=>s.status==="active").reduce((s,x)=>s+Number(x.salary||0),0);
  const pendingLeave  = leave.filter(l => l.status === "pending").length;

  const filteredStaff = staff.filter(s => deptFilter === "all" || s.department === deptFilter);
  const { pages:sPages, rows:sRows } = pager(filteredStaff, sPage);
  const { pages:lPages, rows:lRows } = pager(leave, lPage);

  const curPayslips = payslips.filter(p => p.month === payMonth && p.year === payYear);
  const { pages:pPages, rows:pRows } = pager(curPayslips, pPage);

  const attToday = attendance.filter(a => a.attendance_date?.slice(0,10) === attDate);

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding:"8px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
      background: tab===id ? C.accent : "transparent", color: tab===id ? "#fff" : C.textSub,
    }}>{label}</button>
  );

  if (loading) return <Msg text="Loading HR data..." />;

  return (
    <div style={{ padding:4 }}>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Staff",     value:totalStaff,         color:"#3b82f6" },
          { label:"Active",          value:activeStaff,        color:"#22c55e" },
          { label:"On Leave",        value:onLeave,            color:"#f59e0b" },
          { label:"Pending Leave",   value:pendingLeave,       color:"#ec4899" },
          { label:"Monthly Payroll", value:money(totalPayroll),color:"#8b5cf6" },
        ].map(c => (
          <div key={c.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:4, width:"fit-content", flexWrap:"wrap" }}>
        {tabBtn("staff",      "👥 Staff")}
        {tabBtn("leave",      `🏖️ Leave${pendingLeave>0?" ("+pendingLeave+")":""}`)}
        {tabBtn("attendance", "📅 Attendance")}
        {tabBtn("payroll",    "💰 Payroll")}
        {tabBtn("payslips",   "🧾 Payslips")}
      </div>

      {/* ── STAFF TAB ── */}
      {tab === "staff" && (
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <select style={inputStyle} value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}>
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
            </select>
            {canEdit && <Btn onClick={()=>{ setEditStaff(null); setStaffForm(BLANK_STAFF); setErr(""); setShowStaff(true); }}>+ Add Staff</Btn>}
          </div>
          {filteredStaff.length===0 ? <Msg text="No staff found." /> : (
            <>
              <div style={{ overflowX:"auto" }}>
                <Table
                  headers={["Name","Department","Job Title","Contract","Start Date","Salary","Status",""]}
                  rows={sRows.map(s=>[
                    <div key="n"><div style={{fontWeight:700,color:C.text}}>{s.full_name}</div><div style={{fontSize:11,color:C.textMuted}}>{s.email||"—"} · {s.phone||"—"}</div></div>,
                    s.department,
                    s.job_title,
                    <Badge key="ct" text={s.contract_type} tone="info" />,
                    s.start_date?.slice(0,10)||"—",
                    <span key="sal" style={{fontWeight:700,color:"#22c55e"}}>{money(s.salary)}</span>,
                    <Badge key="st" text={s.status} tone={STATUS_TONE[s.status]||"info"} />,
                    canEdit ? (
                      <div key="a" style={{display:"flex",gap:4}}>
                        <Btn size="xs" variant="ghost" onClick={()=>{ setEditStaff(s); setStaffForm({ fullName:s.full_name, email:s.email||"", phone:s.phone||"", department:s.department, jobTitle:s.job_title, contractType:s.contract_type, startDate:s.start_date?.slice(0,10)||"", salary:s.salary||"", status:s.status, nationalId:s.national_id||"", notes:s.notes||"" }); setErr(""); setShowStaff(true); }}>Edit</Btn>
                        <Btn size="xs" variant="danger" onClick={()=>deleteStaff(s.staff_id)}>Remove</Btn>
                      </div>
                    ):null,
                  ])}
                />
              </div>
              <Pager page={sPage} pages={sPages} setPage={setSPage} />
            </>
          )}
        </div>
      )}

      {/* ── LEAVE TAB ── */}
      {tab === "leave" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
            {canEdit && <Btn onClick={()=>{ setLeaveForm(BLANK_LEAVE); setErr(""); setShowLeave(true); }}>+ Add Leave Request</Btn>}
          </div>
          {leave.length===0 ? <Msg text="No leave requests." /> : (
            <>
              <div style={{ overflowX:"auto" }}>
                <Table
                  headers={["Staff","Department","Type","From","To","Days","Reason","Status",""]}
                  rows={lRows.map(l=>{
                    const days = l.from_date && l.to_date ? Math.ceil((new Date(l.to_date)-new Date(l.from_date))/86400000)+1 : "—";
                    return [
                      <span key="n" style={{fontWeight:600,color:C.text}}>{l.staff_name}</span>,
                      l.department,
                      <Badge key="lt" text={l.leave_type} tone="info" />,
                      l.from_date?.slice(0,10),
                      l.to_date?.slice(0,10),
                      days,
                      <span key="r" style={{color:C.textSub,fontSize:12}}>{l.reason||"—"}</span>,
                      <Badge key="s" text={l.status} tone={l.status==="approved"?"success":l.status==="rejected"?"danger":"warning"} />,
                      canEdit && l.status==="pending" ? (
                        <div key="a" style={{display:"flex",gap:4}}>
                          <Btn size="xs" onClick={()=>updateLeave(l.leave_id,"approved")}>Approve</Btn>
                          <Btn size="xs" variant="danger" onClick={()=>updateLeave(l.leave_id,"rejected")}>Reject</Btn>
                        </div>
                      ):null,
                    ];
                  })}
                />
              </div>
              <Pager page={lPage} pages={lPages} setPage={setLPage} />
            </>
          )}
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === "attendance" && (
        <div>
          <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
            <Field label="Date"><input type="date" style={inputStyle} value={attDate} max={today()} onChange={e=>setAttDate(e.target.value)} /></Field>
            <div style={{ color:C.textMuted, fontSize:13 }}>{bulkAtt.length} staff</div>
            {canEdit && <Btn onClick={saveAttendance} disabled={attSaving}>{attSaving?"Saving...":"Save Attendance"}</Btn>}
          </div>

          {bulkAtt.length === 0 ? <Msg text="No active staff found." /> : (
            <div style={{ overflowX:"auto" }}>
              <Table
                headers={["Name","Department","Check In","Check Out","Status"]}
                rows={bulkAtt.map((r,i)=>[
                  <span key="n" style={{fontWeight:600,color:C.text}}>{r.name}</span>,
                  r.dept,
                  canEdit ? <input key="ci" type="time" style={{...inputStyle,width:100}} value={r.checkIn} onChange={e=>setBulkAtt(prev=>prev.map((x,j)=>j===i?{...x,checkIn:e.target.value}:x))} /> : r.checkIn||"—",
                  canEdit ? <input key="co" type="time" style={{...inputStyle,width:100}} value={r.checkOut} onChange={e=>setBulkAtt(prev=>prev.map((x,j)=>j===i?{...x,checkOut:e.target.value}:x))} /> : r.checkOut||"—",
                  canEdit ? (
                    <select key="s" style={inputStyle} value={r.status} onChange={e=>setBulkAtt(prev=>prev.map((x,j)=>j===i?{...x,status:e.target.value}:x))}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="half-day">Half Day</option>
                      <option value="on-leave">On Leave</option>
                    </select>
                  ) : <Badge key="s" text={r.status} tone={r.status==="present"?"success":r.status==="absent"?"danger":"warning"} />,
                ])}
              />
            </div>
          )}

          {/* Past attendance records */}
          {attToday.length > 0 && (
            <div style={{ marginTop:20 }}>
              <div style={{ fontWeight:700, color:C.text, marginBottom:8 }}>Saved Records for {attDate}</div>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <Badge text={`Present: ${attToday.filter(a=>a.status==="present").length}`} tone="success" />
                <Badge text={`Absent: ${attToday.filter(a=>a.status==="absent").length}`} tone="danger" />
                <Badge text={`Late: ${attToday.filter(a=>a.status==="late").length}`} tone="warning" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {tab === "payroll" && (
        <div>
          <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
            <Field label="Month">
              <select style={inputStyle} value={payMonth} onChange={e=>setPayMonth(Number(e.target.value))}>
                {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Year">
              <input type="number" style={{...inputStyle,width:90}} value={payYear} onChange={e=>setPayYear(Number(e.target.value))} />
            </Field>
            {canEdit && (
              <>
                <Btn onClick={generatePayslips} disabled={generating}>{generating?"Generating...":"Generate Payslips"}</Btn>
                {curPayslips.some(p=>p.status==="draft") && <Btn onClick={approvePayroll}>Approve All</Btn>}
                {curPayslips.some(p=>p.status==="approved") && <Btn onClick={markPaid}>Mark as Paid</Btn>}
              </>
            )}
          </div>

          {/* Dept summary */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:C.text, marginBottom:10 }}>
              Payroll Summary — {MONTHS[payMonth-1]} {payYear}
            </div>
            {DEPARTMENTS.map(dept=>{
              const ds = staff.filter(s=>s.department===dept&&s.status==="active");
              const total = ds.reduce((s,x)=>s+Number(x.salary||0),0);
              if (!ds.length) return null;
              return (
                <div key={dept} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ color:C.textSub }}>{dept} <span style={{ color:C.textMuted, fontSize:12 }}>({ds.length})</span></span>
                  <span style={{ fontWeight:700, color:C.text }}>{money(total)}</span>
                </div>
              );
            })}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0 0", fontWeight:800, fontSize:15 }}>
              <span>Total Payroll</span>
              <span style={{ color:"#22c55e" }}>{money(totalPayroll)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYSLIPS TAB ── */}
      {tab === "payslips" && (
        <div>
          <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
            <Field label="Month">
              <select style={inputStyle} value={payMonth} onChange={e=>setPayMonth(Number(e.target.value))}>
                {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Year">
              <input type="number" style={{...inputStyle,width:90}} value={payYear} onChange={e=>setPayYear(Number(e.target.value))} />
            </Field>
            <div style={{ color:C.textMuted, fontSize:13 }}>{curPayslips.length} payslips</div>
          </div>

          {curPayslips.length===0 ? (
            <Msg text={`No payslips for ${MONTHS[payMonth-1]} ${payYear}. Go to Payroll tab and click Generate.`} />
          ) : (
            <>
              <div style={{ overflowX:"auto" }}>
                <Table
                  headers={["Staff","Department","Basic","Allowances","Deductions","Net Pay","Status",""]}
                  rows={pRows.map(p=>[
                    <div key="n"><div style={{fontWeight:700,color:C.text}}>{p.staff_name}</div><div style={{fontSize:11,color:C.textMuted}}>{p.job_title}</div></div>,
                    p.department,
                    money(p.basic_salary),
                    money(p.allowances),
                    <span key="d" style={{color:"#ef4444"}}>-{money(p.deductions)}</span>,
                    <span key="net" style={{fontWeight:800,color:"#22c55e"}}>{money(p.net_pay)}</span>,
                    <Badge key="s" text={p.status} tone={p.status==="paid"?"success":p.status==="approved"?"info":"warning"} />,
                    <Btn key="pr" size="xs" variant="ghost" onClick={()=>printPayslip(p)}>🖨 Print</Btn>,
                  ])}
                />
              </div>
              <Pager page={pPage} pages={pPages} setPage={setPPage} />
            </>
          )}
        </div>
      )}

      {/* ── STAFF MODAL ── */}
      {showStaff && (
        <Modal title={editStaff?"Edit Staff Member":"Add Staff Member"} onClose={()=>{ setShowStaff(false); setEditStaff(null); }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Full Name *"><input style={inputStyle} value={staffForm.fullName} onChange={e=>setStaffForm(f=>({...f,fullName:e.target.value}))} /></Field>
            <Field label="Job Title *"><input style={inputStyle} value={staffForm.jobTitle} onChange={e=>setStaffForm(f=>({...f,jobTitle:e.target.value}))} /></Field>
            <Field label="Email"><input style={inputStyle} value={staffForm.email} onChange={e=>setStaffForm(f=>({...f,email:e.target.value}))} /></Field>
            <Field label="Phone"><input style={inputStyle} value={staffForm.phone} onChange={e=>setStaffForm(f=>({...f,phone:e.target.value}))} /></Field>
            <Field label="National ID"><input style={inputStyle} value={staffForm.nationalId} onChange={e=>setStaffForm(f=>({...f,nationalId:e.target.value}))} /></Field>
            <Field label="Start Date"><input type="date" style={inputStyle} value={staffForm.startDate} onChange={e=>setStaffForm(f=>({...f,startDate:e.target.value}))} /></Field>
            <Field label="Monthly Salary (KES)"><input type="number" style={inputStyle} value={staffForm.salary} onChange={e=>setStaffForm(f=>({...f,salary:e.target.value}))} /></Field>
            <Field label="Department">
              <select style={inputStyle} value={staffForm.department} onChange={e=>setStaffForm(f=>({...f,department:e.target.value}))}>
                {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Contract Type">
              <select style={inputStyle} value={staffForm.contractType} onChange={e=>setStaffForm(f=>({...f,contractType:e.target.value}))}>
                {CONTRACT_TYPES.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={staffForm.status} onChange={e=>setStaffForm(f=>({...f,status:e.target.value}))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>Notes</div>
            <textarea style={{...inputStyle,width:"100%",height:56,resize:"vertical"}} value={staffForm.notes} onChange={e=>setStaffForm(f=>({...f,notes:e.target.value}))} />
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="ghost" onClick={()=>{ setShowStaff(false); setEditStaff(null); }}>Cancel</Btn>
            <Btn onClick={saveStaff}>{editStaff?"Update":"Add Staff"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── LEAVE MODAL ── */}
      {showLeave && (
        <Modal title="Add Leave Request" onClose={()=>setShowLeave(false)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Staff Member">
              <select style={inputStyle} value={leaveForm.staffId} onChange={e=>setLeaveForm(f=>({...f,staffId:e.target.value}))}>
                <option value="">-- Select staff --</option>
                {staff.filter(s=>s.status!=="inactive").map(s=>(
                  <option key={s.staff_id} value={s.staff_id}>{s.full_name} — {s.department}</option>
                ))}
              </select>
            </Field>
            <Field label="Leave Type">
              <select style={inputStyle} value={leaveForm.leaveType} onChange={e=>setLeaveForm(f=>({...f,leaveType:e.target.value}))}>
                {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="From Date"><input type="date" style={inputStyle} value={leaveForm.fromDate} onChange={e=>setLeaveForm(f=>({...f,fromDate:e.target.value}))} /></Field>
            <Field label="To Date"><input type="date" style={inputStyle} value={leaveForm.toDate} min={leaveForm.fromDate} onChange={e=>setLeaveForm(f=>({...f,toDate:e.target.value}))} /></Field>
            <Field label="Reason" style={{ gridColumn:"span 2" }}>
              <input style={inputStyle} value={leaveForm.reason} onChange={e=>setLeaveForm(f=>({...f,reason:e.target.value}))} placeholder="Optional reason" />
            </Field>
          </div>
          {err && <Msg text={err} tone="error" />}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <Btn variant="ghost" onClick={()=>setShowLeave(false)}>Cancel</Btn>
            <Btn onClick={saveLeave}>Submit</Btn>
          </div>
        </Modal>
      )}

    </div>
  );
}

HRPage.propTypes = {
  auth:    PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  toast:   PropTypes.func.isRequired,
};
