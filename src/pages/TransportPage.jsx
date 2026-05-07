import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

export default function TransportPage({ auth, canEdit, toast, students }) {
  const [tab, setTab]           = useState("routes");
  const [routes, setRoutes]     = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showRoute, setShowRoute]   = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [viewRouteStudents, setViewRouteStudents] = useState(null);
  const [rf, setRf] = useState({ routeName: "", driverName: "", vehicleNumber: "", fee: "", status: "active" });
  const [af, setAf] = useState({ studentClass: "", studentId: "", transportId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" });
  const [err, setErr] = useState("");

  // Filter students by class for assignment
  const filteredStudents = af.studentClass ? students.filter(s => (s.className || s.class_name) === af.studentClass) : students;

  const token = auth?.token;

  const load = async () => {
    setLoading(true);
    try {
      const [rData, aData] = await Promise.all([
        apiFetch("/transport/routes",      { token }),
        apiFetch("/transport/assignments", { token }),
      ]);
      setRoutes(rData);
      setAssignments(aData);
    } catch { /* offline — keep existing data */ }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const saveRoute = async () => {
    setErr("");
    if (!rf.routeName) return setErr("Route name is required.");
    try {
      await apiFetch("/transport/routes", {
        method: "POST",
        body: {
          routeName:     rf.routeName,
          driverName:    rf.driverName    || null,
          vehicleNumber: rf.vehicleNumber || null,
          fee:           Number(rf.fee)   || 0,
          status:        rf.status,
        },
        token,
      });
      setShowRoute(false);
      setRf({ routeName: "", driverName: "", vehicleNumber: "", fee: "", status: "active" });
      toast("Route saved", "success");
      load();
    } catch (e) { setErr(e.message || "Network error"); }
  };

  const saveAssignment = async () => {
    setErr("");
    if (!af.studentId || !af.transportId || !af.startDate)
      return setErr("Student ID, route and start date required.");
    try {
      await apiFetch("/transport/assignments", {
        method: "POST",
        body: {
          studentId:   Number(af.studentId),
          transportId: Number(af.transportId),
          startDate:   af.startDate,
          endDate:     af.endDate || null,
          status:      af.status,
        },
        token,
      });
      setShowAssign(false);
      setAf({ studentClass: "", studentId: "", transportId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" });
      toast("Student assigned", "success");
      load();
    } catch (e) { setErr(e.message || "Network error"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button variant={tab === "routes" ? "primary" : "secondary"} onClick={() => setTab("routes")}>
          Routes ({routes.length})
        </Button>
        <Button variant={tab === "assignments" ? "primary" : "secondary"} onClick={() => setTab("assignments")}>
          Assignments ({assignments.length})
        </Button>
      </div>

      {tab === "routes" && (
        <Card style={{ padding: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>Transport Routes</h3>
            {canEdit && <Button onClick={() => setShowRoute(true)}>+ Add Route</Button>}
          </div>
          
          {loading ? (
            <EmptyState icon="⏳" title="Loading Routes" description="Loading transport routes..." />
          ) : routes.length === 0 ? (
            <EmptyState icon="🚌" title="No Routes Found" description="There are no transport routes configured yet." />
          ) : (
            <div style={{ margin: "calc(var(--space-3) * -1)", marginTop: 0 }}>
              <Table
                headers={["Route", "Driver", "Vehicle", "Fee (KES)", "Students", "Status", "Actions"]}
                data={routes.map(r => {
                  const routeAssignments = assignments.filter(a => a.transport_id === r.transport_id && a.status === "active");
                  return [
                    <span key={r.transport_id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{r.route_name}</span>,
                    <span key="driver" style={{ color: "var(--color-text-secondary)" }}>{r.driver_name || "-"}</span>,
                    <span key="vehicle" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{r.vehicle_number || "-"}</span>,
                    <span key="fee" style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{Number(r.fee || 0).toLocaleString()}</span>,
                    <Badge key="sb" text={`${routeAssignments.length} students`} variant="info" />,
                    <Badge key="s" text={r.status} variant={r.status === "active" ? "success" : "danger"} />,
                    <Button key="action" size="sm" variant="secondary" onClick={() => setViewRouteStudents(r)}>View Students</Button>,
                  ];
                })}
              />
            </div>
          )}
        </Card>
      )}

      {tab === "assignments" && (
        <Card style={{ padding: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>Student Transport Assignments</h3>
            {canEdit && <Button onClick={() => setShowAssign(true)}>+ Assign Student</Button>}
          </div>
          
          {loading ? (
            <EmptyState icon="⏳" title="Loading Assignments" description="Loading student assignments..." />
          ) : assignments.length === 0 ? (
            <EmptyState icon="👨‍🎓" title="No Assignments" description="No students have been assigned to transport routes yet." />
          ) : (
            <div style={{ margin: "calc(var(--space-3) * -1)", marginTop: 0 }}>
              <Table
                headers={["Student", "Admission", "Class", "Route", "Transport Fee", "Paid", "Start Date", "End Date", "Status"]}
                data={assignments.map(a => {
                  const student = a.student || {};
                  const route = a.route || {};
                  const routeFee = route.fee || 0;
                  return [
                    <span key={a.id} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{student.first_name || student.firstName || "Unknown"} {student.last_name || student.lastName || ""}</span>,
                    <span key="adm" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{student.admission_number || student.admission || "-"}</span>,
                    <span key="cls" style={{ color: "var(--color-text-secondary)" }}>{student.class_name || student.className || "-"}</span>,
                    <span key="rt" style={{ color: "var(--color-text-primary)" }}>{route.route_name || "-"}</span>,
                    <span key="fee" style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{Number(routeFee).toLocaleString()}</span>,
                    <Badge key="p" text="Check Fees" variant="info" />,
                    <span key="start" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{a.start_date?.slice(0, 10) || "-"}</span>,
                    <span key="end" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{a.end_date?.slice(0, 10) || "-"}</span>,
                    <Badge key="s" text={a.status} variant={a.status === "active" ? "success" : "danger"} />,
                  ];
                })}
              />
            </div>
          )}
        </Card>
      )}

      {showRoute && (
        <Modal title="Add Transport Route" onClose={() => setShowRoute(false)} footer={
          <>
            <Button variant="ghost" onClick={() => setShowRoute(false)}>Cancel</Button>
            <Button onClick={saveRoute}>Save Route</Button>
          </>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Input 
              label="Route Name *"
              value={rf.routeName}
              onChange={e => setRf({ ...rf, routeName: e.target.value })}
              placeholder="e.g. Westlands Route" 
            />
            
            <Input 
              label="Driver Name"
              value={rf.driverName}
              onChange={e => setRf({ ...rf, driverName: e.target.value })} 
            />
            
            <Input 
              label="Vehicle Number"
              value={rf.vehicleNumber}
              onChange={e => setRf({ ...rf, vehicleNumber: e.target.value })}
              placeholder="e.g. KCA 123A" 
            />
            
            <Input 
              label="Fee (KES)"
              type="number" 
              value={rf.fee}
              onChange={e => setRf({ ...rf, fee: e.target.value })} 
            />
            
            <Select 
              label="Status"
              value={rf.status} 
              onChange={e => setRf({ ...rf, status: e.target.value })}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" }
              ]}
            />
          </div>
          {err && <div style={{ color: "var(--color-danger)", fontSize: "12px", margin: "12px 0 0 0", fontWeight: 500 }}>{err}</div>}
        </Modal>
      )}

      {showAssign && (
        <Modal title="Assign Student to Route" onClose={() => setShowAssign(false)} footer={
          <>
            <Button variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={saveAssignment}>Assign Student</Button>
          </>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <Select 
                label="Class Filter"
                value={af.studentClass} 
                onChange={e => setAf({ ...af, studentClass: e.target.value, studentId: "" })}
                options={[
                  { value: "", label: "All Classes" },
                  ...ALL_CLASSES.map(c => ({ value: c, label: c }))
                ]}
              />
              
              <Select 
                label="Student *"
                value={af.studentId} 
                onChange={e => setAf({ ...af, studentId: e.target.value })}
                options={[
                  { value: "", label: "-- Select Student --" },
                  ...filteredStudents.map(s => ({
                    value: s.id ?? s.student_id,
                    label: `${s.firstName || s.first_name} ${s.lastName || s.last_name} (${s.admission_number || s.admission})`
                  }))
                ]}
              />
            </div>
            
            <div style={{ gridColumn: "1 / -1" }}>
              <Select 
                label="Transport Route *"
                value={af.transportId}
                onChange={e => setAf({ ...af, transportId: e.target.value })}
                options={[
                  { value: "", label: "-- Select route --" },
                  ...routes.map(r => ({ value: r.transport_id, label: r.route_name }))
                ]}
              />
            </div>
            
            <Input 
              label="Start Date *"
              type="date" 
              value={af.startDate}
              onChange={e => setAf({ ...af, startDate: e.target.value })} 
            />
            
            <Input 
              label="End Date"
              type="date" 
              value={af.endDate}
              onChange={e => setAf({ ...af, endDate: e.target.value })} 
            />
            
            <Select 
              label="Status"
              value={af.status} 
              onChange={e => setAf({ ...af, status: e.target.value })}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" }
              ]}
            />
          </div>
          {err && <div style={{ color: "var(--color-danger)", fontSize: "12px", margin: "12px 0 0 0", fontWeight: 500 }}>{err}</div>}
        </Modal>
      )}

      {viewRouteStudents && (
        <Modal title={`Students on ${viewRouteStudents.route_name}`} onClose={() => setViewRouteStudents(null)} footer={
          <Button onClick={() => setViewRouteStudents(null)}>Close</Button>
        }>
          {(() => {
            const routeAssignments = assignments.filter(a => a.transport_id === viewRouteStudents.transport_id && a.status === "active");
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {canEdit && (
                  <div>
                    <Button variant="secondary" onClick={() => {
                      setAf({ studentClass: "", studentId: "", transportId: viewRouteStudents.transport_id, startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" });
                      setViewRouteStudents(null);
                      setShowAssign(true);
                    }}>+ Add Student to this Route</Button>
                  </div>
                )}
                
                {routeAssignments.length === 0 ? (
                  <EmptyState icon="🪑" title="No Students" description="No students currently assigned to this route." />
                ) : (
                  <Card style={{ padding: 0, overflow: "hidden", margin: "0 calc(var(--space-4) * -1)" }}>
                    <Table
                      headers={["Student", "Admission", "Class", "Parent Phone", "Start Date"]}
                      data={routeAssignments.map(a => {
                        const student = a.student || {};
                        return [
                          <span key="name" style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{student.first_name || student.firstName || "Unknown"} {student.last_name || student.lastName || ""}</span>,
                          <span key="adm" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{student.admission_number || student.admission || "-"}</span>,
                          <span key="cls" style={{ color: "var(--color-text-secondary)" }}>{student.class_name || student.className || "-"}</span>,
                          <span key="phone" style={{ color: "var(--color-text-secondary)" }}>{student.parent_phone || student.parentPhone || "-"}</span>,
                          <span key="date" style={{ color: "var(--color-text-secondary)" }}>{a.start_date?.slice(0, 10) || "-"}</span>,
                        ];
                      })}
                    />
                  </Card>
                )}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

TransportPage.propTypes = {
  auth:    PropTypes.object,
  canEdit: PropTypes.bool,
  toast:   PropTypes.func.isRequired,
  students: PropTypes.array,
};
