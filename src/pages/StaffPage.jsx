import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { apiFetch } from "../lib/api";
import { csv } from "../lib/utils";
import Card from "../components/ui/Card";
import Table from "../components/ui/Table";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";

export default function StaffPage({ auth, canEdit = true, toast, onTeachersChanged }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "teacher", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const data = await apiFetch("/teachers", { token: auth.token });
      setStaff(Array.isArray(data) ? data : data?.teachers || []);
    } catch (e) {
      toast?.(e?.message || "Failed to load staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [auth?.token]);

  const filtered = staff.filter((s) => {
    const name = (s.full_name || s.name || "").toLowerCase();
    const email = (s.email || "").toLowerCase();
    const role = (s.role || "").toLowerCase();
    const matchQ = !q || name.includes(q.toLowerCase()) || email.includes(q.toLowerCase());
    const matchRole = !roleFilter || role === roleFilter.toLowerCase();
    return matchQ && matchRole;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: "", email: "", phone: "", role: "teacher", notes: "" });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      full_name: row.full_name || row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      role: row.role || "teacher",
      notes: row.notes || "",
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.full_name?.trim() || !form.email?.trim()) {
      toast?.("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/teachers/${editing.teacher_id || editing.id}`, {
          method: "PUT",
          token: auth.token,
          body: form,
        });
        toast?.("Staff updated");
      } else {
        await apiFetch("/teachers", { method: "POST", token: auth.token, body: form });
        toast?.("Staff created");
      }
      setShowModal(false);
      await load();
      onTeachersChanged?.();
    } catch (e) {
      toast?.(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const teachersCount = staff.filter((s) => (s.role || "").toLowerCase() === "teacher").length;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display:"grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "var(--space-3)" }}>
        <Card>
          <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Total Staff</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{loading ? "…" : staff.length}</div>
        </Card>
        <Card>
          <div style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Teachers</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{loading ? "…" : teachersCount}</div>
        </Card>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[
            { value: "", label: "All roles" },
            { value: "teacher", label: "Teacher" },
            { value: "admin", label: "Admin" },
          ]}
        />
        {canEdit && <Button onClick={openCreate}>Add staff</Button>}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Table
          headers={["Name", "Email", "Phone", "Role", "Actions"]}
          data={filtered}
          loading={loading}
          renderRow={(row) => [
            row.full_name || row.name || "—",
            row.email || "—",
            row.phone || "—",
            <Badge key="r" text={row.role || "staff"} />,
            canEdit ? (
              <Button key="e" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
            ) : (
              "—"
            ),
          ]}
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit staff" : "Add staff"}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap:"var(--space-4)" }}>
          <Input label="Full name" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            options={[
              { value: "teacher", label: "Teacher" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              style={{
                width: "100%",
                padding: "var(--space-3)",
                background: "var(--color-bg-base)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text-primary)",
                minHeight: 80,
              }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

StaffPage.propTypes = {
  auth: PropTypes.object,
  canEdit: PropTypes.bool,
  toast: PropTypes.func.isRequired,
  onTeachersChanged: PropTypes.func,
};
