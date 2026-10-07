import PropTypes from "prop-types";
import Input from "./ui/Input";
import Select from "./ui/Select";

/**
 * Transport / lunch / breakfast / discount / opening balance.
 * Restored after mobile polish removed these fields from StudentsPage.
 */
export default function StudentFeeSettingsBlock({ f, onChange }) {
  const set = (field, value) => onChange(field, value);
  const card = {
    gridColumn: "1 / -1",
    padding: "var(--space-3)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    background: "var(--color-bg-surface)",
  };
  const title = {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "var(--space-3)",
  };
  const grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "var(--space-3)",
  };

  return (
    <>
      <div style={card}>
        <div style={title}>Transport</div>
        <div style={grid}>
          <Select
            label="Direction"
            value={f.transport_direction || "none"}
            onChange={(e) => set("transport_direction", e.target.value)}
            options={[
              { value: "none", label: "No Transport" },
              { value: "one_way", label: "One Way (50%)" },
              { value: "two_way", label: "Two Way (100%)" },
            ]}
          />
          <Input
            label="Base fee (KES)"
            type="number"
            value={f.transport_base_fee ?? ""}
            onChange={(e) =>
              set("transport_base_fee", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
            }
            disabled={(f.transport_direction || "none") === "none"}
          />
        </div>
      </div>

      <div style={card}>
        <div style={title}>Lunch program</div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            cursor: "pointer",
            marginBottom: "var(--space-3)",
            color: "var(--color-text-primary)",
            fontSize: "14px",
          }}
        >
          <input
            type="checkbox"
            checked={!!f.lunch_enabled}
            onChange={(e) => set("lunch_enabled", e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>Enrolled in lunch</span>
        </label>
        <div style={grid}>
          <Select
            label="Billing"
            value={f.lunch_billing_type || "termly"}
            onChange={(e) => set("lunch_billing_type", e.target.value)}
            options={[
              { value: "termly", label: "Termly (flat)" },
              { value: "daily", label: "Daily × days" },
            ]}
          />
          <Input
            label={f.lunch_billing_type === "daily" ? "Daily rate (KES)" : "Termly rate (KES)"}
            type="number"
            value={f.lunch_daily_rate ?? ""}
            onChange={(e) =>
              set("lunch_daily_rate", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
            }
          />
          {f.lunch_billing_type === "daily" && (
            <Input
              label="School days"
              type="number"
              value={f.lunch_days ?? ""}
              onChange={(e) => set("lunch_days", e.target.value)}
            />
          )}
        </div>
      </div>

      <div style={card}>
        <div style={title}>Breakfast program</div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            cursor: "pointer",
            marginBottom: "var(--space-3)",
            color: "var(--color-text-primary)",
            fontSize: "14px",
          }}
        >
          <input
            type="checkbox"
            checked={!!f.breakfast_enabled}
            onChange={(e) => set("breakfast_enabled", e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>Enrolled in breakfast</span>
        </label>
        <div style={grid}>
          <Select
            label="Billing"
            value={f.breakfast_billing_type || "termly"}
            onChange={(e) => set("breakfast_billing_type", e.target.value)}
            options={[
              { value: "termly", label: "Termly (flat)" },
              { value: "daily", label: "Daily × days" },
            ]}
          />
          <Input
            label={f.breakfast_billing_type === "daily" ? "Daily rate (KES)" : "Termly rate (KES)"}
            type="number"
            value={f.breakfast_daily_rate ?? ""}
            onChange={(e) =>
              set(
                "breakfast_daily_rate",
                e.target.value === "" ? "" : parseFloat(e.target.value) || 0
              )
            }
          />
          {f.breakfast_billing_type === "daily" && (
            <Input
              label="School days"
              type="number"
              value={f.breakfast_days ?? ""}
              onChange={(e) => set("breakfast_days", e.target.value)}
            />
          )}
          <Input
            label="Agreed breakfast (KES)"
            type="number"
            value={f.breakfast_termly_fee ?? ""}
            onChange={(e) =>
              set(
                "breakfast_termly_fee",
                e.target.value === "" ? "" : parseFloat(e.target.value) || 0
              )
            }
          />
        </div>
      </div>

      <div style={card}>
        <div style={title}>Fee discount</div>
        <div style={grid}>
          <Select
            label="Type"
            value={f.discount_type || ""}
            onChange={(e) => set("discount_type", e.target.value)}
            options={[
              { value: "", label: "No discount" },
              { value: "sibling_2nd", label: "2nd sibling" },
              { value: "sibling_3rd", label: "3rd sibling" },
              { value: "sibling_4th_plus", label: "4th+ sibling" },
              { value: "staff_child", label: "Staff child" },
              { value: "scholarship", label: "Scholarship" },
              { value: "bursary", label: "Bursary" },
              { value: "other", label: "Other" },
            ]}
          />
          <Input
            label={f.discount_is_percentage ? "Discount %" : "Amount (KES)"}
            type="number"
            value={f.discount_value ?? ""}
            onChange={(e) =>
              set("discount_value", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
            }
            disabled={!f.discount_type}
          />
          <Select
            label="Mode"
            value={f.discount_is_percentage ? "percentage" : "amount"}
            onChange={(e) => set("discount_is_percentage", e.target.value === "percentage")}
            disabled={!f.discount_type}
            options={[
              { value: "percentage", label: "Percentage (%)" },
              { value: "amount", label: "Fixed (KES)" },
            ]}
          />
        </div>
      </div>

      <div style={card}>
        <div style={title}>Opening balance (KES)</div>
        <div style={grid}>
          <Input
            label="Amount"
            type="number"
            value={f.opening_balance ?? ""}
            onChange={(e) =>
              set("opening_balance", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)
            }
            placeholder="Carried forward"
          />
          <Select
            label="Type"
            value={f.opening_balance_type || "owing"}
            onChange={(e) => set("opening_balance_type", e.target.value)}
            options={[
              { value: "owing", label: "Student owes" },
              { value: "credit", label: "Credit (prepaid)" },
            ]}
          />
        </div>
        <small
          style={{
            color: "var(--color-text-muted)",
            fontSize: "11px",
            display: "block",
            marginTop: "var(--space-2)",
          }}
        >
          Added to the student&apos;s total expected fees for the term.
        </small>
      </div>
    </>
  );
}

StudentFeeSettingsBlock.propTypes = {
  f: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
