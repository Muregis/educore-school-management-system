import { useEffect } from "react";

/**
 * This branch accidentally had a PLACEHOLDER App.jsx that broke Vercel builds.
 * Production must deploy from `main` (PR #25 cache fix is already there).
 * This stub only exists so previews of this branch do not fail the build.
 */
export default function App() {
  useEffect(() => {
    console.error("[EduCore] fix/localstorage-stale-entity-data is obsolete. Deploy main.");
  }, []);
  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Wrong branch</h1>
      <p style={{ color: "#555", lineHeight: 1.5 }}>
        This preview branch is obsolete. Point Vercel Production at <strong>main</strong> and redeploy.
        The localStorage cache fix already lives on <code>main</code> (PR #25).
      </p>
    </div>
  );
}
