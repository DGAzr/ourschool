# Changelog

All notable changes to OurSchool are documented here.

---

## [v1.0.0-beta.9]

### Post-1.0-hardening backlog burn-down (2026-07-05)

- **Wipe-and-restore backup mode** — `POST /api/backup/import` accepts
  `wipe_before_import`, deleting all backup-scoped data (child tables first,
  in one transaction — a failed import rolls back to the pre-wipe state)
  before restoring. Guarded twice: the API requires
  `wipe_confirmation: "WIPE ALL DATA"` in the request body, and the UI makes
  you retype the phrase in a danger dialog. The importing admin's account and
  password, assignment types, and API keys are preserved; results report
  per-table deleted counts (would-delete counts on dry runs).
- **Server-side theme persistence** — light/dark/system preference is stored
  on the user (`PUT /users/me`) and follows you across devices; localStorage
  remains the logged-out fallback.
- **Empty states everywhere** — new shared `EmptyState` component; Grading,
  My Points, Admin Settings, and Admin Backup now show helpful empty/error
  states instead of blank panels (Admin Settings' failed load is retryable
  rather than silently rendering defaults).
- **React-hooks compiler suite enforced** — all 39 remaining warnings from
  the react-hooks v7 upgrade fixed (no state updates from effect bodies,
  keyed modal resets, `useSyncExternalStore` for media queries, synchronous
  auth hydration) and every rule flipped from `warn` to `error` in CI.
- **README** — complete endpoint reference for the whole API surface,
  corrected API-key permission table (8 permissions), and accurate
  docs-disabled-by-default note.
- **Docs cleanup** — removed the unreferenced and stale `API_GUIDE.md`,
  `COMPONENT_GUIDE.md`, and `CONFIGURATION.md`; `env.EXAMPLE` is the
  authoritative configuration reference.

### 1.0 hardening

Release-readiness work targeting a stable 1.0: security fixes, test coverage
on the critical data paths, unified versioning, and frontend completeness.

**Security & data integrity**
- **Students can no longer edit their own due dates, extended due dates,
  assigned date, instructions, or point denominator** via
  `PUT /student-assignments/{id}`; the student-writable field set is now
  restricted to submission fields (status, notes, artifacts).
- **Forced password rotation** — the seeded `admin`/`admin123` account and
  admin-issued temporary passwords must be changed on first login. The server
  blocks all other endpoints until rotation; the frontend shows a dedicated
  change-password screen. Upgraded installs are covered too: logging in with
  the well-known default credentials flags the account automatically.
- Interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are now **disabled
  by default**; set `ENABLE_API_DOCS=true` to expose them.
- All datetime columns standardized on `TIMESTAMPTZ` (migration converts
  existing values as UTC in place).
- Database connections now use `pool_pre_ping`, surviving DB/container
  restarts without stale-connection errors.
- Fixed bulk-grade failing its first item whenever the student had no points
  record yet (a commit inside the per-item savepoint).

**Testing & CI**
- 20 new backend integration tests: student/admin authorization (including a
  regression test for the mass-assignment fix), grading with points sync and
  re-grade deltas, points-weighted term-grade math, attendance-report math,
  the forced-rotation flow, and a **backup export → delete → import restore
  round-trip** (closing the beta.1 known limitation).
- Frontend: vitest + testing-library with api-wrapper smoke tests, and a
  standalone `npm run typecheck`. Both gate CI.
- **Images are now published only if the full CI suite passes** on the same
  commit; CI runs on all pull requests.

**Release engineering**
- Single version source of truth: the repo-root `VERSION` file (backend reads
  it at runtime; the frontend gets it via the `APP_VERSION` build arg).
- Fixed `IMAGE_TAG` default drift across compose/env.EXAMPLE/READMEs (all
  `v`-prefixed and consistent).
- New `RELEASING.md` checklist; `MIGRATIONS.md` rewritten as user-facing
  upgrade guidance with a prominent back-up-before-upgrading step.

**Frontend**
- The last legacy-styled pages (Admin Settings, Admin Backup) and shared
  components (MarkdownRenderer, ErrorBoundary, TokenExpiryWarning) migrated to
  the design-token system — dark mode now works everywhere.
