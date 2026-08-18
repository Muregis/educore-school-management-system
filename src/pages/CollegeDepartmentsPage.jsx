import { useEffect, useState } from "react";
import { useAuth } from "./lib/auth";
import { useNavigate } from "react-router-dom";
import { Table, Badge, Button, Card } from "./components/ui";
import { apiFetch } from "./lib/api";
import { toast } from "./components/Helpers";

export default function CollegeDepartmentsPage({ auth, school }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await apiFetch("/api/college/departments", { token: auth.token });
      setDepartments(res || []);
    } catch (err) {
      toast(err.message || "Failed to load departments", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/college/departments", {
        method: "POST",
        token: auth.token,
        body: { name, code, description }
      });
      setDepartments(prev => [res, ...prev]);
      setName(""); setCode(""); setDescription("");
      toast("Department created successfully", "success");
    } catch (err) {
      toast(err.message || "Failed to create department", "error");
    }
  };

  return (
    <Card>
      <Card.Header>
        <h3>Departments</h3>
        <Button
          variant="primary"
          onClick={() => setName("").setCode("").setDescription("")
          }
          style={{ float: "right", marginBottom: "1rem" }}
        >
          + New Department
        </Button>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <p>Loading departments...</p>
        ) : departments.length === 0 ? (
          <p>No departments found. Create one above.</p>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Cell>Name</Table.Cell>
                <Table.Cell>Code</Table.Cell>
                <Table.Cell>Description</Table.Cell>
                <Table.Cell>Actions</Table.Cell>
              </Table.Row>
            </Table.Header>
            {departments.map((dept) => (
              <Table.Row key={dept.department_id}>
                <Table.Cell>{dept.name}</Table.Cell>
                <Table.Cell>{dept.code}</Table.Cell>
                <Table.Cell>{dept.description || "-"}</Table.Cell>
                <Table.Cell>
                  <Button size="sm" variant="secondary" onClick={() => window.location.href=`/college/departments/${dept.department_id}`}>View</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteDepartment(dept.department_id)}>Deactivate</Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}