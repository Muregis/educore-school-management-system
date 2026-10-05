import os
import re

fp = 'src/pages/LoginView.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add signup state
state_block = '''  const [portalRole, setPortalRole] = useState("parent");
  const [passwordChangeToken, setPasswordChangeToken] = useState(null);'''
new_state_block = '''  const [portalRole, setPortalRole] = useState("parent");
  const [passwordChangeToken, setPasswordChangeToken] = useState(null);
  
  // Signup state
  const [schoolName, setSchoolName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [phone, setPhone] = useState("");'''
content = content.replace(state_block, new_state_block)

# 2. Add submitSignup function before submitStaff
func_block = '''  const submitStaff = async (e) => {'''
new_func_block = '''  const submitSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!schoolName || !adminName || !email || !password) {
      return setError("All fields are required to create a school.");
    }
    setLoading(true);
    try {
      const data = await apiFetch("/auth/signup", {
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

  const submitStaff = async (e) => {'''
content = content.replace(func_block, new_func_block)

# 3. Add signup toggle to the mode selector
tab_block = '''              {[{ id: "staff", label: "Staff Login" }, { id: "portal", label: "Parent / Student" }].map(tab => {'''
new_tab_block = '''              {[{ id: "staff", label: "Staff Login" }, { id: "portal", label: "Parent / Student" }, { id: "signup", label: "New School" }].map(tab => {'''
content = content.replace(tab_block, new_tab_block)
grid_block = '''gridTemplateColumns: "1fr 1fr"'''
new_grid_block = '''gridTemplateColumns: "1fr 1fr 1fr"'''
content = content.replace(grid_block, new_grid_block)

# 4. Add the signup form below the submitStaff form logic
staff_form_end = '''                  {error ? <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div> : null}
                  <SubmitButton loading={loading} text="Sign In" />
                </form>
              ) : (
                <form onSubmit={submitPortal}'''

new_staff_form_end = '''                  {error ? <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div> : null}
                  <SubmitButton loading={loading} text="Sign In" />
                </form>
              ) : mode === "signup" ? (
                <form onSubmit={submitSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)" }}>Start your free trial</div>
                    <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Create a new school workspace in seconds.</div>
                  </div>
                  <label style={labelStyle}><span style={labelTextStyle}>School Name</span><input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} type="text" placeholder="e.g. Royal Academy" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Your Name (Director)</span><input value={adminName} onChange={(e) => setAdminName(e.target.value)} type="text" placeholder="e.g. Jane Doe" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Email Address</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@school.edu" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Min 8 characters" style={fieldStyle} /></label>
                  {error ? <div style={{ borderRadius: 12, padding: "10px 12px", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13 }}>{error}</div> : null}
                  <SubmitButton loading={loading} text="Create School Workspace" />
                  <div style={{ textAlign: "center", fontSize: 13, marginTop: 8, color: "var(--color-text-muted)" }}>
                    Already have an account? <span style={{ color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }} onClick={() => setMode("staff")}>Log in</span>
                  </div>
                </form>
              ) : (
                <form onSubmit={submitPortal}'''
content = content.replace(staff_form_end, new_staff_form_end)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added Signup mode to LoginView")
