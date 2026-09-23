# EduCore frontend styles

This folder is the **visual system** for the SPA. Keep it boring and predictable.

## Cascade order (do not reorder casually)

Imported from `src/main.jsx`:

1. `src/index.css` — reset, fonts, print helpers
2. `src/styles/design-system.css` — **tokens** (colors, space, type, radii, shadows)
3. `src/styles/mobile.css` — legacy mobile helpers
4. `src/styles/mobile-modern.css` — newer mobile helpers
5. `src/styles/layout-foundation.css` — **structural** overflow / flex shrink / table & modal containment (loads last)

App also injects a small `RESPONSIVE_CSS` string from `App.jsx` for drawer / bottom-nav. Prefer moving new rules into CSS files instead of growing that string.

## Rules of engagement

- **Tokens live in `design-system.css`** (`--color-*`, `--space-*`, `--radius-*`, fonts).
- **Layout/overflow fixes live in `layout-foundation.css`**, not inline in pages.
- Prefer `src/components/ui/*` over one-off inline styles for buttons, inputs, cards, modals, tables.
- Do **not** add Tailwind (or another utility framework) in this track.
- Do **not** change API, auth, RBAC, tenant isolation, payments, or DB from a UI PR.

## Branch / PR track

Use branch: **`ui/mobile-first-shell-v3`** (do not use `ui/mobile-first-shell` or `ui/mobile-first-shell-v2` — those were corrupted during large-file App.jsx pushes).

1. Foundation + shell CSS — **done**
2. App shell class names in `App.jsx` — **deferred** (layout-foundation CSS covers overflow/drawer without touching App.jsx)
3. Shared UI primitives (Modal, Button, Table) — **done**
4. Tables + modals mobile behavior — **done**
5. High-traffic pages only (Dashboard, Students, Fees) — **deferred** (inherit foundation; no page rewrites in this PR)

Each step should stay reviewable and mergeable with a green `npm run build`.
