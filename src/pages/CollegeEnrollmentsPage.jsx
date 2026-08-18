import { useEffect, useState } from "react";
import { useAuth } from "./lib/auth";
import { useNavigate } from "react-router-dom";
import { Table, Badge, Button, Card } from "./components/ui";
import { apiFetch } from "./lib/api";
import { toast } from "./components/Helpers";

export default function CollegeEnrollmentsPage({ auth, school }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    fetchEnrollments();
    fetchStudents();
    fetchProgramsList();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const res = await apiFetch("/api/college/enrollments", { token: auth.token });
      setEnrollments(res || []);
    } catch (err) {
      toast(err.message || "Failed to load enrollments", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiFetch("/students", { token: auth.token });
      setStudents(res || []);
    } catch (err) {
      toast(err.message || "Failed to load students", "error");
    }
  };

  const fetchProgramsList = async () => {
    try {
      const res = await apiFetch("/api/college/programs", { token: auth.token });
      setPrograms(res || []);
    } catch (err) {
      toast(err.message || "Failed to load programs", "error");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/college/enrollments", {
        method: "POST",
        token: auth.token,
        body: { studentId: Number(studentId), programId: Number(programId), academicYear }
      });
      setEnrollments(prev => [res, ...prev]);
      setStudentId(""); setProgramId(""); setAcademicYear(new Date().getFullYear().toString());
      toast("Enrollment created successfully", "success");
    } catch (err) {
      toast(err.message || "Failed to create enrollment", "error");
    }
  };

  return (
    <Card>
      <Card.Header>
        <h3>Student Program Enrollments</h3>
        <form onSubmit={handleCreate} style={{ marginBottom: "1rem" }}>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="form-select"
            style={{ width: "200px", marginRight: "10px" }}
          >
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.admission_number || s.first_name + " " + s.last_name}
              </option>
            ))}
          </select>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="form-select"
            style={{ width: "200px", marginRight: "10px" }}
          >
            <option value="">Select Program</option>
            {programs.map((p) => (
              <option key={p.program_id} value={p.program_id}>
                {p.code + " - " + p.name}
              </option>
            ))}
          </select>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="form-select"
          >
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
          </select>
          <button type="submit" className="btn btn-primary">Enroll Student</button>
        </form>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <p>Loading enrollments...</p>
        ) : enrollments.length === 0 ? (
          <p>No enrollments found. Enroll a student above.</p>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Row>
                  <Table.Cell>Student</Table.Cell>
                  <Table.Cell>Program</Table.Cell>
                  <Table.Cell>Academic Year</Table.Cell>
                  <Table.Cell>Enrollment Date</Table.Cell>
                  <Table.Cell>Status</Table.Cell>
                  <Table.Cell>Actions</Table.Cell>
                </Table.Row>
              </Table.Header>
              {enrollments.map((enroll) => (
                <Table.Row key={enroll.enrollment_id}>
                  <Table.Cell>
                    {enroll.students?.first_name + " " + enroll.students?.last_name || "-"}
                  </Table.Cell>
                  <Table.Cell>{enroll.programs?.name || "-"}</Table.Cell>
                  <Table.Cell>{enroll.academic_year}</Table.Cell>
                  <Table.Cell>{enroll.enrollment_date}</Table.Cell>
                  <Table.Cell>
                    <Badge
                      status={enroll.status === "enrolled" ? "default" : enroll.status}
                    >
                      {enroll.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Button size="sm" variant="secondary" onClick={() => window.location.href=`/college/enrollments/${enroll.enrollment_id}`}>View</Button>
                    <Button size="sm" variant="danger" onClick={() => withdrawEnrollment(enroll.enrollment_id)}>Withdraw</Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}