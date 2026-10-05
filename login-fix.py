import os
import re

fp = 'src/pages/LoginView.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Standardize onLogin fields
old_onlogin = 'onLogin({ id: data.user.userId, name: data.user.name, email: data.user.email ?? email, role: data.user.role, schoolId: data.user.schoolId, token: data.token, sessionId: data.sessionId });'
new_onlogin = 'onLogin({ id: data.user.userId || data.user.id, name: data.user.name || data.user.full_name || data.user.first_name, email: data.user.email ?? email, role: data.user.role, schoolId: data.user.schoolId || data.user.school_id, token: data.token, sessionId: data.sessionId || data.session_id });'
content = content.replace(old_onlogin, new_onlogin)

# 2. Fix error handling distinctly
old_catch = '''    } catch (err) {
      const body = err?.body || {};
      const changeTok = body.changeToken || body.change_token || body.passwordChangeToken;
      const mustChange = body.requires_password_change || body.passwordChangeRequired || body.password_change_required || (err?.status === 403 && changeTok);
      if (mustChange && changeTok) {
        setPasswordChangeToken(changeTok);
        setPasswordChangeReasons(body.policyViolation || body.errors || []);
        setError("");
        setNotice(body.message || "Please set a new password to continue.");
        setMode("passwordChange");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {'''

new_catch = '''    } catch (err) {
      const body = err?.body || {};
      const changeTok = body.changeToken || body.change_token || body.passwordChangeToken;
      const mustChange = body.requires_password_change || body.passwordChangeRequired || body.password_change_required || (err?.status === 403 && changeTok);
      if (mustChange && changeTok) {
        setPasswordChangeToken(changeTok);
        setPasswordChangeReasons(body.policyViolation || body.errors || []);
        setError("");
        setNotice(body.message || "Please set a new password to continue.");
        setMode("passwordChange");
      } else {
        if (err.status === 401 || err.status === 403) {
          setError(err.message || "Incorrect password or unauthorized.");
        } else if (err.status === 404) {
          setError(err.message || "User not found.");
        } else if (err.message && (err.message.includes("timed out") || err.message.includes("Failed to fetch") || !navigator.onLine)) {
          setError("Network error. Please check your connection and try again.");
        } else {
          setError(err.message || "Login failed");
        }
      }
    } finally {'''
content = content.replace(old_catch, new_catch)

# 3. Fix form inputs for Staff
old_form = '''              ) : mode === "staff" ? (
                <form onSubmit={submitStaff} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                  <input type="text" name="fake_username" style={{ display: "none" }} autoComplete="off" />
                  <input type="password" name="fake_password" style={{ display: "none" }} autoComplete="off" />
                  <label style={labelStyle}><span style={labelTextStyle}>Email address</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" name={email_} placeholder="you@school.ac.ke" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Password</span><div style={{ position: "relative" }}><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" name={password_} style={{ ...fieldStyle, paddingRight: 64 }} /><button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#8ea3c4", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{showPassword ? "Hide" : "Show"}</button></div></label>'''

new_form = '''              ) : mode === "staff" ? (
                <form onSubmit={submitStaff} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <label style={labelStyle}><span style={labelTextStyle}>Email address</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" name="email" placeholder="you@school.ac.ke" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Password</span><div style={{ position: "relative" }}><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" name="password" style={{ ...fieldStyle, paddingRight: 64 }} /><button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#8ea3c4", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{showPassword ? "Hide" : "Show"}</button></div></label>'''
content = content.replace(old_form, new_form)

# Same for Portal
old_portal = '''                ) : (
                <form onSubmit={submitPortal} style={{ display: "flex", flexDirection: "column", gap: 14 }} autoComplete="off">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {["parent", "student"].map(role => (
                      <button key={role} type="button" onClick={() => setPortalRole(role)} style={{ border: "none", borderRadius: 10, padding: "10px 12px", background: portalRole === role ? "linear-gradient(135deg, var(--primary-color), var(--secondary-color))" : "rgba(255,255,255,0.04)", color: portalRole === role ? "#08111f" : "#d7e4fb", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{role}</button>
                    ))}
                  </div>
                  <label style={labelStyle}><span style={labelTextStyle}>Admission / Portal ID</span><input value={admission} onChange={(e) => setAdmission(e.target.value)} type="text" autoComplete="off" placeholder="Admission number" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="off" style={fieldStyle} /></label>'''

new_portal = '''                ) : (
                <form onSubmit={submitPortal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {["parent", "student"].map(role => (
                      <button key={role} type="button" onClick={() => setPortalRole(role)} style={{ border: "none", borderRadius: 10, padding: "10px 12px", background: portalRole === role ? "linear-gradient(135deg, var(--primary-color), var(--secondary-color))" : "rgba(255,255,255,0.04)", color: portalRole === role ? "#08111f" : "#d7e4fb", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{role}</button>
                    ))}
                  </div>
                  <label style={labelStyle}><span style={labelTextStyle}>Admission / Portal ID</span><input value={admission} onChange={(e) => setAdmission(e.target.value)} type="text" autoComplete="username" name="username" placeholder="Admission number" style={fieldStyle} /></label>
                  <label style={labelStyle}><span style={labelTextStyle}>Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" name="password" style={fieldStyle} /></label>'''
content = content.replace(old_portal, new_portal)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)
print("LoginView updated safely")
