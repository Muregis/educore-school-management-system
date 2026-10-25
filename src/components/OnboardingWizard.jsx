const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px",
    background: "radial-gradient(circle at top left, rgba(59,130,246,0.1), transparent 40%), #070d18",
    color: "#edf4ff",
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#0e1828",
    borderRadius: 16,
    padding: "32px 28px",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
    boxSizing: "border-box",
  },
  header: {
    marginBottom: 20,
    textAlign: "center",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "-0.02em",
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  progress: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  pip: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    transition: "background 0.25s ease",
  },
  stepLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 20,
    textAlign: "center",
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  h2: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
  },
  p: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.5,
    margin: "0 0 8px",
  },
  choices: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 8,
  },
  choice: {
    textAlign: "left",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid",
    color: "#e2e8f0",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    transition: "all 0.2s ease",
  },
  choiceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 700,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.2)",
    color: "#60a5fa",
  },
  choiceDesc: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.4,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 600,
  },
  input: {
    background: "#08101e",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "11px 14px",
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    width: "100%",
  },
  inputWithPrefix: {
    display: "flex",
    alignItems: "center",
    background: "#08101e",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    overflow: "hidden",
  },
  currencyPrefix: {
    padding: "11px 14px",
    background: "rgba(255,255,255,0.05)",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
    borderRight: "1px solid rgba(255,255,255,0.1)",
  },
  inputWithCurrency: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: "11px 14px",
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 12,
  },
  next: {
    flex: 1,
    border: "none",
    borderRadius: 10,
    padding: "13px 18px",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
    transition: "opacity 0.2s",
  },
  back: {
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: "13px 18px",
    background: "transparent",
    color: "#cbd5e1",
    fontSize: 14,
    cursor: "pointer",
  },
  error: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    fontSize: 24,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 8px",
    border: "1px solid rgba(34,197,94,0.3)",
  },
  summaryCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 13,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    color: "#cbd5e1",
  },
  nextSteps: {
    marginTop: 6,
  },
  nextStepsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 6,
  },
  list: {
    margin: 0,
    paddingLeft: 20,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.6,
  },
  launchButton: {
    marginTop: 12,
    border: "none",
    borderRadius: 10,
    padding: "14px 20px",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
  },
};

import { useState } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";

const STEPS = ["School Structure", "Calendar & Terms", "Fee Structure", "Ready"];

