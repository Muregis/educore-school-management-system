import { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { C } from "../lib/theme";
import Btn from "../components/Btn";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import Card from "../components/ui/Card";

export default function TermManagementPage({ auth }) {
  const [loading, setLoading] = useState(true);
  const [currentTerm, setCurrentTerm] = useState(null);
  const [terms, setTerms] = useState([]);
  const [termFinancials, setTermFinancials] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ term_name: "", start_date: "", end_date: "", academic_year: "" });
  const [actionResult, setActionResult] = useState(null);

  const loadTerms = useCallback(async () => {
    try {
      setLoading(true);
      const [currentRes, allRes] = await Promise.all([
        apiFetch("/academic/terms/current", { token: auth?.token }).catch(() => null),
        apiFetch("/academic/terms", { token: auth?.token }).catch(() => []),
      ]);
      setCurrentTerm(currentRes || null);
      setTerms(Array.isArray(allRes) ? allRes : []);
      if (allRes?.length && !form.academic_year) {
        const year = allRes[0]?.academic_year || "";
        setForm(f => ({ ...f, academic_year: year }));
      }
    } catch (err) {
      setError(err.message || "Failed to load terms");
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => { loadTerms(); }, [loadTerms]);

  useEffect(() => {
    const loadFinancials = async () => {
      if (!currentTerm?.term_id && !currentTerm?.term_name) {
        setTermFinancials(null);
        return;
      }
      try {
        const termId = currentTerm?.term_id;
        const termName = currentTerm?.term_name;
        let totalOutstanding = 0;
        let totalPaid = 0;
        let defaulterCount = 0;

        if (termId) {
          try {
            const summaryRes = await apiFetch(`/finance/term-summary/${termId}`, { token: auth?.token });
            totalOutstanding = summaryRes?.summary?.totalOutstanding || summaryRes?.summary?.outstanding || 0;
            totalPaid = summaryRes?.summary?.totalPaid || summaryRes?.summary?.collected || 0;
            defaulterCount = summaryRes?.summary?.defaulterCount || summaryRes?.summary?.defaulters || 0;
          } catch {
            const [defaultersRes, paymentsRes] = await Promise.all([
              apiFetch(`/reports/fee-defaulters?term=${encodeURIComponent(termName)}`, { token: auth?.token }).catch(() => []),
              apiFetch(`/payments?term=${encodeURIComponent(termName)}`, { token: auth?.token }).catch(() => []),
            ]);
            const defaulters = Array.isArray(defaultersRes) ? defaultersRes : (defaultersRes?.data || []);
            const payments = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.data || []);
            totalOutstanding = defaulters.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
            defaulterCount = defaulters.length;
            totalPaid = payments
              .filter(p => p.status === 'paid' || p.status === 'completed' || p.status === 'success')
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          }
        } else {
          const [defaultersRes, paymentsRes] = await Promise.all([
            apiFetch(`/reports/fee-defaulters?term=${encodeURIComponent(termName)}`, { token: auth?.token }).catch(() => []),
            apiFetch(`/payments?term=${encodeURIComponent(termName)}`, { token: auth?.token }).catch(() => []),
          ]);
          const defaulters = Array.isArray(defaultersRes) ? defaultersRes : (defaultersRes?.data || []);
          const payments = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.data || []);
          totalOutstanding = defaulters.reduce((sum, d) => sum + (Number(d.balance) || 0), 0);
          defaulterCount = defaulters.length;
          totalPaid = payments
            .filter(p => p.status === 'paid' || p.status === 'completed' || p.status === 'success')
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        }

        setTermFinancials({
          totalOutstanding,
          totalPaid,
          defaulterCount,
          termName
        });
      } catch (err) {
        console.error('Error loading term financials:', err);
        setTermFinancials(null);
      }
    };

    loadFinancials();
  }, [currentTerm?.term_id, currentTerm?.term_name, auth?.token]);

  const createTerm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch("/academic/terms", {
        method: "POST",
        token: auth?.token,
        body: { ...form, status: "upcoming" },
      });
      setSuccess(res?.message || "Term created successfully");
      setShowCreateModal(false);
      setForm({ term_name: "", start_date: "", end_date: "", academic_year: form.academic_year });
      await loadTerms();
    } catch (err) {
      setError(err.message || "Failed to create term");
    } finally {
      setSaving(false);
    }
  };

  const closeTerm = async () => {
    if (!currentTerm?.term_id) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/academic/terms/${currentTerm.term_id}/end-term`, {
        method: "POST",
        token: auth?.token,
        body: { carryForwardBalances: true, archiveGrades: true },
      });
      setActionResult(res);
      setShowCloseModal(false);
      await loadTerms();
    } catch (err) {
      setError(err.message || "Failed to close term");
    } finally {
      setSaving(false);
    }
  };

  const activateTerm = async (termId) => {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/academic/terms/${termId}/activate`, {
        method: "PUT",
        token: auth?.token,
      });
      setSuccess(res?.message || "Term activated");
      await loadTerms();
    } catch (err) {
      setError(err.message || "Failed to activate term");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: C.textSub }}>Loading term management...</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: C.text, fontSize: 26, fontWeight: 700 }}>Term Management</h1>
        <p style={{ margin: "6px 0 0", color: C.textSub, fontSize: 14 }}>
          Create, activate, and close academic terms. Track term dates and status.
        </p>
      </div>

      {error && (
        <Card style={{ marginBottom: 16, border: "1px solid #F43F5E", background: "rgba(244,63,94,0.08)" }}>
          <div style={{ color: "#F43F5E", fontWeight: 600 }}>Error</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>{error}</div>
        </Card>
      )}
      {success && (
        <Card style={{ marginBottom: 16, border: "1px solid #22C55E", background: "rgba(34,197,94,0.08)" }}>
          <div style={{ color: "#22C55E", fontWeight: 600 }}>Success</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>{success}</div>
        </Card>
      )}
      {actionResult?.summary && (
        <Card style={{ marginBottom: 16, border: "1px solid #22C55E", background: "rgba(34,197,94,0.08)" }}>
          <div style={{ color: "#22C55E", fontWeight: 600 }}>Term Closed Successfully</div>
          <div style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>
            {actionResult.summary.promoted || 0} students promoted · {actionResult.summary.balancesCarriedForward || 0} balances carried forward
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Current Term</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {currentTerm?.term_name || "Not set"}
          </div>
          <div style={{ marginTop: 8 }}>
            <Badge status={currentTerm?.status === "active" ? "success" : currentTerm?.status === "closed" ? "danger" : "default"}>
              {currentTerm?.status || "Unknown"}
            </Badge>
          </div>
        </Card>
        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Terms</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>{terms.length}</div>
          <div style={{ marginTop: 8, color: C.textSub, fontSize: 12 }}>
            {terms.filter(t => t.status === "active").length} active · {terms.filter(t => t.status === "upcoming").length} upcoming
          </div>
        </Card>
        <Card>
          <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Academic Year</div>
          <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
            {currentTerm?.academic_year || terms[0]?.academic_year || "Not set"}
          </div>
        </Card>
        {termFinancials && (
          <>
            <Card>
              <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Term Outstanding</div>
              <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
                KES {(termFinancials.totalOutstanding || 0).toLocaleString()}
              </div>
              <div style={{ marginTop: 8, color: C.textSub, fontSize: 12 }}>
                {termFinancials.defaulterCount || 0} students with balance
              </div>
            </Card>
            <Card>
              <div style={{ color: C.textSub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Term Collected</div>
              <div style={{ color: C.text, fontSize: 20, fontWeight: 700, marginTop: 6 }}>
                KES {(termFinancials.totalPaid || 0).toLocaleString()}
              </div>
              <div style={{ marginTop: 8, color: C.textSub, fontSize: 12 }}>
                Fees collected this term
              </div>
            </Card>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 6px", color: C.text, fontSize: 18, fontWeight: 700 }}>Create New Term</h3>
            <p style={{ margin: 0, color: C.textSub, fontSize: 13 }}>Add a new upcoming term for the current academic year.</p>
          </div>
          <div style={{ marginTop: "auto" }}>
            <Btn onClick={() => setShowCreateModal(true)} style={{ width: "100%" }}>
              Create Term
            </Btn>
          </div>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 6px", color: C.text, fontSize: 18, fontWeight: 700 }}>Close Current Term</h3>
            <p style={{ margin: 0, color: C.textSub, fontSize: 13 }}>
              Finalize the current term. Grades will be archived, unpaid balances carried forward.
            </p>
          </div>
          <div style={{ marginTop: "auto" }}>
            <Btn
              onClick={() => setShowCloseModal(true)}
              disabled={!currentTerm || currentTerm.status === "closed" || currentTerm.status === "completed" || saving}
              variant="danger"
              style={{ width: "100%" }}
            >
              {saving ? "Processing..." : "Close Current Term"}
            </Btn>
          </div>
        </Card>
      </div>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontFamily: "var(--font-heading)", fontSize: 16 }}>All Terms</div>
            <div style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Manage and review all academic terms</div>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--color-bg-surface)", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700 }}>Term</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700 }}>Year</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700 }}>Start</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700 }}>End</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700 }}>Status</th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {terms.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: C.textSub }}>
                    No terms found. Create your first term to get started.
                  </td>
                </tr>
              ) : (
                terms.map(term => (
                  <tr key={term.term_id} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: C.text }}>{term.term_name}</td>
                    <td style={{ padding: "12px 16px", color: C.textSub }}>{term.academic_year}</td>
                    <td style={{ padding: "12px 16px", color: C.textSub }}>{term.start_date ? new Date(term.start_date).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: "12px 16px", color: C.textSub }}>{term.end_date ? new Date(term.end_date).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge status={term.status === "active" ? "success" : term.status === "closed" || term.status === "completed" ? "danger" : "default"}>
                        {term.status}
                      </Badge>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {term.status !== "active" && term.status !== "closed" && term.status !== "completed" && (
                        <Btn size="sm" onClick={() => activateTerm(term.term_id)} disabled={saving}>
                          Activate
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateTermModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onSubmit={createTerm}
        loading={saving}
        form={form}
        setForm={setForm}
        academicYear={form.academic_year}
      />

      <CloseTermModal
        show={showCloseModal}
        onHide={() => setShowCloseModal(false)}
        onConfirm={closeTerm}
        loading={saving}
        term={currentTerm}
      />
    </div>
  );
}

TermManagementPage.propTypes = {
  auth: PropTypes.object,
};

function CreateTermModal({ show, onHide, onSubmit, loading, form, setForm, academicYear }) {
  return (
    <Modal isOpen={show} onHide={onHide} title="Create New Term">
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Term Name</label>
          <input
            style={{ ...inputStyle, width: "100%" }}
            placeholder="e.g. Term 1"
            value={form.term_name}
            onChange={e => setForm(f => ({ ...f, term_name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Academic Year</label>
          <input
            style={{ ...inputStyle, width: "100%" }}
            placeholder="e.g. 2026"
            value={form.academic_year}
            onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
            required
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Start Date</label>
            <input
              type="date"
              style={{ ...inputStyle, width: "100%" }}
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>End Date</label>
            <input
              type="date"
              style={{ ...inputStyle, width: "100%" }}
              value={form.end_date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              required
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn type="button" onClick={onHide} variant="secondary">Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? "Creating..." : "Create Term"}</Btn>
        </div>
      </form>
    </Modal>
  );
}

CreateTermModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  form: PropTypes.object,
  setForm: PropTypes.func,
  academicYear: PropTypes.string,
};

function CloseTermModal({ show, onHide, onConfirm, loading, term }) {
  return (
    <Modal isOpen={show} onHide={onHide} title="Close Current Term">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: C.amberDim, border: "1px solid #F59E0B", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#F59E0B" }}>
          <strong>Warning:</strong> This will lock {term?.term_name || "the current term"} and prepare balances for carry forward. This action cannot be undone.
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.text }}>
            <span>Term</span>
            <span style={{ fontWeight: 600 }}>{term?.term_name || "Unknown"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.text }}>
            <span>Archive grades</span>
            <span style={{ color: "#22C55E" }}>Yes</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.text }}>
            <span>Carry forward unpaid balances</span>
            <span style={{ color: "#22C55E" }}>Yes</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <Btn onClick={onHide} variant="secondary">Cancel</Btn>
          <Btn onClick={onConfirm} variant="danger" disabled={loading}>
            {loading ? "Closing Term..." : "Confirm Term Closure"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

CloseTermModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  term: PropTypes.object,
};

const inputStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg-card)",
  color: "var(--color-text-primary)",
  padding: "10px 14px",
  fontSize: 14,
  outline: "none",
};
