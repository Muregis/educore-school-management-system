import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";

export default function QRVerificationPage() {
  const { token } = useParams();
  const [student, setStudent] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // This would be a public API endpoint that doesn't require authentication
        const response = await fetch(`/api/public/verify/${token}`);
        if (!response.ok) {
          throw new Error("Invalid or expired token");
        }
        const data = await response.json();
        setStudent(data.student);
        setSchool(data.school);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setError("No token provided");
      setLoading(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        color: C.text
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>🔄</div>
          <div>Verifying student information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        color: C.text
      }}>
        <div style={{
          textAlign: "center",
          padding: 32,
          background: C.card,
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          maxWidth: 400
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ color: C.rose, marginBottom: 8 }}>Verification Failed</h2>
          <p style={{ color: C.textMuted }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      color: C.text,
      padding: 20
    }}>
      {/* Header */}
      <div style={{
        textAlign: "center",
        marginBottom: 32,
        padding: 24,
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`
      }}>
        {school?.logo_url && (
          <img
            src={school.logo_url}
            alt="School Logo"
            style={{
              width: 80,
              height: 80,
              borderRadius: 12,
              objectFit: "cover",
              marginBottom: 16
            }}
          />
        )}
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          {school?.name || "School Name"}
        </h1>
        <p style={{ color: C.textMuted, fontSize: 16 }}>
          Student Verification
        </p>
      </div>

      {/* Student Card */}
      <div style={{
        maxWidth: 600,
        margin: "0 auto",
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        overflow: "hidden"
      }}>
        {/* Student Photo */}
        {student?.photo_url && (
          <div style={{
            height: 200,
            background: `linear-gradient(135deg, ${C.accent}20, ${C.accent}40)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <img
              src={student.photo_url}
              alt="Student Photo"
              style={{
                width: 120,
                height: 120,
                borderRadius: 12,
                objectFit: "cover",
                border: `3px solid ${C.accent}`
              }}
            />
          </div>
        )}

        {/* Student Details */}
        <div style={{ padding: 24 }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 16,
            textAlign: "center"
          }}>
            {student?.firstName} {student?.lastName}
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 24
          }}>
            <div style={{
              padding: 16,
              background: C.bg,
              borderRadius: 8,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                ADMISSION NUMBER
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {student?.admission || student?.admission_number}
              </div>
            </div>

            <div style={{
              padding: 16,
              background: C.bg,
              borderRadius: 8,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                CLASS/STREAM
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {student?.className || student?.class_name}
              </div>
            </div>

            <div style={{
              padding: 16,
              background: C.bg,
              borderRadius: 8,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                STATUS
              </div>
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: student?.status === "active" ? C.green : C.rose
              }}>
                {student?.status === "active" ? "Active" : "Inactive"}
              </div>
            </div>

            <div style={{
              padding: 16,
              background: C.bg,
              borderRadius: 8,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                VALIDITY
              </div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {school?.term} {school?.year}
              </div>
            </div>
          </div>

          {/* Optional Data */}
          {(student?.feeStatus || student?.medicalAlert) && (
            <div style={{
              padding: 16,
              background: student?.medicalAlert ? C.rose + "20" : C.bg,
              borderRadius: 8,
              border: `1px solid ${student?.medicalAlert ? C.rose : C.border}`,
              marginBottom: 16
            }}>
              {student?.feeStatus && (
                <div style={{ marginBottom: student?.medicalAlert ? 8 : 0 }}>
                  <span style={{ fontWeight: 600 }}>Fee Status:</span>{" "}
                  <span style={{
                    color: student.feeStatus === "Paid" ? C.green : C.rose
                  }}>
                    {student.feeStatus}
                  </span>
                </div>
              )}
              {student?.medicalAlert && (
                <div>
                  <span style={{ fontWeight: 600, color: C.rose }}>Medical Alert:</span>{" "}
                  <span style={{ color: C.rose }}>
                    {student.medicalAlert}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{
            textAlign: "center",
            padding: 16,
            background: C.bg,
            borderRadius: 8,
            border: `1px solid ${C.border}`
          }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>
              This verification is valid for the current term.
              For full student details, please contact the school administration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}