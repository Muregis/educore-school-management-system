import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { csv } from "../lib/utils";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

const DEPT_COLORS = {
  Academic:"var(--color-info)", 
  Administration:"var(--color-primary)", 
  Finance:"var(--color-success)",
  HR:"#a855f7", 
  Library:"var(--color-warning)", 
  Transport:"#ec4899",
  Security:"var(--color-danger)", 
  "Support Staff":"var(--color-text-muted)", 
  Catering:"#f97316",
};

const CONTRACT_TYPES = ["Permanent","Contract","Part-time","Volunteer"];
const DEPARTMENTS    = ["Administration","Academic","Finance","HR","Library","Transport","Security","Support Staff","Catering"];

function money(n) { return `KES ${Number(n||0).toLocaleString()}`; }

export default function StaffPage({ auth, canEdit, toast }) {
  const [staff, setStaff]         = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);

  const blank = {
    fullName:"", email:"", phone:"", nationalId:"",
    department:"Academic", jobTitle:"", contractType:"Permanent",
    startDate:"", salary:"", status:"active", notes:"",
  };
  const [form, setForm] = useState(blank);

  const load = async (signal) => {
    setLoading(true);
    try {
      const s = await apiFetch("/hr/staff", { token: auth.token, signal });
      setStaff(Array.isArray(s) ? s : []);
    } catch (e) { if (e?.code !== "EABORT") { /**/ } }
    try {
      const u = await apiFetch("/accounts/users", { token: auth.token, signal });
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) { if (e?.code !== "EABORT") { /**/ } }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [auth]);

  const filtered = staff.filter(s => {
    const matchDept   = filter === "all" || s.department === filter;
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.job_title?.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const save = async () => {
    if (!form.fullName.trim()) return toast("Full name is required", "error");
    if (!form.jobTitle.trim()) return toast("Job title is required", "error");
    try {
      if (editing) {
        await apiFetch(`/hr/staff/${editing.staff_id}`, { method:"PUT", body:form, token:auth.token });
        toast("Staff updated", "success");
      } else {
        await apiFetch("/hr/staff", { method:"POST", body:form, token:auth.token });
        toast("Staff added", "success");
      }
      setShowModal(false); setEditing(null); setForm(blank); load();
    } catch (e) { toast(e.message || "Save failed", "error"); }
  };

  const remove = async id => {
    if (!window.confirm("Remove this staff member?")) return;
    try {
      await apiFetch(`/hr/staff/${id}`, { method:"DELETE", token:auth.token });
      setStaff(prev => prev.filter(s => s.staff_id !== id));
      toast("Removed", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const exportCSV = () => {
    csv("staff.csv", 
      ["Full Name", "Email", "Phone", "National ID", "Department", "Job Title", "Contract Type", "Start Date", "Salary", "Status", "Notes"],
      filtered.map(s => [
        s.full_name || "",
        s.email || "",
        s.phone || "",
        s.national_id || "",
        s.department || "",
        s.job_title || "",
        s.contract_type || "",
        s.start_date || "",
        s.salary || "",
        s.status || "",
        s.notes || ""
      ])
    );
    toast("Staff CSV exported", "success");
  };

  const byDept      = DEPARTMENTS.map(d => ({ dept:d, count:staff.filter(s=>s.department===d).length })).filter(d=>d.count>0);
  const totalPayroll = staff.reduce((sum,s) => sum+Number(s.salary||0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
        {[
          { label:"Total Staff",     value:staff.length,                                    color:"var(--color-info)" },
          { label:"Active",          value:staff.filter(s=>s.status==="active").length,     color:"var(--color-success)" },
          { label:"On Leave",        value:staff.filter(s=>s.status==="on-leave").length,   color:"var(--color-warning)" },
          { label:"Monthly Payroll", value:money(totalPayroll),                             color:"var(--color-primary)" },
        ].map(c => (
          <Card key={c.label} style={{ padding:"var(--space-3)" }}>
            <div style={{ fontSize:"12px", color:"var(--color-text-muted)", marginBottom:"4px", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{c.label}</div>
            <div style={{ fontSize:"24px", fontWeight:800, color:c.color }}>{c.value}</div>
          </Card>
        ))}
      </div>

      {/* Operations & Filters */}
      <Card style={{ padding:"var(--space-3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Dept chips */}
          <div style={{ display:"flex", gap:"var(--space-2)", flexWrap:"wrap" }}>
            <div onClick={()=>setFilter("all")} style={{ padding:"4px 12px", borderRadius:"20px", fontSize:"12px", cursor:"pointer", background:filter==="all"?"var(--color-primary)":"var(--color-bg-surface)", color:filter==="all"?"#fff":"var(--color-text-secondary)", border:`1px solid ${filter==="all"?"transparent":"var(--color-border)"}`, fontWeight: 500, transition: "all 0.15s ease" }}>
              All
            </div>
            {byDept.map(d => (
              <div key={d.dept} onClick={()=>setFilter(filter===d.dept?"all":d.dept)} style={{ padding:"4px 12px", borderRadius:"20px", fontSize:"12px", cursor:"pointer", background:filter===d.dept?(DEPT_COLORS[d.dept]||"var(--color-primary)"):"var(--color-bg-surface)", color:filter===d.dept?"#fff":"var(--color-text-secondary)", border:`1px solid ${filter===d.dept?"transparent":"var(--color-border)"}`, fontWeight: 500, transition: "all 0.15s ease" }}>
                {d.dept} ({d.count})
              </div>
            ))}
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: "250px" }}>
              <Input 
                value={search} 
                onChange={e=>setSearch(e.target.value)}
                placeholder="Search name, email, title..."
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="secondary" onClick={exportCSV}>📤 Export CSV</Button>
              {canEdit && (
                <Button onClick={()=>{ setEditing(null); setForm(blank); setShowModal(true); }}>+ Add Staff</Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <EmptyState icon="⏳" title="Loading Staff Directory" description="Please wait while we load staff records..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👩‍💼" title="No Staff Found" description={search || filter !== "all" ? "No staff match your search criteria." : "No staff records yet. Click '+ Add Staff' to get started."} />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Name","Department","Role / Title","Contract","Salary","Status","Actions"]}
            data={filtered.map(s => [
              <div key="n">
                <div style={{ fontWeight:600, color:"var(--color-text-primary)" }}>{s.full_name}</div>
                <div style={{ fontSize:"12px", color:"var(--color-text-secondary)" }}>{s.email||"—"}</div>
                {s.phone && <div style={{ fontSize:"12px", color:"var(--color-text-secondary)" }}>{s.phone}</div>}
              </div>,
              <span key="d" style={{ padding:"4px 10px", borderRadius:"12px", fontSize:"12px", background:(DEPT_COLORS[s.department]||"var(--color-text-muted)")+"22", color:DEPT_COLORS[s.department]||"var(--color-text-secondary)", fontWeight: 600 }}>
                {s.department}
              </span>,
              <span key="role" style={{ color: "var(--color-text-secondary)" }}>{s.job_title||"—"}</span>,
              <span key="contract" style={{ color: "var(--color-text-secondary)" }}>{s.contract_type||"—"}</span>,
              <strong key="sal" style={{ color:"var(--color-success)" }}>{money(s.salary)}</strong>,
              <Badge key="st" variant={s.status==="active"?"success":s.status==="on-leave"?"warning":"danger"} text={s.status} />,
              <div key="a" style={{ display:"flex", flexWrap: "wrap", gap:"var(--space-2)" }}>
                {canEdit ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={()=>{
                      setEditing(s);
                      setForm({ fullName:s.full_name, email:s.email||"", phone:s.phone||"", nationalId:s.national_id||"", department:s.department||"Academic", jobTitle:s.job_title||"", contractType:s.contract_type||"Permanent", startDate:s.start_date?.slice(0,10)||"", salary:s.salary||"", status:s.status||"active", notes:s.notes||"" });
                      setShowModal(true);
                    }}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={()=>remove(s.staff_id)}>Remove</Button>
                  </>
                ) : (
                  <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>View Only</span>
                )}
              </div>
            ])}
          />
        </Card>
      )}

      {/* Portal accounts */}
      {users.filter(u=>["teacher","hr","finance","librarian","admin"].includes(u.role)).length > 0 && !loading && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-base)" }}>
            <div style={{ fontWeight:700, color:"var(--color-text-primary)", fontSize:"16px" }}>Portal Accounts</div>
          </div>
          <Table
            headers={["Name","Email / Login","Role","Status"]}
            data={users.filter(u=>["teacher","hr","finance","librarian","admin"].includes(u.role)).map(u=>[
              <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{u.full_name}</span>,
              <div key="e" style={{ fontSize:"13px", color: "var(--color-text-secondary)" }}>{u.email}</div>,
              <Badge key="r" variant="info" text={u.role} />,
              <Badge key="s" variant={u.status==="active"?"success":"danger"} text={u.status} />,
            ])}
          />
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} title={editing?"Edit Staff Member":"Add Staff Member"} onClose={()=>{ setShowModal(false); setEditing(null); }} footer={
        <>
          <Button variant="ghost" onClick={()=>{ setShowModal(false); setEditing(null); }}>Cancel</Button>
          <Button onClick={save}>{editing?"Update Staff":"Add Staff"}</Button>
        </>
      }>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"var(--space-4)" }}>
          <Input label="Full Name *"           value={form.fullName}     onChange={v => setForm(f => ({...f, fullName: v.target.value}))}     placeholder="e.g. John Kamau" />
          <Input label="Job Title *"           value={form.jobTitle}     onChange={v => setForm(f => ({...f, jobTitle: v.target.value}))}     placeholder="e.g. Class Teacher" />
          <Input label="Email"                 value={form.email}        onChange={v => setForm(f => ({...f, email: v.target.value}))}        type="email" placeholder="john@school.com" />
          <Input label="Phone"                 value={form.phone}        onChange={v => setForm(f => ({...f, phone: v.target.value}))}        type="tel"  placeholder="+254712345678" />
          <Input label="National ID"           value={form.nationalId}   onChange={v => setForm(f => ({...f, nationalId: v.target.value}))}   placeholder="12345678" />
          <Input label="Start Date"            value={form.startDate}    onChange={v => setForm(f => ({...f, startDate: v.target.value}))}    type="date" />
          <Input label="Monthly Salary (KES)"  value={form.salary}       onChange={v => setForm(f => ({...f, salary: v.target.value}))}       type="number" placeholder="0" />
          
          <Select 
            label="Department"    
            value={form.department}   
            onChange={e => setForm(f => ({...f, department: e.target.value}))}   
            options={DEPARTMENTS.map(d => ({ value: d, label: d }))} 
          />
          <Select 
            label="Contract Type" 
            value={form.contractType} 
            onChange={e => setForm(f => ({...f, contractType: e.target.value}))} 
            options={CONTRACT_TYPES.map(c => ({ value: c, label: c }))} 
          />
          <Select 
            label="Status"        
            value={form.status}       
            onChange={e => setForm(f => ({...f, status: e.target.value}))}       
            options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"},{value:"on-leave",label:"On Leave"}]} 
          />
          
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
            <label style={{ fontSize:"12px", color:"var(--color-text-secondary)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>Notes</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              style={{ width: "100%", padding: "var(--space-3)", background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "14px", height: 80, resize:"vertical" }} placeholder="Optional notes..." />
          </div>
          
          <div style={{ gridColumn: "1 / -1", background:"var(--color-primary-muted)", border:"1px solid var(--color-primary)", borderRadius:"var(--radius-md)", padding:"var(--space-2) var(--space-3)", fontSize:"13px", color:"var(--color-text-primary)" }}>
            💡 A portal login will be created automatically. Default password is the part before @ in their email.
          </div>
        </div>
      </Modal>
    </div>
  );
}

StaffPage.propTypes = { auth:PropTypes.object, canEdit:PropTypes.bool, toast:PropTypes.func.isRequired };
