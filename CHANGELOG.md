# Changelog

All notable changes to OurSchool are documented here.

---

## [Unreleased]

### Lesson drawer preserves student work

- Moving lessons into the drawer, including automatic rollover, keeps all
  existing assignments and their lesson links. Rescheduling reuses the same
  records rather than duplicating submitted or graded work.
- Drawer lessons offer a “Mark taught on” action to restore a forgotten lesson
  to its original day. Publication can remain a draft, happen when scheduled, or happen immediately, including in the drawer.
- Removing a lesson, template link, or student now also preserves started work,
  notes, logged time, and excused assignments instead of silently deleting them.

### Assignment workflow and preparation

- Start and Continue open the exact assignment at a stable URL, with instructions,
  materials, working notes, time logs and submission controls. Overdue urgency
  no longer hides progress or prevents starting and submitting work.
- Student lessons link to their own assignments. Teach shows each student's
  progress beside activities and opens the correct record for grading.
- Preparation totals separate planned, prepared and taught lessons and count
  gathered materials independently. Taught lessons remain readable.
- Grading puts submitted work beside feedback and keeps empty work logs collapsed.
  Empty logs show zero minutes rather than “No estimate.”
- Assignment dates use school-date formatting, and dashboard/settings term counts
  share inclusive calendar-day calculations.

### Attendance and material discovery

- Attendance has a direct school-date picker, student/date filters for history,
  keyboard-accessible calendar days, and readable status choices. Late is an
  optional choice for scheduled classes, while existing Late records stay visible.
- Cached material libraries remain in navigation while disconnected. Connection
  guidance explains unavailable previews, downloads and sync before opening content.
- Material usage counts include lesson, template and direct student-work attachments.
- The template picker exposes its inherited subject filter, matching counts and a
  Clear filters action, making activities from other subjects discoverable.

### Planning, recovery and family routines

- Preview assignment changes before saving or moving a lesson; recover carryover
  lessons in batches. Copy lessons, days or weeks to a new date and selected children.
- Filter plans by child and subject, recover local lesson/template/grading drafts,
  and print the selected day/week with the family school name and optional logo.
- Scheduled weekend lessons stay visible inside a school-day board, including
  copied lessons, even when empty weekend columns are skipped.
- Teacher Today brings attendance, preparation, grading and task help together.
  Student Today prioritizes current work and keeps older unfinished work expandable.
- Students can show work finished on paper, ask for help, choose simple task mode
  with read-aloud, and save a short text or mood reflection.
- Reflection inbox filters preserve their scope after replies. Learning wins and
  completion acknowledgments use actual work and respect optional points/effort.
- Reflection days and daily point awards follow the learner's local school day,
  including evening entries and daylight-saving changes. Saved reflections refresh
  the points balance immediately.
- Restore previews report actual new, changed and skipped records without persisting
  changes. Nested draft dialogs keep their controls accessible, student mode changes
  work with a blank birth date, and older pending rewards remain in the pickup queue.
- Personal reward goals stay visible beside points and shopping. Empty catalog
  categories disappear; pickup instructions and returned points explain each stage.
- Reports distinguish missing grades from genuine zeroes, exclude excused work from
  grade/completion denominators, explain weighting, and suppress empty-period deltas.
- New-school setup links directly to each missing step. Backup downloads in one
  action, retains a summary, validates formats, and previews restore impact. Format
  2.4 preserves paper completion, help requests, preferences and planning policies.
- Responsive controls wrap and form inputs have meaningful accessible names.

### Paperless-NGX release readiness

- Paperless libraries now have persistent identities. Changing servers keeps
  existing attachment snapshots isolated; administrators can explicitly reconnect
  a moved library without breaking its attachments.
- Sync runs in a durable PostgreSQL-backed worker with progress, restart recovery,
  bounded retries, and configurable 5-minute to 24-hour scheduling. The default
  is 15 minutes; manual sync remains available with automatic sync disabled.
- Validated, staged batch imports prevent failed or malformed listings from
  deleting cached materials. Empty OCR is indexed once and unchanged metadata
  avoids repeated writes.
- Search and lesson ranking cover the complete filtered library. Match evidence
  replaces percentage badges, and multi-document attachment actions are atomic.
- Thumbnails require authentication and attachment access. PDF previews use
  authenticated range requests; downloads support cancellation, progress, and
  original filenames. Materials can be previewed before attachment.
- Includes the library-identity migration and backup format 2.3. Credentials
  remain excluded from backups. Backend and frontend must be upgraded together;
  existing unauthenticated thumbnail URLs no longer grant access.
- The frontend build now uses Node.js 22 for PDF.js. Setup explicitly selects a
  scope and negotiates Paperless API version 9 or 10.

### Assignment and template performance

