import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Badge, Button, Card } from "../components/ui";
import { apiFetch } from "../lib/api";

export default function CollegeUnitsPage({ auth, school, toast }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [programId, setProgramId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programs, setPrograms] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchUnits();
    fetchPrograms();
    fetchDepartments();
  }, []);

  const fetchUnits = async () => {
    try {
      const res = await apiFetch("/api/college/units", { token: auth.token });
      setUnits(res || []);
    } catch (err) {
      toast(err.message || "Failed to load units", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await apiFetch("/api/college/programs", { token: auth.token });
      setPrograms(res || []);
    } catch (err) {
      toast(err.message || "Failed to load programs", "error");
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiFetch("/api/college/departments", { token: auth.token });
      setDepartments(res || []);
    } catch (err) {
      toast(err.message || "Failed to load departments", "error");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/college/units", {
        method: "POST",
        token: auth.token,
        body: { title, code, programId: Number(programId), departmentId: Number(departmentId) }
      });
      setUnits(prev => [res, ...prev]);
      setTitle(""); setCode(""); setProgramId(""); setDepartmentId("");
      toast("Unit created successfully", "success");
    } catch (err) {
      toast(err.message || "Failed to create unit", "error");
    }
  };

  return (
    <Card>
      <Card.Header>
        <h3>Units/Courses</h3>
        <Button
          variant="primary"
          onClick={() => setTitle("").setCode("").setProgramId("").setDepartmentId("")
          }
          style={{ float: "right", marginBottom: "1rem" }}
        >
          + New Unit
        </Button>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <p>Loading units...</p>
        ) : units.length === 0 ? (
          <p>No units found. Create one above.</p>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Cell>Title</Table.Cell>
                <Table.Cell>Code</Table.Cell>
                <Table.Cell>Program</Table.Cell>
                <Table.Cell>Department</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            </Table.Header>
              {units.map((unit) => (
                <Table.Row key={unit.unit_id}>
                  <Table.Cell>{unit.title}</Table.Cell>
                  <Table.Cell>{unit.code}</Table.Cell>
                  <Table.Cell>{unit.programs?.name || "-"}</Table.Cell>
                  <Table.Cell>{unit.departments?.name || "-"}</Table.Cell>
                  <Table.Cell>
                    <Button size="sm" variant="secondary" onClick={() => window.location.href=`/college/units/${unit.unit_id}`}>View</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteUnit(unit.unit_id)}>Deactivate</Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
        )}
      </Card.Body>
    </Card>
  );
}