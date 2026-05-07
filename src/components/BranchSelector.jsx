import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { getSession, saveSession } from "../lib/auth";
import { C } from "../lib/theme";

export function useBranches(token) {
  const [branches, setBranches] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [parentSchool, setParentSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canAccessBranches, setCanAccessBranches] = useState(false);
  const [isDirector, setIsDirector] = useState(false);

  const fetchBranches = async () => {
    if (!token) {
      setCanAccessBranches(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch("/branches/my-branches", { token });

      if (data.canManageAll && data.allSchools) {
        setAllSchools(data.allSchools || []);
        setIsDirector(true);
        setCanAccessBranches(true);
      } else {
        setBranches(data.branches || []);
        setCurrentBranch(data.school);
        setParentSchool(data.parent_school);
        setIsDirector(false);
        setCanAccessBranches(data.is_branch || (data.branches?.length > 0));
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching branches:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [token]);

  const switchBranch = async (branchId) => {
    if (!token) return;

    try {
      const data = await apiFetch(`/branches/switch/${branchId}`, {
        method: "PUT",
        token
      });

      const auth = JSON.parse(sessionStorage.getItem("educore.auth") || "{}");
      auth.schoolId = data.newSchoolId;
      auth.school = data.newSchool;
      const session = getSession();
      saveSession({
        token: session?.token || auth.token,
        sessionId: session?.sessionId || auth.sessionId,
        user: auth,
      });

      window.location.reload();
      return data;
    } catch (err) {
      console.error("Error switching branch:", err);
      setError(err.message);
      throw err;
    }
  };

  return {
    branches,
    allSchools,
    currentBranch,
    parentSchool,
    loading,
    error,
    canAccessBranches,
    isDirector,
    refresh: fetchBranches,
    switchBranch,
  };
}

export function BranchSelector({ className = "", style = {}, token }) {
  const {
    branches,
    allSchools,
    currentBranch,
    parentSchool,
    loading,
    canAccessBranches,
    isDirector,
    switchBranch,
  } = useBranches(token);

  const [isOpen, setIsOpen] = useState(false);

  const auth = JSON.parse(sessionStorage.getItem("educore.auth") || "{}");
  const userRole = auth?.role;
  const currentSchoolId = auth?.schoolId ? Number(auth.schoolId) : null;

  if (userRole === "parent" || userRole === "student") {
    return null;
  }

  if (!canAccessBranches) {
    return null;
  }

  if (!isDirector && branches.length === 0) {
    return null;
  }

  const formatBranchName = (school) => {
    if (!school) return "System Admin";
    if (school.is_branch && school.branch_code) {
      return `${school.name} (${school.branch_code})`;
    }
    return school.name;
  };

  const handleSwitch = async (branchId) => {
    if (Number(branchId) === currentSchoolId) {
      setIsOpen(false);
      return;
    }

    if (window.confirm("Switching branches will reload the page. Continue?")) {
      try {
        await switchBranch(branchId);
      } catch (err) {
        alert("Failed to switch: " + err.message);
      }
    }
    setIsOpen(false);
  };

  const currentSchoolName = isDirector
    ? (allSchools.find(s => s.school_id === currentSchoolId)?.name || "All Schools")
    : formatBranchName(currentBranch);

  return (
    <div style={{ position: "relative", ...style }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all var(--transition-fast)",
          whiteSpace: "nowrap"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--color-primary)" }}>🏢</span>
          <span>{currentSchoolName}</span>
        </span>
        <span style={{
          fontSize: 10,
          color: "var(--color-text-muted)",
          transform: isOpen ? "rotate(180deg)" : "none",
          transition: "transform var(--transition-fast)"
        }}>▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="mobile-dropdown-overlay"
            style={{ position: "fixed", inset: 0, zIndex: 1000 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="branch-selector-dropdown"
            style={{
              position: "absolute",
              right: 0,
              marginTop: 8,
              width: 280,
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              zIndex: 1001,
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
              <p style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-muted)",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                {isDirector ? "Select School" : "Change Campus"}
              </p>
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {isDirector ? (
                allSchools.map((school) => {
                  const isActive = currentSchoolId === school.school_id;
                  return (
                    <button
                      key={school.school_id}
                      className="school-list-item"
                      onClick={() => handleSwitch(school.school_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: isActive ? "var(--color-primary-muted)" : "transparent",
                        border: "none",
                        borderLeft: `4px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                        color: "var(--color-text-primary)",
                        cursor: "pointer",
                        transition: "background var(--transition-fast)"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {school.name}
                        {school.is_branch && (
                          <span style={{
                            marginLeft: 8,
                            fontSize: 10,
                            background: "var(--color-border)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            color: "var(--color-text-muted)"
                          }}>Branch</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                        ID: {school.school_id} {school.branch_code && ` • ${school.branch_code}`}
                      </div>
                    </button>
                  );
                })
              ) : (
                <>
                  {parentSchool && (
                    <button
                      className="branch-list-item"
                      onClick={() => handleSwitch(parentSchool.school_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: currentSchoolId === parentSchool.school_id ? "var(--color-primary-muted)" : "transparent",
                        border: "none",
                        borderLeft: `4px solid ${currentSchoolId === parentSchool.school_id ? "var(--color-primary)" : "transparent"}`,
                        color: "var(--color-text-primary)",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{parentSchool.name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>Main Campus</div>
                    </button>
                  )}

                  {branches.map((branch) => {
                    const isActive = currentSchoolId === branch.school_id;
                    return (
                      <button
                        key={branch.school_id}
                        className="branch-list-item"
                        onClick={() => handleSwitch(branch.school_id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 16px",
                          background: isActive ? "var(--color-primary-muted)" : "transparent",
                          border: "none",
                          borderLeft: `4px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                          color: "var(--color-text-primary)",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{branch.name}</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                          {branch.branch_code} {branch.branch_address && ` • ${branch.branch_address}`}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BranchSelector;
