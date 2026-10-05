import os
import re

fp = 'src/pages/LoginView.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Move styles to top
styles = '''const labelStyle = { display: "flex", flexDirection: "column", gap: 6 };
const labelTextStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8ea3c4" };
const fieldStyle = { width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#edf4ff", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" };'''

content = content.replace(styles, '') # remove from bottom
content = content.replace('const DEFAULT_BRANDING = {', styles + '\n\nconst DEFAULT_BRANDING = {') # add to top

# 2. Add submitSignup inside LoginView
func_str = '''  const submitSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!schoolName || !adminName || !email || !password) {
      return setError("All fields are required to create a school.");
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/signup", {
        method: "POST",
        body: { schoolName, adminName, email, password, phone }
      });
      if (data.token) {
        onLogin(data);
      } else {
        setNotice("School created successfully! You can now log in.");
        setMode("staff");
        setPassword("");
      }
    } catch (err) {
      setError(err.message || "Failed to create school. Try again.");
    } finally {
      setLoading(false);
    }
  };

  async function submitStaff(event) {'''

content = content.replace('  async function submitStaff(event) {', func_str)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed ESLint errors")
