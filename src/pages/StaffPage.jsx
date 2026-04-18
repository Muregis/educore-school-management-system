import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { csv } from "../lib/utils";

const DEPT_COLORS = {
  Academic:"#3b82f6", Administration:"#8b5cf6", Finance:"#22c55e",
  HR:"#a855f7", Library:"#f59e0b", Transport:"#ec4899",
  Security:"#ef4444", "Support Staff":"#6b7280", Catering:"#f97316",
};

const CONTRACT_TYPES = ["Permanent","Contract","Part-time","Volunteer"];
const DEPARTMENTS    = ["Administration","Academic","Finance","HR","Library","Transport","Security","Support Staff","Catering"];

function money(n) { return `KES ${Number(n||0).toLocaleString()}`; }

function LabelInput({ label, value, onChange, type="text", placeholder="" }) {
  return (
    <div>
      <div style={{ fontSize:11, color:C.textMuted, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle }}
      />
    </div>
  );
}
LabelInput.propTypes = { label:PropTypes.string, value:PropTypes.any, onChange:PropTypes.func, type:PropTypes.string, placeholder:PropTypes.string };

function LabelSelect({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize:11, color:C.textMuted, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle }}>
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}
LabelSelect.propTypes = { label:PropTypes.string, value:PropTypes.any, onChange:PropTypes.func, options:PropTypes.array };

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
  const set = k => v => setForm(f => ({ ...f, [k]: v }));

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

  if (loading) return <div style={{ color:C.textMuted, padding:32, textAlign:"center" }}>Loading staff...</div>;

  return (
    <div>
      {/* Stats */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        {[
          { label:"Total Staff",     value:staff.length,                                    color:"#3b82f6" },
          { label:"Active",          value:staff.filter(s=>s.status==="active").length,     color:"#22c55e" },
          { label:"On Leave",        value:staff.filter(s=>s.status==="on-leave").length,   color:"#f59e0b" },
          { label:"Monthly Payroll", value:money(totalPayroll),                             color:"#8b5cf6" },
        ].map(c => (
          <div key={c.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 20px", minWidth:140 }}>
            <div style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Dept chips */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <div onClick={()=>setFilter("all")} style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", background:filter==="all"?C.accent:C.card, color:filter==="all"?"#fff":C.textSub, border:`1px solid ${filter==="all"?"transparent":C.border}` }}>
          All
        </div>
        {byDept.map(d => (
          <div key={d.dept} onClick={()=>setFilter(filter===d.dept?"all":d.dept)} style={{ padding:"4px 12px", borderRadius:20, fontSize:12, cursor:"pointer", background:filter===d.dept?(DEPT_COLORS[d.dept]||C.accent):C.card, color:filter===d.dept?"#fff":C.textSub, border:`1px solid ${filter===d.dept?"transparent":C.border}` }}>
            {d.dept} ({d.count})
          </div>
        ))}
      </div>

      {/* Operations */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:16 }}>
        <h4 style={{ margin:"0 0 12px", color:C.text, fontSize:16 }}>Operations</h4>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <Btn variant="ghost" onClick={exportCSV}>📤 Export CSV</Btn>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search name, email, title..."
          style={{ ...inputStyle, maxWidth:280 }} />
        {canEdit && (
          <Btn onClick={()=>{ setEditing(null); setForm(blank); setShowModal(true); }}>+ Add Staff</Btn>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ color:C.textMuted, padding:48, textAlign:"center", background:C.card, borderRadius:12, border:`1px solid ${C.border}` }}>
          {staff.length === 0 ? "No staff records yet. Click \"+ Add Staff\" to get started." : "No staff match your search."}
        </div>
      ) : (
        <Table
          headers={["Name","Department","Role / Title","Contract","Salary","Status",""]}
          rows={filtered.map(s => [
            <div key="n">
              <div style={{ fontWeight:600, color:C.text }}>{s.full_name}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{s.email||"—"}</div>
              {s.phone && <div style={{ fontSize:11, color:C.textMuted }}>{s.phone}</div>}
            </div>,
            <span key="d" style={{ padding:"2px 10px", borderRadius:12, fontSize:12, background:(DEPT_COLORS[s.department]||"#6b7280")+"22", color:DEPT_COLORS[s.department]||C.textSub }}>
              {s.department}
            </span>,
            s.job_title||"—",
            s.contract_type||"—",
            <strong key="sal" style={{ color:"#22c55e" }}>{money(s.salary)}</strong>,
            <Badge key="st" tone={s.status==="active"?"success":s.status==="on-leave"?"warning":"danger"}>{s.status}</Badge>,
            canEdit && (
              <div key="a" style={{ display:"flex", gap:6 }}>
                <Btn variant="ghost" onClick={()=>{
                  setEditing(s);
                  setForm({ fullName:s.full_name, email:s.email||"", phone:s.phone||"", nationalId:s.national_id||"", department:s.department||"Academic", jobTitle:s.job_title||"", contractType:s.contract_type||"Permanent", startDate:s.start_date?.slice(0,10)||"", salary:s.salary||"", status:s.status||"active", notes:s.notes||"" });
                  setShowModal(true);
                }}>Edit</Btn>
                <Btn variant="danger" onClick={()=>remove(s.staff_id)}>Remove</Btn>
              </div>
            )
          ])}
        />
      )}

      {/* Portal accounts */}
      {users.filter(u=>["teacher","hr","finance","librarian","admin"].includes(u.role)).length > 0 && (
        <div style={{ marginTop:28 }}>
          <div style={{ fontWeight:700, color:C.text, marginBottom:10, fontSize:15 }}>Portal Accounts</div>
          <Table
            headers={["Name","Email / Login","Role","Status"]}
            rows={users.filter(u=>["teacher","hr","finance","librarian","admin"].includes(u.role)).map(u=>[
              u.full_name,
              <div key="e" style={{ fontSize:13 }}>{u.email}</div>,
              <Badge key="r" tone="info">{u.role}</Badge>,
              <Badge key="s" tone={u.status==="active"?"success":"danger"}>{u.status}</Badge>,
            ])}
          />
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editing?"Edit Staff Member":"Add Staff Member"} onClose={()=>{ setShowModal(false); setEditing(null); }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <LabelInput label="Full Name *"           value={form.fullName}     onChange={set("fullName")}     placeholder="e.g. John Kamau" />
            <LabelInput label="Job Title *"           value={form.jobTitle}     onChange={set("jobTitle")}     placeholder="e.g. Class Teacher" />
            <LabelInput label="Email"                 value={form.email}        onChange={set("email")}        type="email" placeholder="john@school.com" />
            <LabelInput label="Phone"                 value={form.phone}        onChange={set("phone")}        type="tel"  placeholder="+254712345678" />
            <LabelInput label="National ID"           value={form.nationalId}   onChange={set("nationalId")}   placeholder="12345678" />
            <LabelInput label="Start Date"            value={form.startDate}    onChange={set("startDate")}    type="date" />
            <LabelInput label="Monthly Salary (KES)"  value={form.salary}       onChange={set("salary")}       type="number" placeholder="0" />
            <LabelSelect label="Department"    value={form.department}   onChange={set("department")}   options={DEPARTMENTS} />
            <LabelSelect label="Contract Type" value={form.contractType} onChange={set("contractType")} options={CONTRACT_TYPES} />
            <LabelSelect label="Status"        value={form.status}       onChange={set("status")}       options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"},{value:"on-leave",label:"On Leave"}]} />
          </div>
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:C.textMuted, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Notes</div>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              style={{ ...inputStyle, height:60, resize:"vertical" }} placeholder="Optional notes..." />
          </div>
          <div style={{ background:"#1e3a5f", border:"1px solid #3b82f6", borderRadius:8, padding:"8px 12px", marginTop:12, fontSize:12, color:"#93c5fd" }}>
            💡 A portal login will be created automatically. Default password is the part before @ in their email.
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
            <Btn variant="ghost" onClick={()=>{ setShowModal(false); setEditing(null); }}>Cancel</Btn>
            <Btn onClick={save}>{editing?"Update Staff":"Add Staff"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

StaffPage.propTypes = { auth:PropTypes.object, canEdit:PropTypes.bool, toast:PropTypes.func.isRequired };
