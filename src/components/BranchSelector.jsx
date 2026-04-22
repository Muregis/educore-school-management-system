import { useState, useEffect } from "react";
import { API_BASE, apiFetch } from "../lib/api.js";
import { C } from "../lib/theme.js";

const API_URL = API_BASE;

export function useBranches() {
  const [branches, setBranches] = useState([]);
  const [allSchools, setAllSchools] = useState([]); // For director
  const [currentBranch, setCurrentBranch] = useState(null);
  const [parentSchool, setParentSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canAccessBranches, setCanAccessBranches] = useState(false);
  const [isDirector, setIsDirector] = useState(false);

  const token = sessionStorage.getItem("token");

  const fetchBranches = async () => {
    if (!token) {
      setCanAccessBranches(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = await apiFetch("/branches/my-branches", { token });
      
      // Director sees all schools
      if (data.canManageAll && data.allSchools) {
        setAllSchools(data.allSchools);
        setIsDirector(true);
        setCanAccessBranches(true);
      } else {
        // Regular admin sees branches
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
      
      // Update sessionStorage with new school context
      const auth = JSON.parse(sessionStorage.getItem("educore.auth") || "{}");
      auth.schoolId = data.newSchoolId;
      auth.school = data.newSchool;
      sessionStorage.setItem("educore.auth", JSON.stringify(auth));
      
      // Reload to apply new context
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

export function BranchSelector({ className = "", style = {} }) {
  const {
    branches,
    allSchools,
    currentBranch,
    parentSchool,
    loading,
    canAccessBranches,
    isDirector,
    switchBranch,
  } = useBranches();

  const [isOpen, setIsOpen] = useState(false);
  
  const auth = JSON.parse(sessionStorage.getItem("educore.auth") || "{}");
  const userRole = auth?.role;
  const currentSchoolId = auth?.schoolId;
  
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
    if (branchId === currentSchoolId) {
      setIsOpen(false);
      return;
    }
    
    if (window.confirm("Switching branches will reload the page. Continue?")) {
      await switchBranch(branchId);
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
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.text,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          transition: "all 0.2s"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: C.accent }}>🏢</span>
          <span>{currentSchoolName}</span>
        </span>
        <span style={{ fontSize: 10, color: C.textSub, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 1000 }}
            onClick={() => setIsOpen(false)}
          />
          <div style={{
            position: "absolute",
            right: 0,
            marginTop: 8,
            width: 280,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            zIndex: 1001,
            overflow: "hidden"
          }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.card }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.textSub, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                      onClick={() => handleSwitch(school.school_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: isActive ? C.accentDim : "transparent",
                        border: "none",
                        borderLeft: `4px solid ${isActive ? C.accent : "transparent"}`,
                        color: C.text,
                        cursor: "pointer",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {school.name}
                        {school.is_branch && (
                          <span style={{ marginLeft: 8, fontSize: 10, background: C.border, padding: "2px 6px", borderRadius: 4, color: C.textSub }}>Branch</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
                        ID: {school.school_id} {school.branch_code && ` • ${school.branch_code}`}
                      </div>
                    </button>
                  );
                })
              ) : (
                <>
                  {parentSchool && (
                    <button
                      onClick={() => handleSwitch(parentSchool.school_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: currentSchoolId === parentSchool.school_id ? C.accentDim : "transparent",
                        border: "none",
                        borderLeft: `4px solid ${currentSchoolId === parentSchool.school_id ? C.accent : "transparent"}`,
                        color: C.text,
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{parentSchool.name}</div>
                      <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>Main Campus</div>
                    </button>
                  )}
                  
                  {branches.map((branch) => {
                    const isActive = currentSchoolId === branch.school_id;
                    return (
                      <button
                        key={branch.school_id}
                        onClick={() => handleSwitch(branch.school_id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "12px 16px",
                          background: isActive ? C.accentDim : "transparent",
                          border: "none",
                          borderLeft: `4px solid ${isActive ? C.accent : "transparent"}`,
                          color: C.text,
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{branch.name}</div>
                        <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
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
