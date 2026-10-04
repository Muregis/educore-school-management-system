import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { pager } from "../components/Helpers";
import { csv } from "../lib/utils";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import Table from "../components/ui/Table";

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

export default function SubjectsPage({ auth, toast, canEdit = true }) {
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
        const newSubject = normaliseSubject({
          ...res,
          subject_id: res.subject_id || res.id,
          name: res.name || form.name,
          code: res.code || form.code,
          category: res.category || form.category,
        });
        setSubjects(prev => [...prev, newSubject]);
        toast("Subject created", "success");
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

  const categories = useMemo(() => [...new Set(subjects.map(s => s.category).filter(Boolean))], [subjects]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        <Badge text={`Total: ${subjects.length}`} variant="info" />
        <Badge text={`Active: ${subjects.filter(s => s.isActive).length}`} variant="success" />
        <Badge text={`Categories: ${categories.length}`} variant="warning" />
      </div>

      {/* Operations */}
      <Card style={{ padding: "var(--space-3)" }}>
        <h4 style={{ margin: "0 0 var(--space-2)", color: "var(--color-text-primary)", fontSize: "16px", fontWeight: 600 }}>Operations</h4>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={exportCSV}>📤 Export CSV</Button>
        </div>
      </Card>

      {/* Actions & Filters */}
      <Card style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", flex: 1 }}>
            <div style={{ minWidth: "200px" }}>
              <Input 
                placeholder="Search subjects..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ minWidth: "180px" }}>
              <Select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)}
                options={[
                  { value: "all", label: "All Categories" },
                  ...categories.map(c => ({ value: c, label: c }))
                ]}
              />
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {canEdit && <Button variant="secondary" onClick={seedDefaults}>⚡ Load Defaults</Button>}
            {canEdit && <Button onClick={() => { resetForm(); setShowModal(true); }}>+ Add Subject</Button>}
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <EmptyState icon="⏳" title="Loading Subjects" description="Please wait while we load the curriculum..." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="📚" title="No Subjects Found" description={search || filterCategory !== "all" ? "No subjects match your current filters." : "No subjects yet. Add your first subject!"} />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Table
            headers={["Name", "Code", "Category", "Grading", "Status", "Actions"]}
            data={rows.map(s => [
              <span key="n" style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{s.name}</span>,
              <span key="code" style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{s.code || "-"}</span>,
              <Badge key="c" text={s.category} variant="info" />,
              <span key="grading" style={{ color: "var(--color-text-secondary)", fontSize: "13px" }}>{s.passMarks}/{s.maxMarks}</span>,
              <Badge key="s" text={s.isActive ? "Active" : "Inactive"} variant={s.isActive ? "success" : "neutral"} />,
              <div key="a" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {canEdit && <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>Edit</Button>}
                {canEdit && <Button size="sm" variant="danger" onClick={() => del(s.id)}>Delete</Button>}
              </div>,
            ])}
          />
          <div style={{ padding: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
            <Pager page={page} pages={pages} setPage={setPage} />
          </div>
        </Card>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} title={editingId ? "Edit Subject" : "Add Subject"} onClose={() => { setShowModal(false); resetForm(); }} footer={
        <>
          <Button variant="ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editingId ? "Save Changes" : "Create Subject"}</Button>
        </>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Input 
            label="Subject Name *"
            value={form.name} 
            onChange={e => setForm({ ...form, name: e.target.value })} 
            placeholder="e.g. Mathematics" 
          />
          
          <Input 
            label="Subject Code"
            value={form.code} 
            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} 
            placeholder="e.g. MAT" 
          />
          
          <Select 
            label="Category"
            value={form.category} 
            onChange={e => setForm({ ...form, category: e.target.value })}
            options={CATEGORIES.map(c => ({ value: c, label: c }))}
          />
          
          <Select 
            label="Status"
            value={form.isActive ? "true" : "false"} 
            onChange={e => setForm({ ...form, isActive: e.target.value === "true" })}
            options={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" }
            ]}
          />
          
          <Input 
            label="Pass Marks"
            type="number" 
            value={form.passMarks} 
            onChange={e => setForm({ ...form, passMarks: e.target.value })} 
            min="0" 
            max="100" 
          />
          
          <Input 
            label="Max Marks"
            type="number" 
            value={form.maxMarks} 
            onChange={e => setForm({ ...form, maxMarks: e.target.value })} 
            min="1" 
            max="500" 
          />
          
          <div style={{ gridColumn: "1 / -1" }}>
            <Input 
              label="Description"
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
              placeholder="Brief description of the subject" 
            />
          </div>
          
          <div style={{ gridColumn: "1 / -1" }}>
            <Input 
              label="Applicable Classes"
              value={form.classLevels} 
              onChange={e => setForm({ ...form, classLevels: e.target.value })} 
              placeholder="e.g. Grade 1,Grade 2,Grade 3 (leave empty for all classes)" 
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

SubjectsPage.propTypes = {
  auth: PropTypes.object,
  toast: PropTypes.func.isRequired,
  canEdit: PropTypes.bool,
};
