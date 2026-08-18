import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Badge, Button, Card } from "../components/ui";
import { apiFetch } from "../lib/api";

export default function CollegeProgramsPage({ auth, school, toast }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchPrograms();
    fetchDepartments();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await apiFetch("/api/college/programs", { token: auth.token });
      setPrograms(res || []);
    } catch (err) {
      toast(err.message || "Failed to load programs", "error");
    } finally {
      setLoading(false);
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
      const res = await apiFetch("/api/college/programs", {
        method: "POST",
        token: auth.token,
        body: { name, code, departmentId: Number(departmentId) || null }
      });
      setPrograms(prev => [res, ...prev]);
      setName(""); setCode(""); setDepartmentId("");
      toast("Program created successfully", "success");
    } catch (err) {
      toast(err.message || "Failed to create program", "error");
    }
  };

  return (
    <Card>
      <Card.Header>
        <h3>Programs</h3>
        <Button
          variant="primary"
          onClick={() => setName("").setCode("").setDepartmentId("")
          }
          style={{ float: "right", marginBottom: "1rem" }}
        >
          + New Program
        </Button>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <p>Loading programs...</p>
        ) : programs.length === 0 ? (
          <p>No programs found. Create one above.</p>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Cell>Name</Table.Cell>
                <Table.Cell>Code</Table.Cell>
                <Table.Cell>Department</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            </Table.Header>
              {programs.map((prog) => (
                <Table.Row key={prog.program_id}>
                  <Table.Cell>{prog.name}</Table.Cell>
                  <Table.Cell>{prog.code}</Table.Cell>
                  <Table.Cell>{prog.departments?.name || "-"}</Table.Cell>
                  <Table.Cell>
                    <Button size="sm" variant="secondary" onClick={() => window.location.href=`/college/programs/${prog.program_id}`}>View</Button>
                    <Button size="sm" variant="danger" onClick={() => deleteProgram(prog.program_id)}>Deactivate</Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
        )}
      </Card.Body>
    </Card>
  );
}