/**
 * Admin Permissions Management Page
 * Allows Directors to delegate specific permissions to Admins
 * Only accessible by Director role
 */

import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

export default function AdminPermissionsPage({ auth, toast }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Available permissions that can be delegated
  const availablePermissions = [
    { id: "students", label: "Students Management" },
    { id: "staff", label: "Staff/Teachers" },
    { id: "grades", label: "Grades & Results" },
    { id: "fees", label: "Fees & Payments" },
    { id: "admissions", label: "Admissions" },
    { id: "invoices", label: "Invoices" },
    { id: "reportcards", label: "Report Cards" },
    { id: "discipline", label: "Discipline" },
    { id: "transport", label: "Transport" },
    { id: "timetable", label: "Timetable" },
    { id: "reports", label: "Reports" },
    { id: "analytics", label: "Analytics" },
    { id: "accounts", label: "Accounts" },
    { id: "hr", label: "HR Management" },
    { id: "library", label: "Library" },
    { id: "exams", label: "Exams" },
    { id: "medical", label: "Medical Records" },
    { id: "bulk-import", label: "Bulk Import/Export" },
    { id: "branch-management", label: "Branch Management" },
  ];

  useEffect(() => {
    fetchAdmins();
  }, [auth?.token]);

  const fetchAdmins = async () => {
    try {
      const data = await apiFetch("/admin-permissions/admins", { token: auth?.token });
      setAdmins(data || []);
    } catch (err) {
      toast("Failed to load admins", "error");
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (adminId, permissionId) => {
    setAdmins(prev =>
      prev.map(admin => {
        if (admin.user_id === adminId) {
          const currentPerms = admin.delegated_permissions || [];
          const hasPermission = currentPerms.includes(permissionId);
          const newPerms = hasPermission
            ? currentPerms.filter(p => p !== permissionId)
            : [...currentPerms, permissionId];
          return { ...admin, delegated_permissions: newPerms };
        }
        return admin;
      })
    );
  };

  const savePermissions = async (adminId) => {
    const admin = admins.find(a => a.user_id === adminId);
    if (!admin) return;

    setSaving(true);
    try {
      await apiFetch(`/admin-permissions/${adminId}/permissions`, {
        method: "PUT",
        token: auth?.token,
        body: { delegated_permissions: admin.delegated_permissions || [] }
      });
      toast("Permissions saved", "success");
    } catch (err) {
      toast("Failed to save permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Permissions Management</h1>
      <p className="text-gray-600 mb-6">
        As Director, you can delegate specific permissions to Admins. By default, admins have limited access (students, attendance, communication).
      </p>

      <div className="space-y-6">
        {admins.map(admin => (
          <div key={admin.user_id} className="bg-white rounded-lg shadow p-6 border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{admin.full_name}</h3>
                <p className="text-sm text-gray-500">{admin.email}</p>
                <p className="text-xs text-gray-400">School ID: {admin.school_id}</p>
              </div>
              <button
                onClick={() => savePermissions(admin.user_id)}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Permissions"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availablePermissions.map(perm => {
                const hasPermission = (admin.delegated_permissions || []).includes(perm.id);
                return (
                  <label key={perm.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPermission}
                      onChange={() => togglePermission(admin.user_id, perm.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{perm.label}</span>
                  </label>
                );
              })}
            </div>

            {(admin.delegated_permissions || []).length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Active permissions: {(admin.delegated_permissions || []).length}
                </p>
              </div>
            )}
          </div>
        ))}

        {admins.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No admins found in your schools.
          </div>
        )}
      </div>
    </div>
  );
}
