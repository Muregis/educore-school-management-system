import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Pager, Msg, pager } from "../components/Helpers";
import { money } from "../lib/utils";

export default function MpesaReconciliationPage({ auth, students, toast }) {
  const [unmatched, setUnmatched] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unmatched");
  const [page, setPage] = useState(1);
  
  // Modal states
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [matchNotes, setMatchNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Stats
  const stats = useMemo(() => ({
    totalUnmatched: unmatched.filter(u => u.status === 'unmatched').length,
    totalAmount: unmatched.filter(u => u.status === 'unmatched').reduce((sum, u) => sum + Number(u.amount), 0),
    matchedToday: unmatched.filter(u => u.status === 'matched' && new Date(u.matched_at).toDateString() === new Date().toDateString()).length,
  }), [unmatched]);

  // Load unmatched payments
  const loadUnmatched = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const [unmatchedRes, logsRes] = await Promise.all([
        apiFetch("/mpesa/unmatched?status=all", { token: auth.token }),
        apiFetch("/mpesa/reconciliation-logs?limit=20", { token: auth.token }),
      ]);
      setUnmatched(unmatchedRes || []);
      setLogs(logsRes || []);
    } catch (e) {
      toast("Failed to load M-Pesa data", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUnmatched();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadUnmatched, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  // Pagination
  const filteredUnmatched = useMemo(() => 
    activeTab === "unmatched" 
      ? unmatched.filter(u => u.status === 'unmatched')
      : unmatched.filter(u => u.status === 'matched'),
    [unmatched, activeTab]
  );
  
  const { pages, rows } = pager(filteredUnmatched, page, 10);
  useEffect(() => { if (page > pages && pages > 0) setPage(1); }, [page, pages]);

  // Match payment to student
  const handleMatch = async () => {
    if (!selectedStudent) {
      toast("Please select a student", "error");
      return;
    }
    
    setProcessing(true);
    try {
      await apiFetch(`/mpesa/reconcile/${selectedPayment.id}`, {
        method: "POST",
        body: { studentId: Number(selectedStudent), notes: matchNotes },
        token: auth?.token,
      });
      toast("Payment matched successfully", "success");
      setShowMatchModal(false);
      setSelectedPayment(null);
      setSelectedStudent("");
      setMatchNotes("");
      await loadUnmatched();
    } catch (err) {
      toast(err.message || "Failed to match payment", "error");
    }
    setProcessing(false);
  };

  // Ignore payment
  const handleIgnore = async (payment) => {
    if (!window.confirm("Mark this payment as ignored?\n\nThis means it won't appear in reconciliation lists.")) return;
    try {
      await apiFetch(`/mpesa/ignore/${payment.id}`, {
        method: "POST",
        body: { notes: "Manually ignored" },
        token: auth?.token,
      });
      toast("Payment marked as ignored", "success");
      await loadUnmatched();
    } catch (err) {
      toast(err.message || "Failed to ignore payment", "error");
    }
  };

  // Open match modal
  const openMatchModal = (payment) => {
    setSelectedPayment(payment);
    setSelectedStudent("");
    setMatchNotes("");
    setShowMatchModal(true);
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub, textTransform: "uppercase" }}>Unmatched Payments</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#F59E0B" }}>{stats.totalUnmatched}</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub, textTransform: "uppercase" }}>Total Unmatched Amount</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text }}>{money(stats.totalAmount)}</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub, textTransform: "uppercase" }}>Matched Today</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#22C55E" }}>{stats.matchedToday}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab("unmatched")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "unmatched" ? C.accent : C.surface,
            color: activeTab === "unmatched" ? "#fff" : C.text,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Needs Reconciliation ({stats.totalUnmatched})
        </button>
        <button
          onClick={() => setActiveTab("matched")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "matched" ? C.accent : C.surface,
            color: activeTab === "matched" ? "#fff" : C.text,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Recently Matched
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <Msg text="Loading M-Pesa data..." />
      ) : rows.length === 0 ? (
        <Msg text={activeTab === "unmatched" ? "No unmatched payments. All M-Pesa payments have been reconciled!" : "No matched payments yet."} />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date", "Transaction ID", "Amount", "Phone", "Account Number", "Status", "Actions"]}
              rows={rows.map(u => [
                new Date(u.created_at).toLocaleDateString(),
                <code key="tid" style={{ fontSize: 12 }}>{u.transaction_id}</code>,
                <span key="amt" style={{ fontWeight: 700, color: C.text }}>{money(u.amount)}</span>,
                u.phone_number || "-",
                u.bill_ref_number || "-",
                <Badge key="st" text={u.status} tone={u.status === 'matched' ? 'success' : u.status === 'ignored' ? 'danger' : 'warning'} />,
                <div key="act" style={{ display: "flex", gap: 6 }}>
                  {u.status === 'unmatched' && (
                    <>
                      <Btn variant="success" onClick={() => openMatchModal(u)}>Match</Btn>
                      <Btn variant="ghost" onClick={() => handleIgnore(u)}>Ignore</Btn>
                    </>
                  )}
                  {u.status === 'matched' && u.student && (
                    <span style={{ fontSize: 12, color: C.textSub }}>
                      → {u.student.first_name} {u.student.last_name}
                    </span>
                  )}
                </div>,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Match Modal */}
      {showMatchModal && selectedPayment && (
        <Modal title="Match M-Pesa Payment to Student" onClose={() => setShowMatchModal(false)}>
          <div style={{ marginBottom: 16, padding: 12, background: C.bg, borderRadius: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
              <div><span style={{ color: C.textSub }}>Amount:</span> <strong>{money(selectedPayment.amount)}</strong></div>
              <div><span style={{ color: C.textSub }}>Transaction ID:</span> {selectedPayment.transaction_id}</div>
              <div><span style={{ color: C.textSub }}>Phone:</span> {selectedPayment.phone_number || "-"}</div>
              <div><span style={{ color: C.textSub }}>Account #:</span> {selectedPayment.bill_ref_number || "-"}</div>
            </div>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: C.text }}>
              Select Student *
            </label>
            <select
              style={{ ...inputStyle, width: "100%" }}
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
            >
              <option value="">-- Select a student --</option>
              {students
                .filter(s => s.status === 'active' || s.status === 'Active')
                .sort((a, b) => (a.className || "").localeCompare(b.className || ""))
                .map(s => {
                  const sid = s.id ?? s.student_id;
                  const name = s.firstName ? `${s.firstName} ${s.lastName}` : `${s.first_name} ${s.last_name}`;
                  return (
                    <option key={sid} value={sid}>
                      {name} • {s.className} • {s.admission || s.admission_number}
                    </option>
                  );
                })}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: C.text }}>
              Notes (optional)
            </label>
            <textarea
              style={{ ...inputStyle, width: "100%", height: 80, resize: "vertical" }}
              value={matchNotes}
              onChange={e => setMatchNotes(e.target.value)}
              placeholder="E.g., Parent called to confirm, or why this payment was delayed..."
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowMatchModal(false)}>Cancel</Btn>
            <Btn onClick={handleMatch} loading={processing}>
              Match Payment to Student
            </Btn>
          </div>
        </Modal>
      )}

      {/* Reconciliation Logs */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: C.text }}>Recent Reconciliation Activity</h3>
        {logs.length === 0 ? (
          <Msg text="No reconciliation activity yet." />
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
            {logs.slice(0, 5).map(log => (
              <div key={log.id} style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                padding: "8px 0",
                borderBottom: `1px solid ${C.border}`
              }}>
                <div>
                  <Badge text={log.action} tone={log.action === 'match' ? 'success' : 'danger'} />
                  <span style={{ marginLeft: 8, color: C.text }}>
                    {log.unmatched?.transaction_id} • {money(log.unmatched?.amount)}
                  </span>
                  {log.student && (
                    <span style={{ marginLeft: 8, color: C.textSub }}>
                      → {log.student.first_name} {log.student.last_name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {new Date(log.created_at).toLocaleString()} by {log.performer?.full_name || "Admin"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

MpesaReconciliationPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array.isRequired,
  toast: PropTypes.func.isRequired,
};
