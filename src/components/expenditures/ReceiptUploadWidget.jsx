import PropTypes from "prop-types";
import { useState } from "react";
import Button from "../ui/Button";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function ReceiptUploadWidget({ value, onChange, disabled = false }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);

  const validateFile = (file) => {
    setError(null);

    if (!file) return false;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Invalid file type. Please upload an image (JPG, PNG, WebP) or PDF.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum size is 5MB.");
      return false;
    }

    return true;
  };

  const handleFile = (file) => {
    if (validateFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: e.target.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const isImage = value?.type?.startsWith("image/");
  const isPDF = value?.type === "application/pdf";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
        Receipt (Optional)
      </label>

      {!value ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: "2px dashed",
            borderColor: dragActive ? "var(--color-primary)" : "var(--color-border)",
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            backgroundColor: dragActive ? "var(--color-bg-hover)" : "transparent",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <input
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleChange}
            disabled={disabled}
            style={{ display: "none" }}
            id="receipt-upload"
          />
          <label htmlFor="receipt-upload" style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📄</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "4px" }}>
              Drag and drop receipt here
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              or click to select a file (JPG, PNG, PDF • max 5MB)
            </div>
          </label>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "var(--color-bg-hover)",
          }}
        >
          <div style={{ fontSize: "24px" }}>{isImage ? "🖼️" : isPDF ? "📄" : "📎"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", wordBreak: "break-word" }}>
              {value.name}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {(value.size / 1024).toFixed(1)} KB
            </div>
          </div>
          {isImage && (
            <a
              href={value.dataUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "12px",
                color: "var(--color-primary)",
                textDecoration: "none",
                padding: "4px 8px",
                border: "1px solid var(--color-primary)",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Preview
            </a>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={() => onChange(null)}
            disabled={disabled}
            style={{ padding: "4px 8px" }}
          >
            Remove
          </Button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: "12px", color: "#ef4444", padding: "8px", backgroundColor: "#fee2e2", borderRadius: "4px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

ReceiptUploadWidget.propTypes = {
  value: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
    size: PropTypes.number,
    dataUrl: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
