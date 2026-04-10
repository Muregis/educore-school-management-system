import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 35,
    color: "#64748b",
    features: [
      "Student records",
      "Attendance tracking", 
      "Grades & report cards",
      "Basic fee recording",
      "Parent & student portal",
      "3 staff accounts"
    ]
  },
  {
    id: "standard", 
    name: "Standard",
    price: 50,
    color: "#1a56db",
    popular: true,
    features: [
      "Everything in Starter",
      "M-Pesa integration",
      "SMS notifications",
      "Full finance module",
      "HR & payroll",
      "Library management",
      "Full analytics",
      "10 staff accounts",
      "Weekly backups"
    ]
  },
  {
    id: "premium",
    name: "Premium", 
    price: 85,
    color: "#7c3aed",
    features: [
      "Everything in Standard",
      "AI lesson plan generator",
      "AI CBC compliance checker",
      "Paystack integration",
      "WhatsApp notifications",
      "Advanced analytics",
      "Daily backups",
      "Unlimited staff accounts",
      "Priority support (2hrs)"
    ]
  }
];

export default function UpgradePage({ auth, toast }) {
  const [students, setStudents] = useState(100);
  const [billing, setBilling] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("starter");
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    async function loadSubscription() {
      try {
        const data = await apiFetch("/subscription", { token: auth?.token });
        setCurrentPlan(data.currentPlan || "starter");
        setSubscription(data);
        setStudents(data.studentCount || 100);
      } catch (err) {
        console.error("Failed to load subscription:", err);
      }
    }
    if (auth?.token) loadSubscription();
  }, [auth?.token]);

  const getPrice = (pricePerStudent) => {
    const monthly = pricePerStudent * students;
    return billing === "annual" ? monthly * 10 : monthly;
  };

  const handleUpgrade = async (planId) => {
    if (planId === currentPlan) return;
    setLoading(true);
    try {
      const res = await apiFetch("/subscription/upgrade", {
        method: "POST",
        token: auth?.token,
        body: JSON.stringify({
          plan: planId,
          studentCount: students,
          billingCycle: billing
        })
      });
      toast(`Successfully upgraded to ${planId} plan!`, "success");
      setCurrentPlan(planId);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast(`Upgrade failed: ${err.message}`, "error");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Choose your plan
        </h2>
        <p style={{ color: "#64748b", marginBottom: 20 }}>
          Per student · Per month · Cancel anytime
        </p>
        
        <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
          {["monthly", "annual"].map(cycle => (
            <button key={cycle} onClick={() => setBilling(cycle)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: billing === cycle ? "#fff" : "transparent",
              fontWeight: billing === cycle ? 700 : 400,
              cursor: "pointer", fontSize: 13,
              boxShadow: billing === cycle ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
            }}>
              {cycle === "monthly" ? "Monthly" : "Annual (2 months free)"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, marginBottom: 28, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#64748b", marginBottom: 8 }}>
          How many students?
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          {students} students
        </div>
        <input type="range" min={50} max={2000} step={50}
          value={students} onChange={e => setStudents(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 400 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 400, margin: "4px auto 0", fontSize: 12, color: "#94a3b8" }}>
          <span>50</span><span>2,000</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{
            background: "#fff",
            border: `2px solid ${plan.popular ? plan.color : "#e2e8f0"}`,
            borderRadius: 16, padding: 24, position: "relative"
          }}>
            {plan.popular && (
              <div style={{
                position: "absolute", top: -12, left: "50%",
                transform: "translateX(-50%)",
                background: plan.color, color: "#fff",
                fontSize: 11, fontWeight: 700,
                padding: "3px 14px", borderRadius: 99
              }}>
                Most Popular
              </div>
            )}

            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              KES {plan.price}/student/month
            </div>

            <div style={{ fontSize: 26, fontWeight: 800, color: plan.color, marginBottom: 4 }}>
              KES {getPrice(plan.price).toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
              per {billing === "annual" ? "year" : "month"} for {students} students
            </div>

            <button onClick={() => handleUpgrade(plan.id)}
              disabled={loading || plan.id === currentPlan}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8,
                border: "none", cursor: plan.id === currentPlan ? "default" : "pointer",
                background: plan.id === currentPlan ? "#e2e8f0" : plan.color,
                color: plan.id === currentPlan ? "#94a3b8" : "#fff",
                fontWeight: 700, fontSize: 14, marginBottom: 20
              }}>
              {plan.id === currentPlan ? "Current plan" : 
               loading ? "Upgrading..." : `Upgrade to ${plan.name}`}
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <span style={{ color: plan.color, fontWeight: 700 }}>+</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: 16, marginTop: 24, fontSize: 13 }}>
        <strong>One-time onboarding fee applies:</strong> KES 20,000 (small) · KES 30,000 (medium) · KES 40,000+ (large). 
        Covers setup, data migration, and staff training.
      </div>

    </div>
  );
}