# School signup & first-run onboarding

Branch: `feature/school-signup-onboarding`

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/onboarding/register-school` | Public | Create school + director + JWT |
| GET | `/api/onboarding/status` | Bearer | `needsOnboarding` flag |
| POST | `/api/onboarding/complete` | Bearer (director) | Classes, terms, fee structures |

### Register body
```json
{
  "schoolName": "Acme Academy",
  "directorName": "Jane Doe",
  "email": "director@acme.ac.ke",
  "password": "SecurePass1!",
  "phone": "07xxxxxxxx"
}
```

### Complete body
```json
{
  "schoolType": "primary",
  "academicYear": 2026,
  "activeTerm": "Term 3",
  "defaultTuition": 5000
}
```

`schoolType`: `primary` | `secondary` | `both`

## Frontend files

- `src/pages/SignupPage.jsx` — public create-school form
- `src/components/OnboardingWizard.jsx` — post-login setup

## Wire into App.jsx (required)

1. Import:
```jsx
import SignupPage from "./pages/SignupPage";
import OnboardingWizard from "./components/OnboardingWizard";
```

2. On login screen, add link/button → set view to `signup`.

3. When `!auth` and view is signup:
```jsx
<SignupPage
  onGoLogin={() => setAuthView("login")}
  onSuccess={() => {
    setNeedsOnboarding(true);
    // reload session / setAuth from saveSession
  }}
/>
```

4. After auth, if onboarding incomplete:
```jsx
// once after login or register
const st = await apiFetch("/onboarding/status");
if (st.needsOnboarding) setShowOnboarding(true);

{showOnboarding && (
  <OnboardingWizard
    onComplete={() => {
      setShowOnboarding(false);
      beginTenantRefresh();
    }}
  />
)}
```

5. Mount route in `backend/src/app.js` (already intended):
```js
import onboardingRoutes from "./routes/onboarding.routes.js";
app.use("/api/onboarding", onboardingRoutes);
```

## Deploy notes

- Render must pick up `onboarding.routes.js` + `app.js` mount.
- Vercel picks up Signup + Wizard after App.jsx wiring.
- Existing schools without the setting are treated as onboarded if they already have classes.
