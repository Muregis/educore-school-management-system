import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { pager } from "../components/Helpers";
import { useCurrentTerm } from "../hooks/useCurrentTerm";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

const EXAM_TYPES = [
  { id: "internal", label: "Internal Exam" },
  { id: "midterm", label: "Mid-Term" },
  { id: "endterm", label: "End of Term" },
  { id: "KCPE", label: "KCPE" },
  { id: "KCSE", label: "KCSE" },
];

const TERMS = ["Term 1", "Term 2", "Term 3"];

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center", marginTop: "var(--space-3)" }}>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === 1 ? "default" : "pointer" }}>‹</button>
      <span style={{ padding: "4px 10px", fontSize: "13px", color: "var(--color-text-secondary)" }}>{page} / {pages}</span>
      <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
        style={{ padding: "4px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-bg-surface)", color: "var(--color-text-secondary)", cursor: page === pages ? "default" : "pointer" }}>›</button>
    </div>
  );
}

export default function ExamsPage({ auth, students, subjects, toast }) {
  const { term, academicYear, startDate, endDate } = useCurrentTerm(auth);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeTab, setActiveTab] = useState("exams");
  const [page, setPage] = useState(1);

  // Form states - initialize with current term dates from school settings
  const [form, setForm] = useState({
    name: "",
    examType: "internal",
    term: term || "Term 1",
    year: academicYear || new Date().getFullYear(),
    startDate: startDate || "",
    endDate: endDate || "",
    description: "",
  });

  // Update form when term data changes
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      term: term || "Term 1",
      year: academicYear || new Date().getFullYear(),
      startDate: startDate || prev.startDate,
      endDate: endDate || prev.endDate,
    }));
  }, [term, academicYear, startDate, endDate]);

  // Load exams
  const loadExams = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const data = await apiFetch("/exams", { token: auth.token });
      setExams(data || []);
    } catch (e) {
      toast("Failed to load exams", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  // Pagination
  const { pages, rows } = pager(exams, page, 10);
  useEffect(() => { if (page > pages && pages > 0) setPage(1); }, [page, pages]);

  // Save exam
  const saveExam = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast("Name, start date and end date are required", "error");
      return;
    }

    try {
      await apiFetch("/exams", {
        method: "POST",
        body: {
          name: form.name,
          examType: form.examType,
          term: form.term,
          year: Number(form.year),
          startDate: form.startDate,
          endDate: form.endDate,
          description: form.description,
        },
        token: auth?.token,
      });
      toast("Exam created successfully", "success");
      setShowModal(false);
      setForm({
        name: "",
        examType: "internal",
        term: "Term 1",
        year: new Date().getFullYear(),
        startDate: "",
        endDate: "",
        description: "",
      });
      await loadExams();
    } catch (err) {
      toast(err.message || "Failed to create exam", "error");
    }
  };

  // Delete exam
  const deleteExam = async (id) => {
    if (!window.confirm("Delete this exam?")) return;
    try {
      await apiFetch(`/exams/${id}`, { method: "DELETE", token: auth?.token });
      toast("Exam deleted", "success");
      await loadExams();
    } catch (err) {
      toast(err.message || "Delete failed", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
        <Card style={{ padding: "var(--space-3)" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>Total Exams</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-text-primary)" }}>{exams.length}</div>
        </Card>
        <Card style={{ padding: "var(--space-3)" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>Active</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-success)" }}>
            {exams.filter(e => e.status === "active").length}
          </div>
        </Card>
        <Card style={{ padding: "var(--space-3)" }}>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>Published</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--color-info)" }}>
            {exams.filter(e => e.status === "published").length}
          </div>
        </Card>
      </div>

      {/* Actions Container */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button onClick={() => setShowModal(true)}>+ Create Exam</Button>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <EmptyState icon="⏳" title="Loading Exams" description="Please wait while we load your exam records..." />
      ) : exams.length === 0 ? (
        <EmptyState icon="📝" title="No Exams Yet" description="No exams created yet. Create your first exam to get started!" />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Name", "Type", "Term", "Year", "Dates", "Status", "Actions"]}
            data={rows.map(e => [
              <span key="n" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{e.name}</span>,
              <Badge key="t" text={e.exam_type} variant="info" />,
              <span key="term" style={{ color: "var(--color-text-secondary)" }}>{e.term}</span>,
              <span key="year" style={{ color: "var(--color-text-secondary)" }}>{e.year}</span>,
              <span key="dates" style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
                {new Date(e.start_date).toLocaleDateString()} - {new Date(e.end_date).toLocaleDateString()}
              </span>,
              <Badge key="s" text={e.status} variant={
                e.status === "published" ? "success" : 
                e.status === "active" ? "warning" : "neutral"
              } />,
              <div key="a" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <Button size="sm" variant="secondary" onClick={() => setSelectedExam(e)}>View</Button>
                <Button size="sm" variant="ghost" onClick={() => { /* TODO: Edit */ }}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => deleteExam(e.exam_id)}>Delete</Button>
              </div>,
            ])}
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal isOpen={showModal} title="Create New Exam" onClose={() => setShowModal(false)} footer={
        <>
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button onClick={saveExam}>Create Exam</Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <Input
              label="Exam Name *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Mid-Term Examination 2024"
            />
          </div>
          
          <Select 
            label="Exam Type"
            value={form.examType} 
            onChange={e => setForm({ ...form, examType: e.target.value })}
            options={EXAM_TYPES.map(t => ({ value: t.id, label: t.label }))}
          />
          
          <Select 
            label="Term"
            value={form.term} 
            onChange={e => setForm({ ...form, term: e.target.value })}
            options={TERMS.map(t => ({ value: t, label: t }))}
          />
          
          <div style={{ gridColumn: "1 / -1" }}>
            <Input
              label="Year"
              type="number"
              value={form.year}
              onChange={e => setForm({ ...form, year: e.target.value })}
            />
          </div>
          
          <Input
            label="Start Date *"
            type="date"
            value={form.startDate}
            onChange={e => setForm({ ...form, startDate: e.target.value })}
          />
          
          <Input
            label="End Date *"
            type="date"
            value={form.endDate}
            onChange={e => setForm({ ...form, endDate: e.target.value })}
          />
          
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
            <textarea
              style={{
                width: "100%",
                padding: "var(--space-3)",
                background: "var(--color-bg-base)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                height: 80,
                resize: "vertical"
              }}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description or instructions"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

ExamsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array,
  subjects: PropTypes.array,
  toast: PropTypes.func.isRequired,
};
