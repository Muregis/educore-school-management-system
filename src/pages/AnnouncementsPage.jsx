import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Btn from "../components/Btn";
import Field from "../components/Field";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import { C, inputStyle } from "../lib/theme";
import { apiFetch } from "../lib/api";

const TYPE_OPTIONS = [
  { value: "general", label: "General", color: "#3B82F6" },
  { value: "academic", label: "Academic", color: "#10B981" },
  { value: "event", label: "Event", color: "#F59E0B" },
  { value: "emergency", label: "Emergency", color: "#EF4444" }
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "#6B7280" },
  { value: "normal", label: "Normal", color: "#3B82F6" },
  { value: "high", label: "High", color: "#F59E0B" },
  { value: "urgent", label: "Urgent", color: "#EF4444" }
];

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Users" },
  { value: "teachers", label: "Teachers Only" },
  { value: "students", label: "Students Only" },
  { value: "parents", label: "Parents Only" }
];

const STATUS_COLORS = {
  draft: { bg: "#1F2937", color: "#9CA3AF", label: "Draft" },
  published: { bg: "#065F46", color: "#34D399", label: "Published" },
  archived: { bg: "#451A03", color: "#FCD34D", label: "Archived" }
};

function AnnouncementCard({ announcement, onEdit, onDelete, onPublish, canEdit }) {
  const typeInfo = TYPE_OPTIONS.find(t => t.value === announcement.type) || TYPE_OPTIONS[0];
  const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === announcement.priority) || PRIORITY_OPTIONS[1];
  const statusInfo = STATUS_COLORS[announcement.status] || STATUS_COLORS.draft;

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      position: 'relative'
    }}>
      {announcement.pinned && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: "#F59E0B",
          color: "#FFFFFF",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 4
        }}>
          📌 Pinned
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {announcement.title}
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              background: typeInfo.color + "20",
              color: typeInfo.color,
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600
            }}>
              {typeInfo.label}
            </span>
            <span style={{
              background: priorityInfo.color + "20",
              color: priorityInfo.color,
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600
            }}>
              {priorityInfo.label}
            </span>
            <span style={{
              background: statusInfo.bg,
              color: statusInfo.color,
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600
            }}>
              {statusInfo.label}
            </span>
          </div>
        </div>
        
        {canEdit && (
          <div style={{ display: "flex", gap: 6 }}>
            {announcement.status === 'draft' && (
              <Btn
                size="small"
                onClick={() => onPublish(announcement.announcement_id)}
                style={{ background: "#10B981", color: "#FFFFFF" }}
              >
                Publish
              </Btn>
            )}
            <Btn variant="ghost" size="small" onClick={() => onEdit(announcement)}>
              Edit
            </Btn>
            <Btn variant="danger" size="small" onClick={() => onDelete(announcement.announcement_id)}>
              Delete
            </Btn>
          </div>
        )}
      </div>

      <div style={{
        color: C.textSub,
        fontSize: 14,
        lineHeight: 1.6,
        marginBottom: 16,
        whiteSpace: "pre-wrap"
      }}>
        {announcement.message}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: C.textMuted }}>
        <div>
          Target: <strong>{AUDIENCE_OPTIONS.find(a => a.value === announcement.target_audience)?.label || "All"}</strong>
        </div>
        <div>
          By: <strong>{announcement.users?.full_name || "Unknown"}</strong>
        </div>
        <div>
          {announcement.publish_date ? `Published: ${new Date(announcement.publish_date).toLocaleDateString()}` : `Created: ${new Date(announcement.created_at).toLocaleDateString()}`}
        </div>
        {announcement.expiry_date && (
          <div>
            Expires: <strong>{new Date(announcement.expiry_date).toLocaleDateString()}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnnouncementsPage({ auth, toast }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({
    status: 'published',
    target_audience: 'all'
  });

  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'general',
    priority: 'normal',
    target_audience: 'all',
    pinned: false,
    publish_date: '',
    expiry_date: ''
  });

  const canEdit = auth?.role === 'admin' || auth?.role === 'teacher';
  const isPortal = auth?.role === "parent" || auth?.role === "student";

  const loadAnnouncements = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const effectiveFilter = isPortal
        ? {
            // OLD: status: filter.status,
            status: "published",
            // OLD: target_audience: filter.target_audience
            target_audience: auth?.role === "parent" ? "parents" : "students",
          }
        : filter;
      const params = new URLSearchParams(effectiveFilter);
      const data = await apiFetch(`/announcements?${params}`, { token: auth.token });
      setAnnouncements(data || []);
    } catch (err) {
      toast(err.message || "Failed to load announcements", "error");
    } finally {
      setLoading(false);
    }
  }, [auth, filter, isPortal, toast]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const saveAnnouncement = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      return toast("Title and message are required", "error");
    }

    try {
      if (editing) {
        await apiFetch(`/announcements/${editing.announcement_id}`, {
          method: "PUT",
          body: form,
          token: auth.token
        });
        toast("Announcement updated", "success");
      } else {
        await apiFetch("/announcements", {
          method: "POST",
          body: form,
          token: auth.token
        });
        toast("Announcement created", "success");
      }
      
      setShowModal(false);
      setEditing(null);
      setForm({
        title: '',
        message: '',
        type: 'general',
        priority: 'normal',
        target_audience: 'all',
        pinned: false,
        publish_date: '',
        expiry_date: ''
      });
      loadAnnouncements();
    } catch (err) {
      toast(err.message || "Failed to save announcement", "error");
    }
  };

  const publishAnnouncement = async (id) => {
    try {
      await apiFetch(`/announcements/${id}/publish`, {
        method: "POST",
        token: auth.token
      });
      toast("Announcement published", "success");
      loadAnnouncements();
    } catch (err) {
      toast(err.message || "Failed to publish announcement", "error");
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    
    try {
      await apiFetch(`/announcements/${id}`, {
        method: "DELETE",
        token: auth.token
      });
      toast("Announcement deleted", "success");
      loadAnnouncements();
    } catch (err) {
      toast(err.message || "Failed to delete announcement", "error");
    }
  };

  const openEdit = (announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      priority: announcement.priority,
      target_audience: announcement.target_audience,
      pinned: announcement.pinned,
      publish_date: announcement.publish_date?.slice(0, 10) || '',
      expiry_date: announcement.expiry_date?.slice(0, 10) || ''
    });
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      title: '',
      message: '',
      type: 'general',
      priority: 'normal',
      target_audience: 'all',
      pinned: false,
      publish_date: '',
      expiry_date: ''
    });
    setShowModal(true);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: C.text, fontSize: 24, fontWeight: 700 }}>
          📢 Announcements & Liveboard
        </h2>
        
        {canEdit && (
          <Btn onClick={openNew}>
            + New Announcement
          </Btn>
        )}
      </div>

      {/* Filters */}
      {!isPortal && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
              Status
            </label>
            <select
              style={inputStyle}
              value={filter.status}
              onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
              Audience
            </label>
            <select
              style={inputStyle}
              value={filter.target_audience}
              onChange={e => setFilter(f => ({ ...f, target_audience: e.target.value }))}
            >
              {AUDIENCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
          Loading announcements...
        </div>
      ) : announcements.length === 0 ? (
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 60,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📢</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            No announcements yet
          </div>
          <div style={{ color: C.textMuted, marginBottom: 20 }}>
            {canEdit ? "Create your first announcement to keep everyone informed" : "No announcements have been published yet"}
          </div>
          {canEdit && (
            <Btn onClick={openNew}>
              Create Announcement
            </Btn>
          )}
        </div>
      ) : (
        <div>
          {announcements.map(announcement => (
            <AnnouncementCard
              key={announcement.announcement_id}
              announcement={announcement}
              onEdit={openEdit}
              onDelete={deleteAnnouncement}
              onPublish={publishAnnouncement}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          title={editing ? "Edit Announcement" : "New Announcement"}
          onClose={() => setShowModal(false)}
          size="large"
        >
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Title">
              <input
                style={inputStyle}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Enter announcement title"
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                  Type
                </label>
                <select
                  style={inputStyle}
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                  Priority
                </label>
                <select
                  style={inputStyle}
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                  Audience
                </label>
                <select
                  style={inputStyle}
                  value={form.target_audience}
                  onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                >
                  {AUDIENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Field label="Message">
              <textarea
                style={{ ...inputStyle, height: 120, resize: "vertical", fontFamily: "'Segoe UI', Arial, sans-serif" }}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Enter your announcement message..."
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Publish Date (optional)">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.publish_date}
                  onChange={e => setForm(f => ({ ...f, publish_date: e.target.value }))}
                />
              </Field>

              <Field label="Expiry Date (optional)">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.expiry_date}
                  onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                />
              </Field>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="pinned"
                checked={form.pinned}
                onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="pinned" style={{ color: C.text, fontSize: 14 }}>
                Pin to top (important announcement)
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Btn>
            <Btn onClick={saveAnnouncement}>
              {editing ? "Update" : "Create"} Announcement
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

AnnouncementsPage.propTypes = {
  auth: PropTypes.object,
  toast: PropTypes.func
};
