import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { genId } from "../lib/utils";
import { apiFetch } from "../lib/api";
import { Pager, Msg } from "../components/Helpers";

export default function UpdateRequestsPage({ auth, students, pendingUpdates, setPendingUpdates, toast }) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Form state for update request
  const [f, setF] = useState({
    studentId: "",
    field: "",
    oldValue: "",
    newValue: "",
    reason: ""
  });

  const isAdmin = auth?.role === "admin";
  const isParent = auth?.role === "parent";

  // Get parent's children for filtering
  const myChildren = useMemo(() => {
    if (!isParent) return [];
    const loginStudent = students.find(s => (s.id ?? s.student_id) === auth?.studentId);
    if (!loginStudent) return [];
    const phone = loginStudent.parentPhone ?? loginStudent.parent_phone ?? "";
    if (!phone) return [loginStudent];
    return students.filter(s => (s.parentPhone ?? s.parent_phone ?? "") === phone && s.status === "active");
  }, [isParent, students, auth]);

  // Filter pending updates based on user role
  const filteredUpdates = useMemo(() => {
    let updates = pendingUpdates;
    
    // Parents can only see their children's update requests
    if (isParent) {
      const myChildIds = myChildren.map(c => c.id ?? c.student_id);
      updates = updates.filter(u => myChildIds.includes(u.studentId));
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      updates = updates.filter(u => u.status === statusFilter);
    }
    
    // Apply search filter
    if (q) {
      updates = updates.filter(u => {
        const student = students.find(s => (s.id ?? s.student_id) === u.studentId);
        const studentName = student ? `${student.firstName ?? student.first_name} ${student.lastName ?? student.last_name}` : "";
        return (
          studentName.toLowerCase().includes(q.toLowerCase()) ||
          u.field.toLowerCase().includes(q.toLowerCase()) ||
          u.reason.toLowerCase().includes(q.toLowerCase())
        );
      });
    }
    
    return updates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [pendingUpdates, isParent, myChildren, statusFilter, q, students]);

  const { pages, rows } = useMemo(() => {
    const itemsPerPage = 10;
    const pages = Math.ceil(filteredUpdates.length / itemsPerPage);
    const start = (page - 1) * itemsPerPage;
    const rows = filteredUpdates.slice(start, start + itemsPerPage);
    return { pages, rows };
  }, [filteredUpdates, page]);

  useEffect(() => { if (page > pages) setPage(1); }, [page, pages]);

  // Load pending updates from server
  useEffect(() => {
    if (!auth?.token) return;
    const ac = new AbortController();
    apiFetch("/students/pending-updates", { token: auth.token, signal: ac.signal })
      .then(data => setPendingUpdates(data || []))
      .catch(e => { if (e?.code !== "EABORT") console.error("Failed to fetch pending updates:", e); });
    return () => ac.abort();
  }, [auth, setPendingUpdates]);

  const openRequest = () => {
    setEditId(null);
    setErr("");
    setF({
      studentId: myChildren[0]?.id ?? myChildren[0]?.student_id ?? "",
      field: "",
      oldValue: "",
      newValue: "",
      reason: ""
    });
    setShow(true);
  };

  const saveRequest = async () => {
    setErr("");
    if (!f.studentId) return setErr("Please select a student.");
    if (!f.field) return setErr("Please select the field to update.");
    if (!f.newValue.trim()) return setErr("Please provide the new value.");
    if (!f.reason.trim()) return setErr("Please provide a reason for the update.");

    try {
      const student = students.find(s => (s.id ?? s.student_id) === f.studentId);
      if (!student) return setErr("Student not found.");

      // Get current value for the field
      let currentValue = "";
      switch (f.field) {
        case "parentPhone":
          currentValue = student.parentPhone ?? student.parent_phone ?? "";
          break;
        case "parentName":
          currentValue = student.parentName ?? student.parent_name ?? "";
          break;
        case "emergencyContactName":
          currentValue = student.emergencyContactName ?? student.emergency_contact_name ?? "";
          break;
        case "emergencyContactPhone":
          currentValue = student.emergencyContactPhone ?? student.emergency_contact_phone ?? "";
          break;
        case "emergencyContactRelationship":
          currentValue = student.emergencyContactRelationship ?? student.emergency_contact_relationship ?? "";
          break;
        case "medicalConditions":
          currentValue = student.medicalConditions ?? student.medical_conditions ?? "";
          break;
        case "allergies":
          currentValue = student.allergies ?? "";
          break;
        case "bloodGroup":
          currentValue = student.bloodGroup ?? student.blood_group ?? "";
          break;
        default:
          currentValue = "";
      }

      const requestBody = {
        studentId: f.studentId,
        field: f.field,
        oldValue: currentValue,
        newValue: f.newValue.trim(),
        reason: f.reason.trim(),
        requestedBy: auth.userId || auth.id,
        requestedByRole: auth.role
      };

      const res = await apiFetch("/students/pending-updates", {
        method: "POST",
        body: requestBody,
        token: auth?.token,
      });

      setPendingUpdates(prev => [...prev, res]);
      setShow(false);
      toast("Update request submitted successfully", "success", "update-request");
      
      // Add notification for admins
      if (isAdmin) {
        // This would typically be handled by the backend
        console.log("Notification: New update request requires approval");
      }
    } catch (err) {
      setErr(err.message || "Failed to submit request");
    }
  };

  const approveRequest = async (updateId) => {
    try {
      await apiFetch(`/students/pending-updates/${updateId}/approve`, {
        method: "POST",
        token: auth?.token,
      });
      
      setPendingUpdates(prev => 
        prev.map(u => u.id === updateId ? { ...u, status: "approved", approvedAt: new Date().toISOString(), approvedBy: auth.userId || auth.id } : u)
      );
      toast("Update request approved", "success", "update-request");
    } catch (err) {
      toast(err.message || "Failed to approve request", "error");
    }
  };

  const rejectRequest = async (updateId, reason) => {
    try {
      await apiFetch(`/students/pending-updates/${updateId}/reject`, {
        method: "POST",
        body: { reason },
        token: auth?.token,
      });
      
      setPendingUpdates(prev => 
        prev.map(u => u.id === updateId ? { ...u, status: "rejected", rejectedAt: new Date().toISOString(), rejectedBy: auth.userId || auth.id, rejectionReason: reason } : u)
      );
      toast("Update request rejected", "success", "update-request");
    } catch (err) {
      toast(err.message || "Failed to reject request", "error");
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: { bg: "#F59E0B18", border: "#F59E0B44", text: "#F59E0B" },
      approved: { bg: "#10B98118", border: "#10B98144", text: "#10B981" },
      rejected: { bg: "#EF444418", border: "#EF444444", text: "#EF4444" }
    };
    const color = colors[status] || colors.pending;
    return (
      <Badge
        style={{
          background: color.bg,
          border: `1px solid ${color.border}`,
          color: color.text,
          textTransform: "capitalize",
          fontSize: 11,
          fontWeight: 600
        }}
      >
        {status}
      </Badge>
    );
  };

  const getFieldName = (field) => {
    const names = {
      parentPhone: "Parent Phone",
      parentName: "Parent Name", 
      emergencyContactName: "Emergency Contact Name",
      emergencyContactPhone: "Emergency Contact Phone",
      emergencyContactRelationship: "Emergency Contact Relationship",
      medicalConditions: "Medical Conditions",
      allergies: "Allergies",
      bloodGroup: "Blood Group"
    };
    return names[field] || field;
  };

  const columns = [
    { header: "Student", key: "student", render: (row) => {
      const student = students.find(s => (s.id ?? s.student_id) === row.studentId);
      return student ? `${student.firstName ?? student.first_name} ${student.lastName ?? student.last_name}` : "Unknown";
    }},
    { header: "Field", key: "field", render: (row) => getFieldName(row.field) },
    { header: "Old Value", key: "oldValue", render: (row) => row.oldValue || "-" },
    { header: "New Value", key: "newValue", render: (row) => row.newValue },
    { header: "Reason", key: "reason", render: (row) => row.reason },
    { header: "Status", key: "status", render: (row) => getStatusBadge(row.status) },
    { header: "Date", key: "createdAt", render: (row) => new Date(row.createdAt).toLocaleDateString() },
  ];

  if (isAdmin) {
    columns.push({
      header: "Actions", 
      key: "actions", 
      render: (row) => (
        <div style={{ display: "flex", gap: 4 }}>
          {row.status === "pending" && (
            <>
              <Btn
                size="xs"
                onClick={() => approveRequest(row.id)}
                style={{ background: "#10B981", border: "#10B981", padding: "4px 8px", fontSize: 11 }}
              >
                Approve
              </Btn>
              <Btn
                size="xs"
                onClick={() => {
                  const reason = prompt("Please provide reason for rejection:");
                  if (reason) rejectRequest(row.id, reason);
                }}
                style={{ background: "#EF4444", border: "#EF4444", padding: "4px 8px", fontSize: 11 }}
              >
                Reject
              </Btn>
            </>
          )}
        </div>
      )
    });
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: C.text, fontSize: 24 }}>
            {isAdmin ? "Student Update Requests" : "My Update Requests"}
          </h2>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 14 }}>
            {isAdmin ? "Review and approve parent update requests" : "Request updates to your child's information"}
          </p>
        </div>
        {isParent && (
          <Btn onClick={openRequest} icon="+" style={{ background: C.accent, border: C.accent }}>
            New Request
          </Btn>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Field
          type="search"
          placeholder="Search requests..."
          value={q}
          onChange={setQ}
          style={{ width: 200, ...inputStyle }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <Msg
          icon={isAdmin ? " clipboard-check" : " edit"}
          title={isAdmin ? "No Update Requests" : "No Requests Found"}
          desc={isAdmin ? "No parent update requests have been submitted yet." : "You haven't submitted any update requests yet."}
        />
      ) : (
        <>
          <Table columns={columns} rows={rows} />
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Request Modal */}
      {show && (
        <Modal
          show={show}
          onHide={() => setShow(false)}
          title="Request Information Update"
          footer={
            <>
              <Btn onClick={() => setShow(false)} style={{ background: C.border, border: C.border }}>
                Cancel
              </Btn>
              <Btn onClick={saveRequest} style={{ background: C.accent, border: C.accent }}>
                Submit Request
              </Btn>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {err && <div style={{ color: C.rose, fontSize: 13, padding: 8, background: "#FEE2E2", borderRadius: 6, border: "1px solid #FECACA" }}>{err}</div>}
            
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: C.text }}>Student</label>
              <select
                value={f.studentId}
                onChange={(e) => setF({ ...f, studentId: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text }}
              >
                <option value="">Select Student</option>
                {myChildren.map(child => (
                  <option key={child.id ?? child.student_id} value={child.id ?? child.student_id}>
                    {child.firstName ?? child.first_name} {child.lastName ?? child.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: C.text }}>Field to Update</label>
              <select
                value={f.field}
                onChange={(e) => setF({ ...f, field: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text }}
              >
                <option value="">Select Field</option>
                <option value="parentPhone">Parent Phone Number</option>
                <option value="parentName">Parent Name</option>
                <option value="emergencyContactName">Emergency Contact Name</option>
                <option value="emergencyContactPhone">Emergency Contact Phone</option>
                <option value="emergencyContactRelationship">Emergency Contact Relationship</option>
                <option value="medicalConditions">Medical Conditions</option>
                <option value="allergies">Allergies</option>
                <option value="bloodGroup">Blood Group</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: C.text }}>New Value</label>
              <input
                type="text"
                value={f.newValue}
                onChange={(e) => setF({ ...f, newValue: e.target.value })}
                placeholder="Enter new value"
                style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: C.text }}>Reason for Update</label>
              <textarea
                value={f.reason}
                onChange={(e) => setF({ ...f, reason: e.target.value })}
                placeholder="Please explain why this update is needed..."
                rows={3}
                style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, color: C.text, resize: "vertical" }}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

UpdateRequestsPage.propTypes = {
  auth: PropTypes.object.isRequired,
  students: PropTypes.array.isRequired,
  pendingUpdates: PropTypes.array.isRequired,
  setPendingUpdates: PropTypes.func.isRequired,
  toast: PropTypes.func.isRequired,
};
