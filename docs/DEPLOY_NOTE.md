# Deploy note

Production must track **main**.

Branch `fix/localstorage-stale-entity-data` was an incomplete experiment and must not be the Vercel production branch.

Cache / localStorage fix is on main via PR #25 (`useLocalState` ephemeral keys).
