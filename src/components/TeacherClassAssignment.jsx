import { useState, useEffect } from "react";
import { api } from "../lib/api"; // adjust if your instance name differs

export default function TeacherAssignments() {
  // =========================
  // STATE
  // =========================
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [teacherId, setTeacherId] = useState("");
  const [className, setClassName] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState("2026");

  // =========================
  // LOAD DATA
  // =========================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [teachersRes, classesRes, subjectsRes, assignmentsRes] =
          await Promise.all([
            api.get("/users?role=teacher"),
            api.get("/classes"),
            api.get("/subjects"),
            api.get("/teacher-assignments"),
          ]);

        setTeachers(teachersRes.data || []);
        setClasses(classesRes.data || []);
        setSubjects(subjectsRes.data || []);
        setAssignments(assignmentsRes.data || []);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };

    loadData();
  }, []);

  // =========================
  // CREATE ASSIGNMENT
  // =========================
  const createAssignment = async () => {
    try {
      await api.post("/teacher-assignments", {
        teacherId,
        className,
        classId,
        subjectName,
        subjectId,
        isClassTeacher,
        term,
        academicYear,
      });

      // refresh list
      const res = await api.get("/teacher-assignments");
      setAssignments(res.data || []);
    } catch (err) {
      console.error("Failed to create assignment:", err);
    }
  };

  // =========================
  // DELETE ASSIGNMENT
  // =========================
  const deleteAssignment = async (assignmentId) => {
    try {
      await api.delete(`/teacher-assignments/${assignmentId}`);

      setAssignments((prev) =>
        prev.filter((a) => a.id !== assignmentId)
      );
    } catch (err) {
      console.error("Failed to delete assignment:", err);
    }
  };

  // =========================
  // UI (placeholder)
  // =========================
  return (
    <div>
      <h2>Teacher Assignments</h2>

      {/* You would plug your selects/inputs here */}

      <button onClick={createAssignment}>
        Create Assignment
      </button>

      <ul>
        {assignments.map((a) => (
          <li key={a.id}>
            {a.teacherName} → {a.className} → {a.subjectName}
            <button onClick={() => deleteAssignment(a.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}