export default function OnboardingWizard({ auth, onComplete }) {
  const [step, setStep] = useState(0);
  const [schoolType, setSchoolType] = useState("primary");
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [activeTerm, setActiveTerm] = useState("Term 1");
  const [defaultTuition, setDefaultTuition] = useState(7500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const token = auth?.token;

  async function finish() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/onboarding/complete", {
        method: "POST",
        token,
        body: {
          schoolType,
          academicYear: Number(academicYear),
          activeTerm,
          defaultTuition: Math.max(0, Number(defaultTuition) || 0),
        },
      });

      setResult(data);
      setStep(3);
    } catch (err) {
      setError(err.message || "Could not complete school onboarding setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const schoolTypes = [
    {
      id: "primary",
      title: "Primary & Junior School (CBC)",
      classes: "PP1, PP2, Grade 1 to Grade 9",
      subjects: "CBC Learning Areas & KPSEA / KJLSEA",
      badge: "CBC Curriculum",
    },
    {
      id: "secondary",
      title: "Secondary & Senior School",
      classes: "Grade 10 - 12 / Form 1 - 4",
      subjects: "Secondary & Senior School Subjects",
      badge: "Senior Secondary",
    },
    {
      id: "igcse",
      title: "International (IGCSE / Cambridge / IB)",
      classes: "Year 1 to Year 13 / Stages 1 - 5",
      subjects: "Cambridge / Edexcel IGCSE & A-Levels",
      badge: "British / International",
    },
    {
      id: "college",
      title: "College & Higher Education (TVET / Tertiary)",
      classes: "Year 1 to Year 4 / Semesters",
      subjects: "Modular Units, Courses & Programs",
      badge: "Higher Education",
    },
    {
      id: "both",
      title: "Comprehensive All-Through Campus",
      classes: "Early Years through Senior / College",
      subjects: "Full Multi-Curriculum Catalog",
      badge: "Full Campus",
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.brandTitle}>EduCore School Setup</div>
          <p style={styles.brandSubtitle}>
            Welcome to EduCore. Configure your school tenant in a few quick steps.
          </p>
        </div>

        {/* Progress bar */}
        <div style={styles.progress}>
          {STEPS.map((label, i) => (
            <div
              key={label}
              style={{
                ...styles.pip,
                background: i <= step ? "var(--color-primary, #3b82f6)" : "rgba(255,255,255,0.12)",
              }}
              title={label}
            />
          ))}
        </div>

        <div style={styles.stepLabel}>
          Step {Math.min(step + 1, 4)} of 4 · {STEPS[Math.min(step, 3)]}
        </div>

        {/* STEP 1: School Type */}
        {step === 0 && (
          <div style={styles.stepContent}>
            <h2 style={styles.h2}>Select School Level</h2>
            <p style={styles.p}>
              We will automatically provision standard Kenyan classes and curriculum subjects for your school.
            </p>

            <div style={styles.choices}>
              {schoolTypes.map((c) => {
                const isSelected = schoolType === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSchoolType(c.id)}
                    style={{
                      ...styles.choice,
                      borderColor: isSelected ? "var(--color-primary, #3b82f6)" : "rgba(255,255,255,0.12)",
                      background: isSelected ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={styles.choiceHeader}>
                      <strong>{c.title}</strong>
                      <span style={styles.badge}>{c.badge}</span>
                    </div>
                    <div style={styles.choiceDesc}>
                      <div><strong>Classes:</strong> {c.classes}</div>
                      <div><strong>Curriculum:</strong> {c.subjects}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.next}
                onClick={() => setStep(1)}
              >
                Continue to Academic Calendar →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Academic Year & Term */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <h2 style={styles.h2}>Academic Year & Current Term</h2>
            <p style={styles.p}>
              Kenyan Ministry of Education standard term dates (Term 1, Term 2, Term 3) will be created.
            </p>

            <label style={styles.label}>
              Academic Year
              <input
                type="number"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                style={styles.input}
                min={2020}
                max={2035}
              />
            </label>

            <label style={styles.label}>
              Active Term (Used for ongoing billing and attendance)
              <select
                value={activeTerm}
                onChange={(e) => setActiveTerm(e.target.value)}
                style={styles.input}
              >
                <option value="Term 1">Term 1 (January – April)</option>
                <option value="Term 2">Term 2 (May – August)</option>
                <option value="Term 3">Term 3 (September – November)</option>
              </select>
            </label>

            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.back}
                onClick={() => setStep(0)}
              >
                ← Back
              </button>
              <button
                type="button"
                style={styles.next}
                onClick={() => setStep(2)}
              >
                Continue to Fee Setup →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Fees */}
        {step === 2 && (
          <div style={styles.stepContent}>
            <h2 style={styles.h2}>Initial Fee Structure</h2>
            <p style={styles.p}>
              Set a baseline tuition fee per term. A fee structure will be automatically generated for every created class. You can refine specific class fees at any time from the Fees management screen.
            </p>

            <label style={styles.label}>
              Standard Tuition per Term (KES)
              <div style={styles.inputWithPrefix}>
                <span style={styles.currencyPrefix}>KES</span>
                <input
                  type="number"
                  value={defaultTuition}
                  onChange={(e) => setDefaultTuition(e.target.value)}
                  style={styles.inputWithCurrency}
                  min={0}
                  step={500}
                />
              </div>
            </label>

            {error ? <div style={styles.error}>{error}</div> : null}

            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.back}
                onClick={() => setStep(1)}
                disabled={loading}
              >
                ← Back
              </button>
              <button
                type="button"
                style={styles.next}
                onClick={finish}
                disabled={loading}
              >
                {loading ? "Provisioning School..." : "Complete Setup & Launch 🚀"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Success / Ready */}
        {step === 3 && (
          <div style={styles.stepContent}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.h2}>Your School is Ready!</h2>
            <p style={styles.p}>
              EduCore has provisioned your school tenant with production settings:
            </p>

            <div style={styles.summaryCard}>
              <div style={styles.summaryRow}>
                <span>Provisioned Classes:</span>
                <strong>{result?.classesCreated || "Classes created"}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Academic Year:</span>
                <strong>{result?.academicYear || academicYear}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Current Active Term:</span>
                <strong>{result?.activeTerm || activeTerm}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Base Tuition:</span>
                <strong>KES {Number(result?.defaultTuition || defaultTuition).toLocaleString()}</strong>
              </div>
            </div>

            <div style={styles.nextSteps}>
              <div style={styles.nextStepsTitle}>Recommended next steps:</div>
              <ul style={styles.list}>
                <li>Enroll students or bulk import student CSVs</li>
                <li>Add teaching staff and assign class teachers</li>
                <li>Record fee payments or print parent invoices</li>
              </ul>
            </div>

            <button
              type="button"
              style={styles.launchButton}
              onClick={() => onComplete?.(result)}
            >
              Enter EduCore Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

OnboardingWizard.propTypes = {
  auth: PropTypes.shape({
    token: PropTypes.string,
    role: PropTypes.string,
    schoolId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  onComplete: PropTypes.func.isRequired,
};

