import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ALL_CLASSES } from "../lib/constants";

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
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn variant={tab === "routes"      ? "primary" : "ghost"} onClick={() => setTab("routes")}>
          Routes ({routes.length})
        </Btn>
        <Btn variant={tab === "assignments" ? "primary" : "ghost"} onClick={() => setTab("assignments")}>
          Assignments ({assignments.length})
        </Btn>
      </div>

      {tab === "routes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            {canEdit && <Btn onClick={() => setShowRoute(true)}>+ Add Route</Btn>}
          </div>
          {loading ? <Msg text="Loading..." /> : routes.length === 0 ? <Msg text="No transport routes found." /> : (
            <div style={{ overflowX: "auto" }}>
              <Table
                headers={["Route", "Driver", "Vehicle", "Fee (KES)", "Students", "Status", "Actions"]}
                rows={routes.map(r => {
                  const routeAssignments = assignments.filter(a => a.transport_id === r.transport_id && a.status === "active");
                  return [
                    <span key={r.transport_id} style={{ color: C.text, fontWeight: 600 }}>{r.route_name}</span>,
                    r.driver_name    || "-",
                    r.vehicle_number || "-",
                    Number(r.fee || 0).toLocaleString(),
                    <Badge key="sb" text={`${routeAssignments.length} students`} tone="info" />,
                    <Badge key="s" text={r.status} tone={r.status === "active" ? "success" : "danger"} />,
                    <Btn variant="ghost" onClick={() => setViewRouteStudents(r)}>View Students</Btn>,
                  ];
                })}
              />
            </div>
          )}
        </div>
      )}

      {tab === "assignments" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            {canEdit && <Btn onClick={() => setShowAssign(true)}>+ Assign Student</Btn>}
          </div>
          {loading ? <Msg text="Loading..." /> : assignments.length === 0 ? <Msg text="No assignments found." /> : (
            <div style={{ overflowX: "auto" }}>
              <Table
                headers={["Student", "Admission", "Class", "Route", "Transport Fee", "Paid", "Start Date", "End Date", "Status"]}
                rows={assignments.map(a => {
                  const studentId = a.student_id;
                  const routeFee = a.transport_fee || 0;
                  // For now, we'll need to calculate from payments
                  // This is a placeholder - in real scenario would check payments
                  return [
                    <span key={a.id} style={{ color: C.text, fontWeight: 600 }}>{a.first_name} {a.last_name}</span>,
                    a.admission_number,
                    a.class_name || "-",
                    a.route_name,
                    Number(routeFee).toLocaleString(),
                    <Badge key="p" text="Check Fees" tone="info" />,
                    a.start_date?.slice(0, 10),
                    a.end_date?.slice(0, 10) || "-",
                    <Badge key="s" text={a.status} tone={a.status === "active" ? "success" : "danger"} />,
                  ];
                })}
              />
            </div>
          )}
        </div>
      )}

      {showRoute && (
        <Modal title="Add Transport Route" onClose={() => setShowRoute(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Route Name">
              <input style={inputStyle} value={rf.routeName}
                onChange={e => setRf({ ...rf, routeName: e.target.value })}
                placeholder="e.g. Westlands Route" />
            </Field>
            <Field label="Driver Name">
              <input style={inputStyle} value={rf.driverName}
                onChange={e => setRf({ ...rf, driverName: e.target.value })} />
            </Field>
            <Field label="Vehicle Number">
              <input style={inputStyle} value={rf.vehicleNumber}
                onChange={e => setRf({ ...rf, vehicleNumber: e.target.value })}
                placeholder="e.g. KCA 123A" />
            </Field>
            <Field label="Fee (KES)">
              <input type="number" style={inputStyle} value={rf.fee}
                onChange={e => setRf({ ...rf, fee: e.target.value })} />
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={rf.status} onChange={e => setRf({ ...rf, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          {err && <div style={{ color: "#ef4444", fontSize: 12, margin: "8px 0" }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowRoute(false)}>Cancel</Btn>
            <Btn onClick={saveRoute}>Save Route</Btn>
          </div>
        </Modal>
      )}

      {showAssign && (
        <Modal title="Assign Student to Route" onClose={() => setShowAssign(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Class">
              <select style={inputStyle} value={af.studentClass} onChange={e => setAf({ ...af, studentClass: e.target.value, studentId: "" })}>
                <option value="">All Classes</option>
                {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Student">
              <select style={inputStyle} value={af.studentId} onChange={e => setAf({ ...af, studentId: e.target.value })}>
                <option value="">-- Select Student --</option>
                {filteredStudents.map(s => (
                  <option key={s.id ?? s.student_id} value={s.id ?? s.student_id}>
                    {s.firstName || s.first_name} {s.lastName || s.last_name} ({s.admission_number || s.admission})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Route">
              <select style={inputStyle} value={af.transportId}
                onChange={e => setAf({ ...af, transportId: e.target.value })}>
                <option value="">Select route</option>
                {routes.map(r => (
                  <option key={r.transport_id} value={r.transport_id}>{r.route_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Start Date">
              <input type="date" style={inputStyle} value={af.startDate}
                onChange={e => setAf({ ...af, startDate: e.target.value })} />
            </Field>
            <Field label="End Date">
              <input type="date" style={inputStyle} value={af.endDate}
                onChange={e => setAf({ ...af, endDate: e.target.value })} />
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={af.status} onChange={e => setAf({ ...af, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          {err && <div style={{ color: "#ef4444", fontSize: 12, margin: "8px 0" }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <Btn variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Btn>
            <Btn onClick={saveAssignment}>Assign</Btn>
          </div>
        </Modal>
      )}

      {viewRouteStudents && (
        <Modal title={`Students on ${viewRouteStudents.route_name}`} onClose={() => setViewRouteStudents(null)}>
          {(() => {
            const routeAssignments = assignments.filter(a => a.transport_id === viewRouteStudents.transport_id && a.status === "active");
            if (routeAssignments.length === 0) {
              return <Msg text="No students assigned to this route." />;
            }
            return (
              <div style={{ overflowX: "auto" }}>
                <Table
                  headers={["Student", "Admission", "Class", "Parent Phone", "Start Date"]}
                  rows={routeAssignments.map(a => [
                    <span style={{ color: C.text, fontWeight: 600 }}>{a.first_name} {a.last_name}</span>,
                    a.admission_number,
                    a.class_name || "-",
                    a.parent_phone || "-",
                    a.start_date?.slice(0, 10),
                  ])}
                />
              </div>
            );
          })()}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <Btn onClick={() => setViewRouteStudents(null)}>Close</Btn>
          </div>
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
