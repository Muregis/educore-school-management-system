import React from "react";
import PropTypes from "prop-types";
import { C } from "../lib/theme";

export default function BulkImportModeSelector({ importMode, setImportMode, disabled = false }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ margin: "0 0 8px", color: C.text, fontSize: 16 }}>Import Mode</h4>
        <p style={{ margin: 0, color: C.textSub, fontSize: 13 }}>
          Choose whether to create new students or update existing student data
        </p>
      </div>
      
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setImportMode("create")}
          disabled={disabled}
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "none",
            background: importMode === "create" ? C.accent : C.surface,
            color: importMode === "create" ? "#fff" : C.text,
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: importMode === "create" ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>+</span>
            <div>
              <div>Create New Students</div>
              <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>Add new enrollments</div>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => setImportMode("update")}
          disabled={disabled}
          style={{
            padding: "12px 20px",
            borderRadius: 8,
            border: "none",
            background: importMode === "update" ? "#10B981" : C.surface,
            color: importMode === "update" ? "#fff" : C.text,
            cursor: disabled ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: importMode === "update" ? "0 2px 8px rgba(16,185,129,0.2)" : "none",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{"\u270F\ufe0f"}</span>
            <div>
              <div>Update Existing Students</div>
              <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>Bulk edit current data</div>
            </div>
          </div>
        </button>
      </div>
      
      {importMode === "update" && (
        <div style={{ 
          marginTop: 12, 
          padding: 12, 
          background: "#F0FDF4", 
          border: "1px solid #10B98133", 
          borderRadius: 8,
          fontSize: 13,
          color: "#065F46"
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Update Mode Active</div>
          <div>Only students found in the system will be updated. Use admission numbers to match existing students.</div>
        </div>
      )}
      
      {importMode === "create" && (
        <div style={{ 
          marginTop: 12, 
          padding: 12, 
          background: "#EFF6FF", 
          border: "1px solid #3B82F633", 
          borderRadius: 8,
          fontSize: 13,
          color: "#1E40AF"
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Create Mode Active</div>
          <div>New students will be added to the system. Existing admission numbers will be skipped.</div>
        </div>
      )}
    </div>
  );
}

BulkImportModeSelector.propTypes = {
  importMode: PropTypes.oneOf(["create", "update"]).isRequired,
  setImportMode: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
