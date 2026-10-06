import { useState } from "react";
import { getAuthHeaders } from "../lib/auth";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "https://educore-school-management-system.onrender.com/api";

const STEPS = ["School type", "Year & terms", "Fees", "Done"];

/**
 * Full-screen first-run wizard after register-school.
 * Calls POST /api/onboarding/complete then onComplete().
 */
export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [schoolType, setSchoolType] = useState("primary");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [activeTerm, setActiveTerm] = useState("Term 3");
  const [defaultTuition, setDefaultTuition] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function finish() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          schoolType,
          academicYear: Number(academicYear),
          activeTerm,
          defaultTuition: Number(defaultTuition) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.detail || "Setup failed");
      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err.message || "Could not finish setup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.progress}>
          {STEPS.map((label, i) => (
            <div
              key={label}
              style={{
                ...styles.pip,
                background: i <= step ? "#3b82f6" : "rgba(148,163,184,0.25)",
              }}
              title={label}
            />
          ))}
        </div>
        <div style={styles.stepLabel}>
          Step {Math.min(step + 1, 4)} of 4 · {STEPS[Math.min(step, 3)]}
        </div>

        {step === 0 && (
          <>
            <h2 style={styles.h2}>What type of school is this?</h2>
            <p style={styles.p}>We will create standard classes automatically.</p>
            <div style={styles.choices}>
              {[
                { id: "primary", title: "Primary", desc: "PP1–Grade 8" },
                { id: "secondary", title: "Secondary", desc: "Form 1–4" },
                { id: "both", title: "Both", desc: "Primary + secondary" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSchoolType(c.id)}
                  style={{
                    ...styles.choice,
                    borderColor: schoolType === c.id ? "#3b82f6" : "rgba(148,163,184,0.2)",
                  }}
                >
                  <strong>{c.title}</strong>
                  <span>{c.desc}</span>
                </button>
              ))}
            </div>
            <button type="button" style={styles.next} onClick={() => setStep(1)}>
              Continue
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={styles.h2}>Academic year & active term</h2>
            <p style={styles.p}>Kenyan-style Term 1–3 dates are generated for you.</p>
            <label style={styles.label}>
              Academic year
              <input
                type="number"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                style={styles.input}
                min={2020}
                max={2100}
              />
            </label>
            <label style={styles.label}>
              Active term (used for fees & grades)
              <select
                value={activeTerm}
                onChange={(e) => setActiveTerm(e.target.value)}
                style={styles.input}
              >
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </label>
            <div style={styles.row}>
              <button type="button" style={styles.back} onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" style={styles.next} onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={styles.h2}>Default tuition</h2>
            <p style={styles.p}>
              Applied as a fee structure to every class for the active term. You can edit later.
            </p>
            <label style={styles.label}>
              Term tuition (KES)
              <input
                type="number"
                value={defaultTuition}
                onChange={(e) => setDefaultTuition(e.target.value)}
                style={styles.input}
                min={0}
                step={100}
              />
            </label>
            {error ? <div style={styles.error}>{error}</div> : null}
            <div style={styles.row}>
              <button type="button" style={styles.back} onClick={() => setStep(1)} disabled={loading}>
                Back
              </button>
              <button type="button" style={styles.next} onClick={finish} disabled={loading}>
                {loading ? "Setting up…" : "Finish setup"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={styles.h2}>You are ready</h2>
            <p style={styles.p}>
              {result?.classesCreated ?? 0} classes · active {result?.activeTerm || activeTerm} ·{" "}
              year {result?.academicYear || academicYear}
            </p>
            <ul style={styles.list}>
              <li>Add students (or import CSV from Students)</li>
              <li>Record a fee payment</li>
              <li>Mark attendance</li>
            </ul>
            <button type="button" style={styles.next} onClick={() => onComplete?.(result)}>
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#0b1220",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "#121c30",
    borderRadius: 16,
    padding: 28,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  progress: { display: "flex", gap: 8, marginBottom: 12 },
  pip: { flex: 1, height: 4, borderRadius: 4 },
  stepLabel: { color: "#94a3b8", fontSize: 12, marginBottom: 16 },
  h2: { color: "#f8fafc", fontSize: 20, margin: "0 0 8px" },
  p: { color: "#94a3b8", fontSize: 14, margin: "0 0 16px", lineHeight: 1.45 },
  choices: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  choice: {
    textAlign: "left",
    padding: 14,
    borderRadius: 12,
    background: "#0f172a",
    border: "1px solid",
    color: "#e2e8f0",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: { display: "flex", flexDirection: "column", gap: 6, color: "#cbd5e1", fontSize: 13, marginBottom: 14 },
  input: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.25)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#f8fafc",
    fontSize: 14,
  },
  row: { display: "flex", gap: 10, marginTop: 8 },
  next: {
    flex: 1,
    border: "none",
    borderRadius: 10,
    padding: "12px 16px",
    background: "linear-gradient(90deg, #3b82f6, #6366f1)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  back: {
    border: "1px solid rgba(148,163,184,0.3)",
    borderRadius: 10,
    padding: "12px 16px",
    background: "transparent",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  error: {
    background: "rgba(239,68,68,0.15)",
    color: "#fecaca",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  list: { color: "#cbd5e1", lineHeight: 1.7, marginBottom: 20 },
};
