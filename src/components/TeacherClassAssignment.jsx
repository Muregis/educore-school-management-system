const [teachers, setTeachers] = useState([]);
const [classes, setClasses] = useState([]);
const [subjects, setSubjects] = useState([]);
const [assignments, setAssignments] = useState([]);

/api/users?role=teacher
/api/classes
/api/subjects
/api/teacher-assignments

await api.post('/teacher-assignments', {
  teacherId,
  className,
  classId,
  subjectName,
  subjectId,
  isClassTeacher,
  term,
  academicYear
});

await api.delete(
  `/teacher-assignments/${assignmentId}`
);