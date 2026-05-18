import PropTypes from "prop-types";
import { getStatusColor, getStatusLabel } from "../../lib/expenditure.utils";

export default function ApprovalStatusBadge({ status, onApprove, onReject, canModify, size = "md" }) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  const sizeStyles = {
    sm: {
      padding: "2px 8px",
      fontSize: "11px",
      height: "24px",
    },
    md: {
      padding: "4px 12px",
      fontSize: "13px",
      height: "32px",
    },
    lg: {
      padding: "8px 16px",
      fontSize: "14px",
      height: "40px",
    },
  };

  const style = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: `${color}20`,
        color,
        border: `1px solid ${color}`,
        borderRadius: "4px",
        ...style,
        fontWeight: 600,
      }}
    >
      <span>{label}</span>
      {canModify && status === "pending" && (
        <div style={{ display: "flex", gap: "4px", marginLeft: "4px" }}>
          {onApprove && (
            <button
              onClick={onApprove}
              style={{
                background: "none",
                border: "none",
                color,
                cursor: "pointer",
                padding: "0 4px",
                fontSize: "14px",
              }}
              title="Approve"
            >
              ✓
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                padding: "0 4px",
                fontSize: "14px",
              }}
              title="Reject"
            >
              ✗
            </button>
          )}
        </div>
      )}
    </div>
  );
}

ApprovalStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  onApprove: PropTypes.func,
  onReject: PropTypes.func,
  canModify: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};
