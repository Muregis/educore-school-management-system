import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Msg } from "../components/Helpers";
import { C, inputStyle } from "../lib/theme";
// Bug #11 fixed: was using hardcoded raw fetch with API_BASE const.
// Now uses the shared apiFetch helper from lib/api.
import { apiFetch } from "../lib/api";

export default function TransportPage({ auth, canEdit, toast }) {
  const [tab, setTab]           = useState("routes");
  const [routes, setRoutes]     = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showRoute, setShowRoute]   = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [rf, setRf] = useState({ routeName: "", driverName: "", vehicleNumber: "", fee: "", status: "active" });
  const [af, setAf] = useState({ studentId: "", transportId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" });
  const [err, setErr] = useState("");

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
      setAf({ studentId: "", transportId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" });
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
                headers={["Route", "Driver", "Vehicle", "Fee (KES)", "Status"]}
                rows={routes.map(r => [
                  <span key={r.transport_id} style={{ color: C.text, fontWeight: 600 }}>{r.route_name}</span>,
                  r.driver_name    || "-",
                  r.vehicle_number || "-",
                  Number(r.fee || 0).toLocaleString(),
                  <Badge key="s" text={r.status} tone={r.status === "active" ? "success" : "danger"} />,
                ])}
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
                headers={["Student", "Admission", "Route", "Start Date", "End Date", "Status"]}
                rows={assignments.map(a => [
                  <span key={a.id} style={{ color: C.text, fontWeight: 600 }}>{a.first_name} {a.last_name}</span>,
                  a.admission_number,
                  a.route_name,
                  a.start_date?.slice(0, 10),
                  a.end_date?.slice(0, 10) || "-",
                  <Badge key="s" text={a.status} tone={a.status === "active" ? "success" : "danger"} />,
                ])}
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
            <Field label="Student ID">
              <input style={inputStyle} value={af.studentId}
                onChange={e => setAf({ ...af, studentId: e.target.value })}
                placeholder="e.g. 3" />
            </Field>
            <Field label="Route ID">
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
    </div>
  );
}

TransportPage.propTypes = {
  auth:    PropTypes.object,
  canEdit: PropTypes.bool,
  toast:   PropTypes.func.isRequired,
};
