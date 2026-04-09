import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Pager, Msg, pager } from "../components/Helpers";

const EXAM_TYPES = [
  { id: "internal", label: "Internal Exam" },
  { id: "midterm", label: "Mid-Term" },
  { id: "endterm", label: "End of Term" },
  { id: "KCPE", label: "KCPE" },
  { id: "KCSE", label: "KCSE" },
];

const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function ExamsPage({ auth, students, subjects, toast }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeTab, setActiveTab] = useState("exams");
  const [page, setPage] = useState(1);

  // Form states
  const [form, setForm] = useState({
    name: "",
    examType: "internal",
    term: "Term 1",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
    description: "",
  });

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
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub }}>Total Exams</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{exams.length}</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub }}>Active</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#22C55E" }}>
            {exams.filter(e => e.status === "active").length}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: C.textSub }}>Published</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#3B82F6" }}>
            {exams.filter(e => e.status === "published").length}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Btn onClick={() => setShowModal(true)}>+ Create Exam</Btn>
      </div>

      {/* Table */}
      {loading ? (
        <Msg text="Loading exams..." />
      ) : exams.length === 0 ? (
        <Msg text="No exams created yet. Create your first exam!" />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Name", "Type", "Term", "Year", "Dates", "Status", "Actions"]}
              rows={rows.map(e => [
                <span key="n" style={{ fontWeight: 600, color: C.text }}>{e.name}</span>,
                <Badge key="t" text={e.exam_type} tone="info" />,
                e.term,
                e.year,
                `${new Date(e.start_date).toLocaleDateString()} - ${new Date(e.end_date).toLocaleDateString()}`,
                <Badge key="s" text={e.status} tone={
                  e.status === "published" ? "success" : 
                  e.status === "active" ? "warning" : "info"
                } />,
                <div key="a" style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" onClick={() => setSelectedExam(e)}>View</Btn>
                  <Btn variant="ghost" onClick={() => { /* TODO: Edit */ }}>Edit</Btn>
                  <Btn variant="danger" onClick={() => deleteExam(e.exam_id)}>Delete</Btn>
                </div>,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Create Modal */}
      {showModal && (
        <Modal title="Create New Exam" onClose={() => setShowModal(false)}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Exam Name *">
              <input
                style={inputStyle}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Mid-Term Examination 2024"
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Exam Type">
                <select style={inputStyle} value={form.examType} onChange={e => setForm({ ...form, examType: e.target.value })}>
                  {EXAM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Term">
                <select style={inputStyle} value={form.term} onChange={e => setForm({ ...form, term: e.target.value })}>
                  {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Year">
              <input
                type="number"
                style={inputStyle}
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Start Date *">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.startDate}
                  onChange={e => setForm({ ...form, startDate: e.target.value })}
                />
              </Field>
              <Field label="End Date *">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.endDate}
                  onChange={e => setForm({ ...form, endDate: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                style={{ ...inputStyle, height: 80, resize: "vertical" }}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description or instructions"
              />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={saveExam}>Create Exam</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

ExamsPage.propTypes = {
  auth: PropTypes.object,
  students: PropTypes.array,
  subjects: PropTypes.array,
  toast: PropTypes.func.isRequired,
};
