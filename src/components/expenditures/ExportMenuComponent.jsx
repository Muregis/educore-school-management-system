import PropTypes from "prop-types";
import { useState } from "react";
import Button from "../ui/Button";
import { downloadCSV } from "../../lib/expenditure.utils";

export default function ExportMenuComponent({ expenses, summary, disabled = false }) {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const filename = `expenditures_${new Date().toISOString().split("T")[0]}.csv`;
      downloadCSV(expenses, filename);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const data = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalExpenses: expenses.length,
          summary,
        },
        expenses,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `expenditures_${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const handlePrint = () => {
    window.print();
    setShowMenu(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <Button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled || expenses.length === 0}
        variant="secondary"
      >
        📊 Export
      </Button>

      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            backgroundColor: "var(--color-bg-base)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            minWidth: "200px",
          }}
        >
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 16px",
              textAlign: "left",
              border: "none",
              backgroundColor: "transparent",
              cursor: exporting ? "not-allowed" : "pointer",
              color: "var(--color-text-primary)",
              fontSize: "14px",
              transition: "background-color 0.2s",
              borderBottom: "1px solid var(--color-border)",
              opacity: exporting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => !exporting && (e.target.style.backgroundColor = "var(--color-bg-hover)")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
          >
            📄 Export as CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 16px",
              textAlign: "left",
              border: "none",
              backgroundColor: "transparent",
              cursor: exporting ? "not-allowed" : "pointer",
              color: "var(--color-text-primary)",
              fontSize: "14px",
              transition: "background-color 0.2s",
              borderBottom: "1px solid var(--color-border)",
              opacity: exporting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => !exporting && (e.target.style.backgroundColor = "var(--color-bg-hover)")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
          >
            📋 Export as JSON
          </button>
          <button
            onClick={handlePrint}
            disabled={exporting}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 16px",
              textAlign: "left",
              border: "none",
              backgroundColor: "transparent",
              cursor: exporting ? "not-allowed" : "pointer",
              color: "var(--color-text-primary)",
              fontSize: "14px",
              transition: "background-color 0.2s",
              opacity: exporting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => !exporting && (e.target.style.backgroundColor = "var(--color-bg-hover)")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
          >
            🖨️ Print Report
          </button>
        </div>
      )}
    </div>
  );
}

ExportMenuComponent.propTypes = {
  expenses: PropTypes.array.isRequired,
  summary: PropTypes.object,
  disabled: PropTypes.bool,
};
