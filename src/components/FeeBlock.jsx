import PropTypes from "prop-types";
import { C } from "../lib/theme";

// ── FeeBlock overlay — shown to parents with outstanding fees ───────────────
// Drop this at the TOP of any page's return, before everything else.
// Usage: if (feeBlocked) return <FeeBlock onGoFees={onGoFees} />;

export default function FeeBlock({ onGoFees, pageName = "this section" }) {
  return (
    <div style={{
      minHeight: "60vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: C.card, border: `1px solid rgba(244,63,94,0.25)`,
        borderRadius: 20, padding: "48px 40px", maxWidth: 480,
        textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
      }}>
        {/* Lock icon */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 20px",
          background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
        }}>🔒</div>

        <div style={{ fontWeight: 800, fontSize: 20, color: C.text, marginBottom: 10 }}>
          Access Restricted
        </div>
        <div style={{ fontSize: 14, color: C.textSub, lineHeight: 1.75, marginBottom: 28 }}>
          Your account has an outstanding fee balance.
          Please clear your fees to access <strong style={{ color: C.text }}>{pageName}</strong>.
          You can still view your fee statement and make payments.
        </div>

        <button onClick={onGoFees} style={{
          background: `linear-gradient(135deg, #3B82F6, #6366f1)`,
          color: "#fff", border: "none", borderRadius: 10,
          padding: "12px 28px", fontWeight: 700, fontSize: 14,
          cursor: "pointer", letterSpacing: "0.02em",
          boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
          transition: "transform 0.15s",
        }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          💳 Go to Fees & Pay Now
        </button>

        <div style={{ marginTop: 16, fontSize: 12, color: C.textMuted }}>
          Contact the school office if you believe this is an error.
        </div>
      </div>
    </div>
  );
}

FeeBlock.propTypes = {
  onGoFees: PropTypes.func.isRequired,
  pageName: PropTypes.string,
};
