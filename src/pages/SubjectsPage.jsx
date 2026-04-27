import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { Pager, Msg, pager } from "../components/Helpers";
import { csv } from "../lib/utils";

const CATEGORIES = ["Languages", "Sciences", "Humanities", "Technical", "Creative", "Other"];

function normaliseSubject(s) {
  return {
    id: s.subject_id ?? s.id,
    name: s.name ?? "",
    code: s.code ?? "",
    category: s.category ?? "Other",
    description: s.description ?? "",
    classLevels: s.class_levels ?? s.classLevels ?? "",
    maxMarks: s.max_marks ?? s.maxMarks ?? 100,
    passMarks: s.pass_marks ?? s.passMarks ?? 40,
    isActive: s.is_active ?? s.isActive ?? true,
    createdAt: s.created_at ?? s.createdAt,
  };
}

export default function SubjectsPage({ auth, toast }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [page, setPage] = useState(1);

  // Form state
  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "Sciences",
    description: "",
    classLevels: "",
    maxMarks: 100,
    passMarks: 40,
    isActive: true,
  });

  // Load subjects
  const loadSubjects = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const data = await apiFetch("/subjects", { token: auth.token });
      setSubjects((data || []).map(normaliseSubject));
    } catch (e) {
      console.error("Subjects load error:", e);
      toast(e.message || "Failed to load subjects", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  // Filter and paginate
  const filtered = useMemo(() => {
    return subjects.filter(s => {
      const matchesSearch = !search || 
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = filterCategory === "all" || s.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [subjects, search, filterCategory]);

  const { pages, rows } = pager(filtered, page, 10);
  useEffect(() => { if (page > pages && pages > 0) setPage(1); }, [page, pages]);

  // Reset form
  const resetForm = () => {
    setForm({
      name: "",
      code: "",
      category: "Sciences",
      description: "",
      classLevels: "",
      maxMarks: 100,
      passMarks: 40,
      isActive: true,
    });
    setEditingId(null);
  };

  // Open add modal
  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = (subject) => {
    setForm({
      name: subject.name,
      code: subject.code,
      category: subject.category,
      description: subject.description,
      classLevels: subject.classLevels,
      maxMarks: subject.maxMarks,
      passMarks: subject.passMarks,
      isActive: subject.isActive,
    });
    setEditingId(subject.id);
    setShowModal(true);
  };

  // Save subject
  const save = async () => {
    if (!form.name.trim()) {
      toast("Subject name is required", "error");
      return;
    }
    
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/subjects/${editingId}`, {
          method: "PUT",
          body: {
            name: form.name,
            code: form.code || null,
            category: form.category,
            description: form.description || null,
            classLevels: form.classLevels || null,
            maxMarks: Number(form.maxMarks),
            passMarks: Number(form.passMarks),
            isActive: form.isActive,
          },
          token: auth?.token,
        });
        setSubjects(prev => prev.map(s => s.id === editingId ? { ...s, ...form, id: editingId } : s));
        toast("Subject updated", "success");
        // Refetch to ensure consistency
        await loadSubjects();
      } else {
        const res = await apiFetch("/subjects", {
          method: "POST",
          body: {
            name: form.name,
            code: form.code || null,
            category: form.category,
            description: form.description || null,
            classLevels: form.classLevels || null,
            maxMarks: Number(form.maxMarks),
            passMarks: Number(form.passMarks),
          },
          token: auth?.token,
        });
        // Ensure ID is properly set from various possible response formats
        const newSubject = normaliseSubject({
          ...res,
          subject_id: res.subject_id || res.id,
          name: res.name || form.name,
          code: res.code || form.code,
          category: res.category || form.category,
        });
        setSubjects(prev => [...prev, newSubject]);
        toast("Subject created", "success");
        // Force refetch to ensure consistency
        await loadSubjects();
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast(err.message || "Save failed", "error");
    }
    setSaving(false);
  };

  // Delete subject
  const del = async (id) => {
    if (!window.confirm("Delete this subject? This won't affect existing grades.")) return;
    try {
      await apiFetch(`/subjects/${id}`, { method: "DELETE", token: auth?.token });
      setSubjects(prev => prev.filter(s => s.id !== id));
      toast("Subject deleted", "success");
      // Refetch to ensure consistency
      await loadSubjects();
    } catch (err) {
      toast(err.message || "Delete failed", "error");
    }
  };

  // Seed default subjects
  const seedDefaults = async () => {
    if (!window.confirm("Add default Kenyan curriculum subjects?\n\nThis will add subjects like English, Mathematics, Biology, etc. Duplicates will be skipped.")) return;
    try {
      const res = await apiFetch("/subjects/seed-defaults", { method: "POST", token: auth?.token });
      await loadSubjects();
      toast(res.message || "Default subjects added", "success");
    } catch (err) {
      toast(err.message || "Failed to add defaults", "error");
    }
  };

  // Export subjects to CSV
  const exportCSV = () => {
    csv("subjects.csv",
      ["Name", "Code", "Category", "Description", "Class Levels", "Max Marks", "Pass Marks", "Status"],
      filtered.map(s => [
        s.name || "",
        s.code || "",
        s.category || "",
        s.description || "",
        s.classLevels || "",
        s.maxMarks || "",
        s.passMarks || "",
        s.isActive ? "Active" : "Inactive"
      ])
    );
    toast("Subjects CSV exported", "success");
  };

  // Unique categories from data
  const categories = useMemo(() => [...new Set(subjects.map(s => s.category).filter(Boolean))], [subjects]);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Badge text={`Total: ${subjects.length}`} tone="info" />
        <Badge text={`Active: ${subjects.filter(s => s.isActive).length}`} tone="success" />
        <Badge text={`Categories: ${categories.length}`} tone="warning" />
      </div>

      {/* Operations */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <h4 style={{ margin: "0 0 12px", color: C.text, fontSize: 16 }}>Operations</h4>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={exportCSV}>📤 Export CSV</Btn>
        </div>
      </div>

      {/* Actions & Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
        <input 
          type="text" 
          placeholder="Search subjects..." 
          style={inputStyle} 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inputStyle} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Btn onClick={openAdd}>+ Add Subject</Btn>
        <Btn variant="ghost" onClick={seedDefaults}>⚡ Load Defaults</Btn>
      </div>

      {/* Table */}
      {loading ? (
        <Msg text="Loading subjects..." />
      ) : filtered.length === 0 ? (
        <Msg text={search || filterCategory !== "all" ? "No subjects match your filters" : "No subjects yet. Add your first subject!"} />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <Table
              headers={["Name", "Code", "Category", "Grading", "Status", "Actions"]}
              rows={rows.map(s => [
                <span key="n" style={{ fontWeight: 600, color: C.text }}>{s.name}</span>,
                s.code || "-",
                <Badge key="c" text={s.category} tone="info" />,
                `${s.passMarks}/${s.maxMarks}`,
                <Badge key="s" text={s.isActive ? "Active" : "Inactive"} tone={s.isActive ? "success" : "danger"} />,
                <div key="a" style={{ display: "flex", gap: 6 }}>
                  <Btn variant="ghost" onClick={() => openEdit(s)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => del(s.id)}>Delete</Btn>
                </div>,
              ])}
            />
          </div>
          <Pager page={page} pages={pages} setPage={setPage} />
        </>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editingId ? "Edit Subject" : "Add Subject"} onClose={() => { setShowModal(false); resetForm(); }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Subject Name *">
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
            </Field>
            <Field label="Subject Code">
              <input style={inputStyle} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. MAT" />
            </Field>
            <Field label="Category">
              <select style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.value === "true" })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </Field>
            <Field label="Pass Marks">
              <input type="number" style={inputStyle} value={form.passMarks} onChange={e => setForm({ ...form, passMarks: e.target.value })} min="0" max="100" />
            </Field>
            <Field label="Max Marks">
              <input type="number" style={inputStyle} value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} min="1" max="500" />
            </Field>
            <Field label="Description" style={{ gridColumn: "1 / -1" }}>
              <input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the subject" />
            </Field>
            <Field label="Applicable Classes" style={{ gridColumn: "1 / -1" }}>
              <input style={inputStyle} value={form.classLevels} onChange={e => setForm({ ...form, classLevels: e.target.value })} placeholder="e.g. Grade 1,Grade 2,Grade 3 (leave empty for all classes)" />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Btn>
            <Btn onClick={save} loading={saving}>{editingId ? "Save Changes" : "Create Subject"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

SubjectsPage.propTypes = {
  auth: PropTypes.object,
  toast: PropTypes.func.isRequired,
};