- Every destructive action now uses the styled ConfirmDialog instead of the
  browser's native confirm popup.
- Assignments page refactored onto the shared assignment hooks (fixes a
  stale-closure refetch risk); dead code removed (legacy layouts, orphaned
  modal, last Lessons remnant).
- Accessibility pass: icon-only buttons have accessible names; form fields in
  the main flows have proper label associations.

**Configuration & docs**
- `env.EXAMPLE`/`CONFIGURATION.md` now document `BACKEND_BIND`/`POSTGRES_BIND`,
  `ENABLE_API_DOCS`, `MAX_SESSION_AGE_MINUTES`, `MAX_REQUEST_BODY_BYTES`;
  removed the unused `FRONTEND_HOST`; corrected the misleading
  `VITE_API_BASE_URL` guidance (it is build-time-baked; GHCR images use
  `/api`).
- Scheduled-backup guidance (cron example) in README.Docker.md; restore
  semantics documented as merge, not replace.

### API surface for AI workflows

Expanded the API-key-accessible surface so external/AI workflows can run
end-to-end loops, not just grade a single known assignment.

**Features**
- **Assignment discovery & authoring via API key** — list templates, list/filter
  student assignments (`/api/assignments/all-assignments`), read student
  progress, and create/update templates and assign them to students.
- **Attendance via API key** — read, record, update, and bulk-record attendance.
- New scoped permissions: `assignments:write`, `attendance:read`,
  `attendance:write` (advertised through `GET /api/meta`). Points totals,
  ledger, and grant/deduct remain under `points:read` / `points:write`.
- These reuse the dual-auth pattern (`require_admin_or_permission` /
  `require_user_or_permission`), so one endpoint serves both the web UI and an
  API key. Records authored by an API key carry null audit fields
  (`created_by` / `assigned_by`), and the affected response schemas now mark
  those fields optional.
- **On-behalf-of attribution** — API-key requests may send an
  `X-On-Behalf-Of` header (user ID or username) to attribute grades, point
  adjustments, and authored content to a real **active admin**, instead of
  leaving them unattributed. The value is validated fail-closed (unknown /
  inactive / non-admin → `400`); the header is honored only for API-key auth and
  is discoverable via `GET /api/meta` (`on_behalf_of_header`).

**Tests**
- Added integration tests covering API-key access (allowed with permission,
  403 without), null audit fields on key-authored records, and `/api/meta`
  advertising the new permissions.

---

## [1.0.0-beta.1] — 2026-06-20

### First beta release

This release marks the transition from alpha to beta. The core academic workflow
is stable; the database schema may still receive breaking changes before the
2026-2027 stable release.

#### What's new since alpha

**Features**
- **Assignment types** are now fully configurable (CRUD) — no longer a fixed enum
- **UI redesign** — Admin Center, Dashboard, Settings, Attendance, Assignments, Reports, Login all refreshed with a consistent design system and icon set
- **Backup system hardening** — cross-version import with stable external IDs; dry-run preview; audit logging on all backup operations
- **MCP-ready API** — meta endpoint for enum and permission discovery; API key authentication with per-key scoped permissions

**Improvements**
- Reporting accuracy fixes
- Faster/inline assignment grading
- Assignment bulk-assign workflow

**Infrastructure**
- Frontend now served by nginx (replacing Vite preview) with SPA fallback and gzip compression
- Docker: non-root users, pinned base images, loopback-only port binds, fail-fast on unset `SECRET_KEY`

#### Removed

- **Lessons feature** — removed in favour of the streamlined subject-and-assignment workflow. There is no migration path from lessons; use the backup/restore system to preserve other data before upgrading from an alpha build that used lessons.

#### Known limitations

- Test coverage is limited (auth and points only); the backup/restore round-trip is not yet covered by automated tests.
- The in-memory login rate-limit and error store reset on restart and do not span multiple workers.
- `clean_import` (truncate before import) is not yet implemented — current import merges/upserts by external ID.
- Backup export omits password hashes by design. After a full restore, all users must reset their passwords.

---

## [0.0.1-alpha] — 2025-08-25

Initial alpha release for personal use. Core features: attendance, subjects,
assignments, grading, journal, points/gamification, JWT auth, Alembic migrations,
Docker deployment.
