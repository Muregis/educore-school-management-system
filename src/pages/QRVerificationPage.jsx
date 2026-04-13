import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { API_BASE } from "../lib/api";
import { C } from "../lib/theme";

export default function QRVerificationPage({ studentId }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStudentVerification = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE}/public/student/${encodeURIComponent(studentId)}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || "Student not found or invalid ID");
        }

        setStudent(payload.student || null);
      } catch (err) {
        setStudent(null);
        setError(err.message || "Failed to verify student");
      } finally {
        setLoading(false);
      }
    };

    if (!studentId) {
      setStudent(null);
      setError("No student ID provided");
      setLoading(false);
      return;
    }

    loadStudentVerification();
  }, [studentId]);

  if (loading) {
    return (
      <div style={pageShellStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>Loading...</div>
          <div>Verifying student information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageShellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>Verification Failed</div>
          <h2 style={{ color: C.rose, marginBottom: 8 }}>Verification Failed</h2>
          <p style={{ color: C.textMuted, margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div style={pageShellStyle}>
        <div style={cardStyle}>
          <h2 style={{ marginBottom: 8 }}>Student Not Found</h2>
          <p style={{ color: C.textMuted, margin: 0 }}>No matching student record was found.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, padding: 20 }}>
      <div style={{ ...cardStyle, maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          {student.school.logo_url && (
            <img
              src={student.school.logo_url}
              alt={`${student.school.name} logo`}
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                objectFit: "cover",
                marginBottom: 16
              }}
            />
          )}
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>
            {student.school.name}
          </h1>
          <p style={{ color: C.textMuted, fontSize: 16, margin: 0 }}>Student Verification</p>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>
            {student.firstName} {student.lastName}
          </h2>
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              background: student.status === "active" ? `${C.green}22` : `${C.rose}22`,
              color: student.status === "active" ? C.green : C.rose,
              fontWeight: 700,
              textTransform: "capitalize"
            }}
          >
            {student.status}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16
          }}
        >
          <InfoCard label="Student ID" value={student.studentId} />
          <InfoCard label="Admission Number" value={student.admissionNumber} />
          <InfoCard label="School" value={student.school.name} />
          <InfoCard label="Status" value={student.status === "active" ? "Active" : "Inactive"} />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        padding: 16,
        background: C.bg,
        borderRadius: 12,
        border: `1px solid ${C.border}`
      }}
    >
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>
        {value || "-"}
      </div>
    </div>
  );
}

const pageShellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: C.bg,
  color: C.text,
  padding: 20
};

const cardStyle = {
  width: "100%",
  maxWidth: 420,
  background: C.card,
  borderRadius: 16,
  border: `1px solid ${C.border}`,
  padding: 32
};

InfoCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

QRVerificationPage.propTypes = {
  studentId: PropTypes.string.isRequired,
};
