import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { getSession, saveSession } from "../lib/auth";
import { C } from "../lib/theme";

export function useBranches(token, onSwitch) {
  const [branches, setBranches] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(null);
  const [parentSchool, setParentSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canAccessBranches, setCanAccessBranches] = useState(false);
  const [isDirector, setIsDirector] = useState(false);
  
  // Store onSwitch in a ref to ensure it's properly captured
  const onSwitchRef = useRef(onSwitch);
  useEffect(() => {
    onSwitchRef.current = onSwitch;
  }, [onSwitch]);

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
      } else if (data.role === "director" && data.school) {
        // Director response - handle branch context properly
        setBranches(data.branches || []);
        setCurrentBranch(data.school);
        setParentSchool(data.parent_school);
        setIsDirector(true);
        
        // For directors, combine branches and sibling branches for full access
        const allBranches = [
          ...(data.branches || []),
          ...(data.sibling_branches || [])
        ];
        setBranches(allBranches);
        setCanAccessBranches(data.is_branch || (allBranches.length > 0));
      } else if (data.school && data.branches) {
        // Non-director response
        setBranches(data.branches || []);
        setCurrentBranch(data.school);
        setParentSchool(data.parent_school);
        setIsDirector(false);
        setCanAccessBranches(data.is_branch || (data.branches?.length > 0));
      } else {
        // Fallback for any other response structure
        setBranches(data.branches || []);
        setCurrentBranch(data.school);
        setParentSchool(data.parent_school);
        setIsDirector(data.role === "director");
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
    if (!token) {
      console.error("No token provided for branch switch");
      return;
    }

    // Prevent repeated attempts to switch to the same branch
    const currentActiveSchool = localStorage.getItem("educore.activeSchool");
    if (currentActiveSchool === String(branchId)) {
      console.log("Already on the target branch, skipping switch");
      return { newSchoolId: branchId, newSchool: null };
    }

    try {
      console.log("Attempting to switch to branch:", branchId);
      
      // First call the backend to validate the switch
      const response = await apiFetch(`/branches/switch/${branchId}`, {
        method: "PUT",
        token,
      });

      console.log("Backend switch response:", response);

      // Update local storage
      localStorage.setItem("educore.activeSchool", String(branchId));
      console.log("Updated localStorage educore.activeSchool to:", branchId);

      // Update session storage
      const auth = JSON.parse(sessionStorage.getItem("educore.auth") || "{}");
      console.log("Current auth before update:", auth);
      
      auth.schoolId = branchId;
      auth.school_id = branchId;
      const session = getSession();
      saveSession({
        token: session?.token || auth.token,
        sessionId: session?.sessionId || auth.sessionId,
        user: auth,
      });
      console.log("Updated sessionStorage with new schoolId:", branchId);

      // Find the selected school data
      const selectedSchool = [...allSchools, currentBranch, parentSchool, ...branches]
        .filter(Boolean)
        .find((school) => Number(school.school_id) === Number(branchId)) || response.newSchool;

      console.log("Selected school data:", selectedSchool);

      // Call the parent switch handler
      if (onSwitchRef.current) {
        console.log("Calling onSwitch callback");
        await onSwitchRef.current(branchId, selectedSchool);
      } else {
        console.warn("No onSwitch callback provided");
      }
      
      return { newSchoolId: branchId, newSchool: selectedSchool };
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

export function BranchSelector({ style = {}, token, activeSchoolId, onSwitch }) {
  const {
    branches,
    allSchools,
    currentBranch,
    parentSchool,
    loading,
    canAccessBranches,
    isDirector,
    switchBranch,
  } = useBranches(token, onSwitch);

  const [isOpen, setIsOpen] = useState(false);

  const auth = JSON.parse(sessionStorage.getItem("educore.auth") || "{}");
  const userRole = auth?.role;
  const currentSchoolId = activeSchoolId
    ? Number(activeSchoolId)
    : auth?.schoolId
      ? Number(auth.schoolId)
      : null;

  if (userRole === "parent" || userRole === "student") {
    return null;
  }

  if (!canAccessBranches) {
    return null;
  }

  if (branches.length === 0 && !isDirector && !currentBranch) {
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

    // Directors switch between branches of their school using branch switching endpoint
    if (isDirector) {
      try {
        await switchBranch(branchId);
      } catch (err) {
        alert("Failed to switch: " + err.message);
      }
      setIsOpen(false);
      return;
    }

    // Non-directors use regular branch switching
    try {
      await switchBranch(branchId);
    } catch (err) {
      alert("Failed to switch: " + err.message);
    }
    setIsOpen(false);
  };

  const currentSchoolName = isDirector && currentBranch
    ? (currentBranch.school_id === currentSchoolId ? currentBranch.name : 
       branches.find(b => b.school_id === currentSchoolId)?.name || currentBranch.name)
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
          whiteSpace: "nowrap",
          minWidth: "200px",
          justifyContent: "space-between"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-bg-hover)";
          e.currentTarget.style.borderColor = "var(--color-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--color-bg-card)";
          e.currentTarget.style.borderColor = "var(--color-border)";
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--color-primary)", fontSize: "14px" }}>🏢</span>
          <span style={{ 
            color: "var(--color-text-primary)",
            fontWeight: 600,
            fontSize: "13px"
          }}>{currentSchoolName}</span>
        </span>
        <span style={{
          fontSize: 10,
          color: "var(--color-text-muted)",
          transform: isOpen ? "rotate(180deg)" : "none",
          transition: "transform var(--transition-fast)",
          flexShrink: 0
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
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              zIndex: 9999,
              overflow: "hidden",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)"
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
                <>
                  {/* Show parent school first if director is at a branch */}
                  {parentSchool && currentBranch?.is_branch && (
                    <button
                      key={parentSchool.school_id}
                      className="school-list-item"
                      onClick={() => handleSwitch(parentSchool.school_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: currentSchoolId === parentSchool.school_id ? "var(--color-primary-muted)" : "transparent",
                        border: "none",
                        borderLeft: `4px solid ${currentSchoolId === parentSchool.school_id ? "var(--color-primary)" : "transparent"}`,
                        color: "var(--color-text-primary)",
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                        fontSize: "14px",
                        fontWeight: 500
                      }}
                      onMouseEnter={(e) => {
                        if (currentSchoolId !== parentSchool.school_id) {
                          e.currentTarget.style.background = "var(--color-bg-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentSchoolId !== parentSchool.school_id) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {parentSchool.name}
                        {currentSchoolId === parentSchool.school_id && (
                          <span style={{ float: "right", color: "var(--color-primary)", fontWeight: 800 }}>✓</span>
                        )}
                        <span style={{
                          marginLeft: 8,
                          fontSize: 10,
                          background: "var(--color-primary)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          color: "white"
                        }}>Main Campus</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                        ID: {parentSchool.school_id} {parentSchool.code && ` • ${parentSchool.code}`}
                      </div>
                    </button>
                  )}

                  {/* Show current school (main school if not at branch, or current branch if at branch) */}
                  {currentBranch && (
                    <button
                      key={currentBranch.school_id}
                      className="school-list-item"
                      onClick={() => handleSwitch(currentBranch.school_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: currentSchoolId === currentBranch.school_id ? "var(--color-primary-muted)" : "transparent",
                        border: "none",
                        borderLeft: `4px solid ${currentSchoolId === currentBranch.school_id ? "var(--color-primary)" : "transparent"}`,
                        color: "var(--color-text-primary)",
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                        fontSize: "14px",
                        fontWeight: 500
                      }}
                      onMouseEnter={(e) => {
                        if (currentSchoolId !== currentBranch.school_id) {
                          e.currentTarget.style.background = "var(--color-bg-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentSchoolId !== currentBranch.school_id) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {currentBranch.name}
                        {currentSchoolId === currentBranch.school_id && (
                          <span style={{ float: "right", color: "var(--color-primary)", fontWeight: 800 }}>✓</span>
                        )}
                        <span style={{
                          marginLeft: 8,
                          fontSize: 10,
                          background: currentBranch.is_branch ? "var(--color-border)" : "var(--color-primary)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          color: currentBranch.is_branch ? "var(--color-text-muted)" : "white"
                        }}>{currentBranch.is_branch ? "Current Branch" : "Main"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
                        ID: {currentBranch.school_id} {currentBranch.code && ` • ${currentBranch.code}`}
                      </div>
                    </button>
                  )}
                  
                  {/* Show other branches (exclude current branch) */}
                  {branches.filter(branch => branch.school_id !== currentBranch?.school_id).map((branch) => {
                    const isActive = currentSchoolId === branch.school_id;
                    return (
                      <button
                        key={branch.school_id}
                        className="school-list-item"
                        onClick={() => handleSwitch(branch.school_id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 16px",
                          background: isActive ? "var(--color-primary-muted)" : "transparent",
                          border: "none",
                          borderLeft: `4px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                          color: "var(--color-text-primary)",
                          cursor: "pointer",
                          transition: "all var(--transition-fast)",
                          fontSize: "14px",
                          fontWeight: 500
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "var(--color-bg-hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {branch.name}
                          {isActive && (
                            <span style={{ float: "right", color: "var(--color-primary)", fontWeight: 800 }}>✓</span>
                          )}
                          {branch.is_branch && (
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
                          ID: {branch.school_id} {branch.branch_code && ` • ${branch.branch_code}`}
                        </div>
                      </button>
                    );
                  })}
                </>
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
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                        fontSize: "14px",
                        fontWeight: 500
                      }}
                      onMouseEnter={(e) => {
                        if (currentSchoolId !== parentSchool.school_id) {
                          e.currentTarget.style.background = "var(--color-bg-hover)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentSchoolId !== parentSchool.school_id) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{parentSchool.name}</div>
                      {currentSchoolId === parentSchool.school_id && (
                        <span style={{ float: "right", color: "var(--color-primary)", fontWeight: 800 }}>✓</span>
                      )}
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
                          cursor: "pointer",
                          transition: "all var(--transition-fast)",
                          fontSize: "14px",
                          fontWeight: 500
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "var(--color-bg-hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{branch.name}</div>
                        {isActive && (
                          <span style={{ float: "right", color: "var(--color-primary)", fontWeight: 800 }}>✓</span>
                        )}
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