- Assignment, grading, template-library, and assignment-report screens now load
  bounded pages with server-side filtering and complete counts. Library search
  finds templates beyond the first 100 results.
- Long instructions, feedback, and materials load when details or editors open.
  Template statistics and progress/dashboard totals use grouped queries.
- Assignment reports provide a separate CSV export for complete filtered history.
- Bulk grading recalculates each student's subject/term grade once per batch,
  while preserving successful unrelated groups if a recalculation fails.
- Added concurrent database indexes for list ordering, effective dates, and
  template search, plus bounded per-route request-performance measurements.

## [v1.1-beta4] — 2026-09-27

### Teach and lesson preparation

- **Teach is now a dedicated workspace** — run a single day's lesson plan from
  the new Teach navigation item, with date navigation, student and subject
  filters, preparation status, lesson editing, and mark-taught actions in one
  place. Planner links and the dashboard now lead directly to the relevant
  day; previous `?view=teach` links continue to redirect correctly.
- **Materials Drawer** — the Lesson Drawer now includes a compact, range-aware
  preparation checklist. Mark materials gathered without opening each lesson
  and see progress by lesson and for the selected planner range.
- Assignment-template details in Teach show the student assignments generated
  for that lesson and provide direct links to grade them.

### Lesson-planning flexibility

- Taught lessons can now be reordered, rescheduled, and moved to or from the
  Lesson Drawer without changing their status. Graded and submitted work keeps
  its existing protections.

### Session security

- Administrators can set the rolling session timeout in **Settings → Users &
  access**. The timeout applies to new and renewed sessions; setting it to `0`
  creates sessions without an expiration time.
- Added the normal database migration for the new security setting. Existing
  installations start with the previous 30-minute default.

### Usability and accessibility

- Improved phone-sized layouts and touch targets throughout navigation,
  assignments, dashboard actions, filters, dialogs, and drawers. The
  assignments page now uses readable, expandable cards on small screens.
- Mobile navigation and overlays now trap focus, close with Escape, restore
  focus when dismissed, and prevent interaction with the page behind them.
- Consolidated Admin settings into the Admin area, added a useful 404 page,
  and made settings/status failures retryable instead of silently failing.

### Fixes

- The planner date control now reliably opens its date picker when selected.

## [v1.1-beta3] — 2026-08-23

### Lesson planning flexibility

- Added a persistent Lesson Drawer for unscheduled lesson blocks, with drag and
  keyboard-accessible actions for stashing, ordering, and scheduling lessons.
- Untaught past lessons now return to the drawer on the next teacher lesson
  load. Generated unstarted assignments are withdrawn; protected student work
  remains available as an independent assignment.
- Added exact-date navigation to both the multi-day planner and Teach mode,
  including explicit weekend selection when weekends are normally skipped.
- Backup format 2.1 preserves drawer placement and former scheduled dates while
  remaining able to import format 2.0 backups.

## [v1.1-beta] — 2026-07-28

### Teacher workflow unification

One coherent flow for creating, assigning, and grading work — the scattered
modals and the parallel "template" vs. "assignment" surfaces are gone.

- **Assignment Composer** — a single create/assign surface replaces the old
  quick-assign, template-create, and template-edit modals. From one drawer you
  can assign work to students and, with **Save to library**, keep it as a
  reusable template. Backed by a new `POST /assignments/compose` endpoint.
- **Grading desk consolidation** — `GradeForm` (points-based, with real
  validation) is now the only grading UI; the separate grade modal is deleted.
  Fixes a validation gap that let invalid scores through, and there is no
  letter-grade *input* anywhere — letter grades are display-only, derived from
  the score.
- **Grade without leaving the queue** — excuse, archive, and unassign actions
  are available directly from the grading desk.
- **Reopen & archive on assignments** — excused work can be reopened and graded
  work archived, both individually and in bulk, from the assignments page.
- **Lesson planner** — create templates in place via the composer, and search
  the template library when planning; dead client-side search removed.
- **Shared UI** — a canonical `ActionMenu` replaces hand-rolled row menus, and a
  reusable `AssignmentInfo` display is shared across surfaces.
- **Data** — new `is_library` flag on assignments (migration) distinguishes
  reusable library templates from assigned work.

### Paperless-ngx integration

