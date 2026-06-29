import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { apiFetch } from "../lib/api";
import { money } from "../lib/utils";
import { exportCsv } from "../utils/reportExport";
import { printHTML } from "../lib/print";

export default function JournalEntriesPage({ auth, toast }) {
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    reference: "",
    entry_date: new Date().toISOString().split('T')[0],
    lines: [{ account_id: "", debit: 0, credit: 0 }]
  });
  const [accounts, setAccounts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadJournalEntries();
    loadAccounts();
  }, []);

  const loadJournalEntries = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/finance/journal-entries", { token: auth?.token });
      setJournalEntries(data || []);
    } catch (err) {
      toast("Failed to load journal entries", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const entryBlocks = journalEntries.map(entry => {
      const lineRows = (entry.journal_entry_lines || []).map(line => `
        <tr>
          <td style="padding-left: 20px">${line.chart_of_accounts?.account_name || line.account_id}</td>
          <td style="text-align: right; color: green">${line.debit > 0 ? money(line.debit) : "—"}</td>
          <td style="text-align: right; color: red">${line.credit > 0 ? money(line.credit) : "—"}</td>
        </tr>
      `).join("");
      return `
        <div style="margin-bottom: 16px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
          <div style="padding: 10px; background: #f5f5f5; display: flex; justify-content: space-between;">
            <span style="font-weight: 700">${entry.entry_number || `JE-${entry.id}`}</span>
            <span>${new Date(entry.entry_date).toLocaleDateString()}</span>
            <span style="font-size: 12px; color: #666">${entry.created_by || "—"}</span>
          </div>
          ${entry.description ? `<div style="padding: 6px 10px; font-size: 13px; color: #555">${entry.description}</div>` : ""}
          <table style="width: 100%; border-collapse: collapse;">
            <thead><tr><th style="text-align: left">Account</th><th style="text-align: right">Debit</th><th style="text-align: right">Credit</th></tr></thead>
            <tbody>${lineRows}</tbody>
          </table>
        </div>
      `;
    }).join("");
    const html = `
      <html>
      <head><title>Journal Entries</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { margin: 0 0 4px; font-size: 22px; }
      </style>
      </head>
      <body>
        <div class="header">
          <h1>Journal Entries</h1>
        </div>
        ${entryBlocks || '<p style="text-align: center; color: #999">No journal entries found.</p>'}
      </body>
      </html>
    `;
    printHTML(html, { title: "Journal Entries" });
  };

  const handleExport = () => {
    const headers = ["Entry Number", "Date", "Description", "Account", "Debit", "Credit"];
    const rows = [];
    journalEntries.forEach(entry => {
      (entry.journal_entry_lines || []).forEach(line => {
        rows.push([
          entry.entry_number || `JE-${entry.id}`,
          new Date(entry.entry_date).toLocaleDateString(),
          entry.description || "",
          line.chart_of_accounts?.account_name || line.account_id,
          String(line.debit || 0),
          String(line.credit || 0),
        ]);
      });
    });
    exportCsv("journal-entries.csv", headers, rows);
  };

  const loadAccounts = async () => {
    try {
      const data = await apiFetch("/finance/accounts", { token: auth?.token });
      setAccounts(data || []);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate debits equal credits
    const totalDebit = formData.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = formData.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast("Debits must equal credits", "error");
      return;
    }

    if (totalDebit === 0) {
      toast("Entry amount cannot be zero", "error");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/finance/journal-entries", {
        method: "POST",
        token: auth?.token,
        body: formData
      });
      toast("Journal entry created successfully", "success");
      setShowModal(false);
      setFormData({
        description: "",
        reference: "",
        entry_date: new Date().toISOString().split('T')[0],
        lines: [{ account_id: "", debit: 0, credit: 0 }]
      });
      loadJournalEntries();
    } catch (err) {
      toast(err.message || "Failed to create journal entry", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account_id: "", debit: 0, credit: 0 }]
    });
  };

  const removeLine = (index) => {
    if (formData.lines.length > 1) {
      setFormData({
        ...formData,
        lines: formData.lines.filter((_, i) => i !== index)
      });
    }
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const totalDebits = formData.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  const totalCredits = formData.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading journal entries...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "24px", fontWeight: 700 }}>
            Journal Entries
          </h2>
          <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Record and manage adjusting journal entries
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button onClick={() => setShowModal(true)} variant="primary">
            + New Entry
          </Button>
          <Button onClick={handleExport} variant="secondary">📥 Export CSV</Button>
          <Button onClick={handlePrint} variant="secondary">🖨️ Print</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <StatCard 
          title="Total Entries" 
          value={journalEntries.length} 
          icon="📝"
          trend={0}
        />
        <StatCard 
          title="This Month" 
          value={journalEntries.filter(e => {
            const entryDate = new Date(e.entry_date);
            const now = new Date();
            return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
          }).length} 
          icon="📅"
          trend={0}
        />
      </div>

      {/* Journal Entries Table */}
      <Card>
        {journalEntries.length === 0 ? (
          <div style={{ padding: "60px var(--space-4)" }}>
            <EmptyState icon="📝" title="No Journal Entries" description="No journal entries found." />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Date", "Reference", "Description", "Total Amount", "Created By", "Created At"]}
              data={journalEntries.map(entry => {
                const totalAmount = entry.lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
                return [
                  <span key="date">{new Date(entry.entry_date).toLocaleDateString()}</span>,
                  <span key="ref" style={{ fontFamily: "monospace" }}>{entry.reference || "—"}</span>,
                  <span key="desc" style={{ fontWeight: 600 }}>{entry.description}</span>,
                  <span key="amount" style={{ fontWeight: 600 }}>{money(totalAmount)}</span>,
                  <span key="created">{entry.created_by || "—"}</span>,
                  <span key="created_at" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {new Date(entry.created_at).toLocaleString()}
                  </span>,
                ];
              })}
            />
          </div>
        )}
      </Card>

      {/* New Journal Entry Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Journal Entry">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "13px" }}>
                Description *
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-card)",
                  color: "var(--color-text-primary)"
                }}
                placeholder="Enter entry description"
              />
            </div>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "13px" }}>
                Reference
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-card)",
                  color: "var(--color-text-primary)"
                }}
                placeholder="Optional reference number"
              />
            </div>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600, fontSize: "13px" }}>
                Entry Date *
              </label>
              <input
                type="date"
                required
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-card)",
                  color: "var(--color-text-primary)"
                }}
              />
            </div>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <label style={{ fontWeight: 600, fontSize: "13px" }}>Entry Lines</label>
                <Button type="button" onClick={addLine} variant="ghost" size="sm">+ Add Line</Button>
              </div>
              
              {formData.lines.map((line, index) => (
                <div key={index} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  <select
                    required
                    value={line.account_id}
                    onChange={(e) => updateLine(index, "account_id", e.target.value)}
                    style={{
                      padding: "8px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-bg-card)",
                      color: "var(--color-text-primary)"
                    }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_code} - {acc.account_name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debit || ""}
                    onChange={(e) => updateLine(index, "debit", parseFloat(e.target.value) || 0)}
                    style={{
                      padding: "8px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-bg-card)",
                      color: "var(--color-text-primary)"
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.credit || ""}
                    onChange={(e) => updateLine(index, "credit", parseFloat(e.target.value) || 0)}
                    style={{
                      padding: "8px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-bg-card)",
                      color: "var(--color-text-primary)"
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => removeLine(index)}
                    variant="ghost"
                    size="sm"
                    disabled={formData.lines.length === 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* Balance Check */}
            <Card style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: isBalanced ? "var(--color-bg-success)" : "var(--color-bg-error)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total Debits:</span>
                <span style={{ fontWeight: 700 }}>{money(totalDebits)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total Credits:</span>
                <span style={{ fontWeight: 700 }}>{money(totalCredits)}</span>
              </div>
              <div style={{ marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--color-border)", fontWeight: 700, textAlign: "center" }}>
                {isBalanced ? "✅ Balanced" : "❌ Not Balanced"}
              </div>
            </Card>

            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
              <Button type="button" onClick={() => setShowModal(false)} variant="secondary">
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!isBalanced || totalDebits === 0 || submitting}>
                {submitting ? "Creating..." : "Create Entry"}
              </Button>
            </div>
          </form>
      </Modal>
    </div>
  );
}

JournalEntriesPage.propTypes = {
  auth: PropTypes.object.isRequired,
  toast: PropTypes.func.isRequired
};
