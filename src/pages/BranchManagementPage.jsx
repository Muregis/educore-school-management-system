/**
 * Branch/Campus Management Page
 * For Admin/Director to create and manage school branches
 * 100% ADDITIVE - New page component
 */

import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function BranchManagementPage({ auth, toast }) {
  const [branches, setBranches] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedParentSchool, setSelectedParentSchool] = useState("");
  const [isDirector, setIsDirector] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    branch_code: "",
    branch_address: "",
    branch_phone: "",
    email: "",
    phone: "",
    county: "",
    parent_school_id: ""
  });

  const token = auth?.token;

  // Fetch branches/schools
  const fetchData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/branches/my-branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data = await response.json();
      
      if (data.canManageAll && data.allSchools) {
        // Director view - all schools
        setIsDirector(true);
        setAllSchools(data.allSchools);
        // Filter to show only branches
        setBranches(data.allSchools.filter(s => s.is_branch));
      } else {
        // Admin view - their school + branches
        setIsDirector(false);
        setBranches(data.branches || []);
        setAllSchools(data.school ? [data.school, ...(data.branches || [])] : []);
      }
    } catch (err) {
      console.error("Error fetching branches:", err);
      toast?.("Failed to load branches", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Get main schools (non-branches) for parent selection
  const mainSchools = allSchools.filter(s => !s.is_branch);

  const handleCreate = async (e) => {
    e.preventDefault();
    
    const parentId = isDirector ? (formData.parent_school_id || selectedParentSchool) : auth?.schoolId;
    
    if (!parentId) {
      toast?.("Please select a parent school", "error");
      return;
    }
    
    if (!formData.name || !formData.branch_code) {
      toast?.("Name and branch code are required", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/branches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          parent_school_id: parseInt(parentId)
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create branch");
      }

      toast?.("Branch created successfully", "success");
      setShowCreateModal(false);
      setFormData({
        name: "",
        branch_code: "",
        branch_address: "",
        branch_phone: "",
        email: "",
        phone: "",
        county: "",
        parent_school_id: ""
      });
      fetchData();
    } catch (err) {
      console.error("Error creating branch:", err);
      toast?.(err.message || "Failed to create branch", "error");
    } finally {
      setLoading(false);
    }
  };

  const getParentSchoolName = (parentId) => {
    const parent = allSchools.find(s => s.school_id === parentId);
    return parent?.name || "Unknown";
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Branch Management</h1>
          <p style={{ color: "#64748B", margin: "4px 0 0", fontSize: 14 }}>
            {isDirector ? "Manage all school branches across the system" : "Manage branches for your school"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: "#3B82F6",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span>+</span> Create Branch
        </button>
      </div>

      {/* Branches Table */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>ID</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Branch Code</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Parent School</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Location</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Contact</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                  Loading...
                </td>
              </tr>
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                  No branches created yet. Click "Create Branch" to add one.
                </td>
              </tr>
            ) : (
              branches.map((branch) => (
                <tr key={branch.school_id} style={{ borderTop: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569", fontFamily: "monospace" }}>
                    {branch.school_id}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 500 }}>
                    {branch.name}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    <span style={{ 
                      background: "#EFF6FF", 
                      color: "#3B82F6", 
                      padding: "4px 8px", 
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {branch.branch_code}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>
                    {getParentSchoolName(branch.parent_school_id)}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>
                    {branch.branch_address || "-"}
                    {branch.county && <div style={{ fontSize: 12, color: "#94A3B8" }}>{branch.county}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14, color: "#475569" }}>
                    {branch.branch_phone || branch.phone || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Branch Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100
        }}>
          <div style={{
            background: "white",
            borderRadius: 16,
            width: "100%",
            maxWidth: 500,
            maxHeight: "90vh",
            overflow: "auto",
            padding: 24
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Create New Branch</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#64748B" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate}>
              {/* Parent School Selection (for Director only) */}
              {isDirector && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                    Parent School *
                  </label>
                  <select
                    value={formData.parent_school_id}
                    onChange={(e) => setFormData({ ...formData, parent_school_id: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      fontSize: 14
                    }}
                    required
                  >
                    <option value="">Select parent school...</option>
                    {mainSchools.map((school) => (
                      <option key={school.school_id} value={school.school_id}>
                        {school.name} (ID: {school.school_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Branch Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Real Peak - Nairobi Campus"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    fontSize: 14
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Branch Code *
                </label>
                <input
                  type="text"
                  value={formData.branch_code}
                  onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                  placeholder="e.g., 3.1, NRB, Nairobi"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    fontSize: 14
                  }}
                  required
                />
                <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                  Short code to identify this branch (e.g., "3.1" for School 3 Branch 1)
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Branch Address
                </label>
                <input
                  type="text"
                  value={formData.branch_address}
                  onChange={(e) => setFormData({ ...formData, branch_address: e.target.value })}
                  placeholder="e.g., 123 Mombasa Road, Nairobi"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    fontSize: 14
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                    County
                  </label>
                  <input
                    type="text"
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                    placeholder="e.g., Nairobi"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                    Branch Phone
                  </label>
                  <input
                    type="text"
                    value={formData.branch_phone}
                    onChange={(e) => setFormData({ ...formData, branch_phone: e.target.value })}
                    placeholder="e.g., +254712345678"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#3B82F6",
                    color: "white",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? "Creating..." : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
