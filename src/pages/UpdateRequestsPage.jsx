import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { Pager } from "../components/Helpers";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Table from "../components/ui/Table";
import EmptyState from "../components/ui/EmptyState";

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

  const headers = ["Student", "Field", "Old Value", "New Value", "Reason", "Status", "Date"];
  if (isAdmin) {
    headers.push("Actions");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px" }}>
            {isAdmin ? "Student Update Requests" : "My Update Requests"}
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            {isAdmin ? "Review and approve parent update requests" : "Request updates to your child's information"}
          </p>
        </div>
        {isParent && (
          <Button onClick={openRequest}>
            + New Request
          </Button>
        )}
      </div>

      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <Input
              placeholder="Search requests..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div style={{ width: "200px" }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Status" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" }
              ]}
            />
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={isAdmin ? "📋" : "📝"}
          title={isAdmin ? "No Update Requests" : "No Requests Found"}
          description={isAdmin ? "No parent update requests have been submitted yet." : "You haven't submitted any update requests yet."}
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table 
            headers={headers} 
            data={rows.map(row => {
              const student = students.find(s => (s.id ?? s.student_id) === row.studentId);
              const name = student ? `${student.firstName ?? student.first_name} ${student.lastName ?? student.last_name}` : "Unknown";
              
              const tableRow = [
                <span key="name" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{name}</span>,
                <span key="field" style={{ color: "var(--color-text-secondary)" }}>{getFieldName(row.field)}</span>,
                <span key="old" style={{ color: "var(--color-text-muted)" }}>{row.oldValue || "-"}</span>,
                <span key="new" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{row.newValue}</span>,
                <span key="reason" style={{ color: "var(--color-text-secondary)" }}>{row.reason}</span>,
                <Badge 
                  key="status" 
                  text={row.status} 
                  variant={row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"} 
                />,
                <span key="date" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{new Date(row.createdAt).toLocaleDateString()}</span>
              ];
              
              if (isAdmin) {
                tableRow.push(
                  <div key="actions" style={{ display: "flex", gap: "var(--space-1)" }}>
                    {row.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveRequest(row.id)}
                          style={{ background: "var(--color-success)", color: "#ffffff", borderColor: "var(--color-success)" }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const reason = prompt("Please provide reason for rejection:");
                            if (reason) rejectRequest(row.id, reason);
                          }}
                          style={{ background: "var(--color-danger)", color: "#ffffff", borderColor: "var(--color-danger)" }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                );
              }
              
              return tableRow;
            })} 
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      {show && (
        <Modal
          isOpen={show}
          onClose={() => setShow(false)}
          title="Request Information Update"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShow(false)}>
                Cancel
              </Button>
              <Button onClick={saveRequest}>
                Submit Request
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {err && <div style={{ color: "var(--color-danger)", fontSize: "13px", padding: "8px", background: "color-mix(in srgb, var(--color-danger) 15%, transparent)", borderRadius: "var(--radius-md)", border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)" }}>{err}</div>}
            
            <Select
              label="Student *"
              value={f.studentId}
              onChange={(e) => setF({ ...f, studentId: e.target.value })}
              options={[
                { value: "", label: "Select Student" },
                ...myChildren.map(child => ({
                  value: child.id ?? child.student_id,
                  label: `${child.firstName ?? child.first_name} ${child.lastName ?? child.last_name}`
                }))
              ]}
            />

            <Select
              label="Field to Update *"
              value={f.field}
              onChange={(e) => setF({ ...f, field: e.target.value })}
              options={[
                { value: "", label: "Select Field" },
                { value: "parentPhone", label: "Parent Phone Number" },
                { value: "parentName", label: "Parent Name" },
                { value: "emergencyContactName", label: "Emergency Contact Name" },
                { value: "emergencyContactPhone", label: "Emergency Contact Phone" },
                { value: "emergencyContactRelationship", label: "Emergency Contact Relationship" },
                { value: "medicalConditions", label: "Medical Conditions" },
                { value: "allergies", label: "Allergies" },
                { value: "bloodGroup", label: "Blood Group" }
              ]}
            />

            <Input
              label="New Value *"
              value={f.newValue}
              onChange={(e) => setF({ ...f, newValue: e.target.value })}
              placeholder="Enter new value"
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reason for Update *</label>
              <textarea
                value={f.reason}
                onChange={(e) => setF({ ...f, reason: e.target.value })}
                placeholder="Please explain why this update is needed..."
                rows={3}
                style={{ width: "100%", padding: "var(--space-3)", background: "var(--color-bg-base)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-primary)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
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
