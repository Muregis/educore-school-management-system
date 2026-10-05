import os

fp = 'src/pages/LoginView.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix state definitions
state_insert = '''  const [passwordChangeReasons, setPasswordChangeReasons] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [schoolName, setSchoolName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [phone, setPhone] = useState("");'''
content = content.replace('''  const [passwordChangeReasons, setPasswordChangeReasons] = useState([]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");''', state_insert)

# Fix submitSignup function
func_insert = '''  const submitSignup = async (e) => {
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

  const submitStaff = async (e) => {'''
content = content.replace('  const submitStaff = async (e) => {', func_insert)

# Fix labelStyle / fieldStyle use-before-define
style_insert = '''  const labelStyle = { display: "flex", flexDirection: "column", gap: 6 };
  const labelTextStyle = { fontSize: 13, fontWeight: 700, color: "#cbd5f5", letterSpacing: "0.02em" };
  const fieldStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", color: "#ffffff", fontSize: 15, outline: "none", transition: "all 0.2s", boxSizing: "border-box" };

  const submitSignup = async (e) => {'''
content = content.replace('  const submitSignup = async (e) => {', style_insert)

content = content.replace('''  const labelStyle = { display: "flex", flexDirection: "column", gap: 6 };
  const labelTextStyle = { fontSize: 13, fontWeight: 700, color: "#cbd5f5", letterSpacing: "0.02em" };
  const fieldStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", color: "#ffffff", fontSize: 15, outline: "none", transition: "all 0.2s", boxSizing: "border-box" };''', '', 1) # removing the old one near the bottom

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed ESLint errors")
