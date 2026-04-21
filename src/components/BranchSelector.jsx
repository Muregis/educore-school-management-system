/**
 * Branch/Campus Selector Component
 * Allows users to switch between school branches
 * 100% ADDITIVE - New component, no existing files modified
 */

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/api.js";

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

  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  const fetchBranches = async () => {
    if (!token) {
      setCanAccessBranches(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/branches/my-branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      
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
      const response = await fetch(`${API_URL}/branches/switch/${branchId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to switch branch");
      }

      const data = await response.json();
      
      // Update localStorage with new school context
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      user.school_id = data.newSchoolId;
      user.school = data.newSchool;
      localStorage.setItem("user", JSON.stringify(user));
      
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
    allSchools,      // For director
    currentBranch,
    parentSchool,
    loading,
    error,
    canAccessBranches,
    isDirector,      // Flag for director view
    refresh: fetchBranches,
    switchBranch,
  };
}

/**
 * Branch Selector Dropdown Component
 * PARENTS: Component returns null - they never see branch selector
 */
export function BranchSelector({ className = "" }) {
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
  
  // Get user role from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = user?.role;
  const currentSchoolId = user?.schoolId;
  
  // Parents and students NEVER see branch selector
  if (userRole === "parent" || userRole === "student") {
    return null;
  }

  // Director sees all schools, admin sees branches
  if (!canAccessBranches) {
    return null;
  }
  
  // For regular admin, need at least one branch
  if (!isDirector && branches.length === 0) {
    return null;
  }

  const formatBranchName = (school) => {
    if (!school) return "";
    if (school.is_branch && school.branch_code) {
      return `${school.name} (${school.branch_code})`;
    }
    return school.name;
  };

  const handleSwitch = async (branchId) => {
    if (branchId === currentBranch?.school_id) {
      setIsOpen(false);
      return;
    }
    
    if (window.confirm("Switching branches will reload the page. Continue?")) {
      await switchBranch(branchId);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        disabled={loading}
      >
        <svg
          className="w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="text-sm font-medium text-gray-700">
          {isDirector ? "All Schools" : formatBranchName(currentBranch)}
        </span>
        {isDirector ? (
          <span className="text-xs text-gray-500">
            ({allSchools.length} schools)
          </span>
        ) : branches.length > 0 && (
          <span className="text-xs text-gray-500">
            ({branches.length + 1} locations)
          </span>
        )}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                {isDirector ? "Select School" : "Select Location"}
              </p>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {isDirector ? (
                // Director sees ALL schools
                allSchools.map((school) => (
                  <button
                    key={school.school_id}
                    onClick={() => handleSwitch(school.school_id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      currentSchoolId === school.school_id
                        ? "bg-blue-50 border-l-4 border-blue-500"
                        : "border-l-4 border-transparent"
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {school.name}
                      {school.is_branch && (
                        <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">Branch</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      ID: {school.school_id}
                      {school.branch_code && ` • ${school.branch_code}`}
                      {school.county && ` • ${school.county}`}
                    </p>
                  </button>
                ))
              ) : (
                <>
                  {/* Regular Admin - Main School */}
                  {parentSchool && (
                    <button
                      onClick={() => handleSwitch(parentSchool.school_id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        currentBranch?.school_id === parentSchool.school_id
                          ? "bg-blue-50 border-l-4 border-blue-500"
                          : "border-l-4 border-transparent"
                      }`}
                    >
                      <p className="font-medium text-gray-900">{parentSchool.name}</p>
                      <p className="text-xs text-gray-500">Main Campus</p>
                    </button>
                  )}
                  
                  {/* Current school if it's main */}
                  {currentBranch && !currentBranch.is_branch && (
                    <button
                      onClick={() => handleSwitch(currentBranch.school_id)}
                      className="w-full text-left px-4 py-3 bg-blue-50 border-l-4 border-blue-500"
                    >
                      <p className="font-medium text-gray-900">{currentBranch.name}</p>
                      <p className="text-xs text-gray-500">Main Campus</p>
                    </button>
                  )}
                  
                  {/* Branches */}
                  {branches.map((branch) => (
                    <button
                      key={branch.school_id}
                      onClick={() => handleSwitch(branch.school_id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        currentBranch?.school_id === branch.school_id
                          ? "bg-blue-50 border-l-4 border-blue-500"
                          : "border-l-4 border-transparent"
                      }`}
                    >
                      <p className="font-medium text-gray-900">{branch.name}</p>
                      <p className="text-xs text-gray-500">
                        {branch.branch_code}
                        {branch.branch_address && ` • ${branch.branch_address}`}
                      </p>
                    </button>
                  ))}
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
