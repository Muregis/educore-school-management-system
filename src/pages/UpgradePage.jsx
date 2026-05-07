import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 35,
    color: "var(--color-text-secondary)",
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
    color: "var(--color-primary)",
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
    color: "var(--color-warning)",
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
        body: {
          plan: planId,
          studentCount: students,
          billingCycle: billing
        }
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
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "var(--space-2)" }}>
      <div style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "var(--space-2)", color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
          Choose your plan
        </h2>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-4)", fontSize: "16px" }}>
          Per student · Per month · Cancel anytime
        </p>
        
        <div style={{ display: "inline-flex", background: "var(--color-bg-base)", borderRadius: "var(--radius-lg)", padding: "var(--space-1)", border: "1px solid var(--color-border)" }}>
          {["monthly", "annual"].map(cycle => (
            <button key={cycle} onClick={() => setBilling(cycle)} style={{
              padding: "10px 24px", 
              borderRadius: "var(--radius-md)", 
              border: "none",
              background: billing === cycle ? "var(--color-bg-surface)" : "transparent",
              color: billing === cycle ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: billing === cycle ? 600 : 500,
              cursor: "pointer", 
              fontSize: "14px",
              boxShadow: billing === cycle ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s ease"
            }}>
              {cycle === "monthly" ? "Monthly" : "Annual (2 months free)"}
            </button>
          ))}
        </div>
      </div>

      <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-5)", textAlign: "center", background: "color-mix(in srgb, var(--color-primary) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)" }}>
        <div style={{ fontSize: "15px", color: "var(--color-text-secondary)", marginBottom: "var(--space-2)", fontWeight: 500 }}>
          How many students are enrolled?
        </div>
        <div style={{ fontSize: "32px", fontWeight: 800, marginBottom: "var(--space-3)", color: "var(--color-primary)", letterSpacing: "-0.02em" }}>
          {students.toLocaleString()} students
        </div>
        <input type="range" min={50} max={2000} step={50}
          value={students} onChange={e => setStudents(Number(e.target.value))}
          style={{ width: "100%", maxWidth: "500px", accentColor: "var(--color-primary)", height: "6px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "500px", margin: "8px auto 0", fontSize: "13px", color: "var(--color-text-muted)", fontWeight: 500 }}>
          <span>50</span><span>2,000+</span>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-4)", alignItems: "start" }}>
        {PLANS.map(plan => (
          <Card key={plan.id} style={{
            padding: "var(--space-4)", 
            position: "relative",
            border: `2px solid ${plan.popular ? plan.color : "var(--color-border)"}`,
            transform: plan.popular ? "translateY(-8px)" : "none",
            boxShadow: plan.popular ? "0 20px 40px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.3s ease"
          }}>
            {plan.popular && (
              <div style={{
                position: "absolute", top: -14, left: "50%",
                transform: "translateX(-50%)",
                background: plan.color, color: "#fff",
                fontSize: "12px", fontWeight: 700,
                padding: "4px 16px", borderRadius: "20px",
                textTransform: "uppercase", letterSpacing: "0.05em",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              }}>
                Most Popular
              </div>
            )}

            <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "var(--space-1)", color: "var(--color-text-primary)" }}>{plan.name}</div>
            <div style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginBottom: "var(--space-4)", fontWeight: 500 }}>
              KES {plan.price}/student/month
            </div>

            <div style={{ fontSize: "36px", fontWeight: 800, color: plan.popular ? plan.color : "var(--color-text-primary)", marginBottom: "var(--space-1)", letterSpacing: "-0.03em" }}>
              KES {getPrice(plan.price).toLocaleString()}
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "var(--space-4)", fontWeight: 500 }}>
              per {billing === "annual" ? "year" : "month"} for {students} students
            </div>

            <Button 
              onClick={() => handleUpgrade(plan.id)}
              disabled={loading || plan.id === currentPlan}
              variant={plan.popular ? "primary" : "secondary"}
              style={{
                width: "100%", 
                padding: "12px 0", 
                marginBottom: "var(--space-4)",
                fontSize: "15px",
                background: plan.id === currentPlan ? "var(--color-bg-base)" : (plan.popular ? plan.color : undefined),
                color: plan.id === currentPlan ? "var(--color-text-muted)" : undefined,
                borderColor: plan.id === currentPlan ? "var(--color-border)" : (plan.popular ? plan.color : undefined),
                boxShadow: plan.popular && plan.id !== currentPlan ? `0 8px 20px color-mix(in srgb, ${plan.color} 30%, transparent)` : undefined
              }}
            >
              {plan.id === currentPlan ? "Current Plan" : 
               loading ? "Processing..." : `Upgrade to ${plan.name}`}
            </Button>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)" }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", fontSize: "14px", color: "var(--color-text-primary)", alignItems: "flex-start" }}>
                  <span style={{ color: plan.color, fontWeight: 700, fontSize: "16px", lineHeight: 1 }}>✓</span>
                  <span style={{ lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ 
        background: "color-mix(in srgb, var(--color-warning) 10%, transparent)", 
        border: "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)", 
        borderRadius: "var(--radius-lg)", 
        padding: "var(--space-3)", 
        marginTop: "var(--space-5)", 
        fontSize: "14px",
        color: "var(--color-text-primary)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)"
      }}>
        <div style={{ fontSize: "24px" }}>💡</div>
        <div>
          <strong style={{ color: "var(--color-text-primary)" }}>One-time onboarding fee applies:</strong> KES 20,000 (small) · KES 30,000 (medium) · KES 40,000+ (large). 
          <br/>
          <span style={{ color: "var(--color-text-secondary)" }}>Covers dedicated account manager setup, data migration, and comprehensive staff training.</span>
        </div>
      </div>

    </div>
  );
}