Connect OurSchool to a self-hosted [Paperless-ngx](https://docs.paperless-ngx.com/)
document server and use your scanned worksheets and reference documents as
teaching materials.

- **Connection & sync** — Admin → Paperless: test and connect with a server URL
  and API token (the token is stored encrypted; rotating `SECRET_KEY` requires a
  reconnect). Sync caches document metadata locally and is incremental — OCR
  keywords are only re-fetched when a document actually changed. The sync can be
  scoped to selected Paperless tags and/or document types; documents deleted on
  the Paperless side are soft-flagged rather than cascade-removed.
- **Mappings** — Paperless tags map to OurSchool subjects and Paperless document
  types map to material kinds. Name matches are mapped automatically; manual
  remaps stick across syncs.
- **Materials on everything** — attach documents to lessons (teacher prep), to
  assignment templates (visible to every student assigned from them), or to a
  single student assignment (one-off). Attachments snapshot their display fields,
  so they keep rendering even if the document or the Paperless connection goes
  away.
- **Student access** — students view or download attached documents through an
  authorized content proxy; they can only reach documents attached to their own
  work. Thumbnails are served via unguessable capability URLs.
- **Smart picker** — when attaching documents to a lesson, the picker ranks the
  library by subject match, title similarity, and OCR keywords (trigram-indexed
  search).
- New API-key permissions: `paperless:read`, `paperless:write` (two migrations).

### Points Shop

A reward catalog for the points system: students spend the points they earn on
graded work.

- **Storefront** — admins stock categories and items with photos, point costs,
  optional stock limits, and live/hidden status; items can be reordered. Item
  photos are stored in the database and served via capability URLs.
- **Redemption workflow** — items are either instant or request-fulfillment.
  Requests move pending → approved (ready) → fulfilled, or are declined with an
  automatic `refund` transaction restoring the points. Redemptions snapshot the
  item name and cost, so history stays accurate if items are later edited or
  deleted.
- **Student view** — browse the shop, redeem, review redemption history, and set
  a goal item to save toward (with progress against the current balance).
- **Admin** — store manager and redemption queue under Admin → Shop, plus an
  at-a-glance overview.
- Gated behind the existing points-system toggle; disabled shops hide all shop
  UI. New API-key permissions: `shop:read`, `shop:write` (two migrations).

### Lesson planner

Plan instruction by date, then let the planner drive the assignment workflow.

- **Date-based planning board** — lessons carry a title, objective, duration,
  notes, and status (planned / in progress / taught). Lessons can be reordered
  within a day; taught lessons are locked.
- **Templates on lessons** — link assignment templates to a lesson with
  per-link overrides (due date, max points, instructions). Saving the lesson
  syncs real student assignments for the lesson's assigned students; deleting a
  lesson orphans (rather than deletes) graded work.
- **Prep tracking** — a per-lesson materials checklist with a "gathered" toggle,
  plus ordered resource links.
- **Student view** — students see their scheduled lessons via My Lessons.
- New API-key permissions: `lessons:read`, `lessons:write` (two migrations).

---

## [v1.0.0-beta.14] — 2026-07-07

- UI fixes and improvements across the assignments, grading, and templates
  pages.
- Fixed inconsistent padding in the Attendance & compliance settings card
  (community contribution, #24).

## [v1.0.0-beta.13] — 2026-07-07

- README/API-reference corrections and CI formatting fixes; no functional
  changes.

## [v1.0.0-beta.12] — 2026-07-07

- Continued API-key coverage work and API bug fixes.
- Point transactions now record the acting admin's name (migration), so ledger
  history survives account changes.

## [v1.0.0-beta.11] — 2026-07-06

- **API-key coverage for (nearly) the whole API** — terms, subjects, assignment
  types, journal, reports, settings, activity, performance, backup, and API-key
  metadata endpoints now accept scoped API keys through the dual-auth pattern,
  expanding the permission registry well beyond the original eight scopes
  (all advertised via `GET /api/meta` and `GET /api/admin/api-keys/permissions`).
- Fixed API key creation; added schemas to the API-key settings endpoints.
- Login screen logo.

---

## [1.0.0] — 2026-07-20

### First stable release

OurSchool 1.0 completes the beta cycle and establishes the current database,
backup, API, and deployment behavior as the stable baseline. Existing beta
installations upgrade through the normal container startup migration; no
manual schema step is required. Back up the database before upgrading.

**Highlights since beta.10**

- Completed API-key coverage for the supported admin-automation surface,
  including active-admin lookup, stricter on-behalf-of attribution, and
  complete permission schemas.
- Corrected assignment, term-grade, attendance, and report calculations and
  expanded regression coverage for MCP/API workflows.
- Improved API response schemas and authorization consistency across users,
  assignments, journal, reports, settings, backup, and performance endpoints.
- Fixed login, attendance settings, assignment, template, grading, and report
  UI issues found during the final beta rounds.
- Reconciled release metadata and deployment defaults on `v1.0.0` and updated
  all user, operator, contributor, security, migration, and release docs.

## [v1.0.0-beta.10]

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
- New `docs/releasing.md` checklist; `docs/migrations.md` rewritten as user-facing
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
- Scheduled-backup guidance (cron example) in `docs/deployment.md`; restore
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
