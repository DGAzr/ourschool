# OurSchool API Integration

OurSchool has a REST API for external integrations — handy for AI tools, automation, or a second screen that shows grades without navigating the UI.

Docker deployments serve the API through the frontend at `http://localhost:4173/api/...` (or your HTTPS domain). Direct `http://localhost:8000` access is available only in native development or with the explicit Docker development preset; production does not publish that port.

## Authentication

**User session (Bearer token)**
```bash
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
# Returns a JWT — use as: Authorization: Bearer <token>
```

**API key** (create under Admin → API Keys)
```bash
curl -H "X-API-Key: os_YOUR_KEY_HERE" \
  http://localhost:4173/api/points/admin/overview
```

Every authenticated endpoint accepts a Bearer token. Most admin automation endpoints also accept an API key carrying the matching permission listed below. User self-service, student-only operations, authentication, user creation/management, and API-key mutation remain session-only. Shop image capability URLs, health checks, and the first-user bootstrap are intentionally unauthenticated.

**Design rule:** the API-key surface is admin automation only. A key may read or write any student's data (subject to its permissions) and attribute writes to a real admin via `X-On-Behalf-Of`, but it never acts *as* a student: current-user endpoints (`/my-*`, `/reports/student/*`) require a student login session, and nothing on the API surface can author content in a student's name.

## API Key Permissions

| Permission | What it grants |
|------------|----------------|
| `students:read` | List and look up students (`/api/users/students`, `/api/users/students/lookup`, `/api/users/students/{id}/info`) |
| `users:read` | List active admins (`/api/users/admins`), e.g. to resolve an `X-On-Behalf-Of` target by name |
| `assignments:read` | Read templates, assignments, and student progress |
| `assignments:write` | Create/update templates; assign templates to students |
| `assignments:grade` | Grade student assignments |
| `assignment_types:read` | Read assignment types |
| `assignment_types:write` | Create, update, and delete assignment types |
| `attendance:read` | Read attendance records |
| `attendance:write` | Create/update/delete attendance records (incl. bulk) |
| `points:read` | Read student points balances and transaction history |
| `points:write` | Adjust student points |
| `terms:read` | Read terms, active term, grade reports, and student term reports |
| `terms:write` | Create, update, activate, and delete terms; link subjects and calculate grades |
| `subjects:read` | Read subjects |
| `subjects:write` | Create, update, and delete subjects |
| `shop:read` | Read the reward catalog, redemption queue, and shop overview |
| `shop:write` | Manage shop categories, items, images, and redemptions |
| `lessons:read` | Read lesson plans |
| `lessons:write` | Create, update, reorder, and delete lesson plans |
| `paperless:read` | Read Paperless connection status, cached documents, thumbnails, and content |
| `paperless:write` | Configure and sync Paperless and manage document attachments |
| `reports:read` | Read student, admin, attendance, assignment, and report-card reports |
| `journal:read` | Read journal entries and composer data |
| `journal:write` | Create, update, and delete journal entries |
| `journal:moderate` | Reply, react, mark read, and delete journal entries or replies |
| `activity:read` | Read the recent activity feed |
| `settings:read` | Read application settings, points presets, and journal-points settings |
| `settings:write` | Create or update settings, toggle points, and update points presets |
| `performance:read` | Read performance statistics and slow-operation reports |
| `performance:write` | Reset performance statistics |
| `backup:export` | Export a full system backup |
| `backup:import` | Import a system backup (can overwrite all data) |
| `api_keys:read` | Read API-key metadata and usage statistics |

## MCP / enum discovery

```bash
GET /api/meta
```
Returns all active assignment types, assignment status enum values, and available API key permissions. Useful for AI/MCP clients that need to enumerate valid values before taking action.

## Quick example — grade an assignment

```bash
curl -X POST "http://localhost:4173/api/integrations/assignments/123/grade" \
  -H "X-API-Key: os_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"points_earned": 85.0, "teacher_feedback": "Nice work!", "letter_grade": "B+"}'
```

## Python snippet

```python
import requests, os

API_KEY = os.getenv("OURSCHOOL_API_KEY")
headers = {"X-API-Key": API_KEY}

r = requests.get("http://localhost:4173/api/points/admin/overview", headers=headers)
for student in r.json()["student_points"]:
    print(f"{student['student_name']}: {student['current_balance']} pts")
```

## Endpoint reference

The complete API surface as of `v1.1-beta`. Set `ENABLE_API_DOCS=true` for the interactive version (request/response schemas included) at `/docs`.

<details>
<summary><strong>Expand the full endpoint list</strong></summary>

### Auth

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Log in (form fields `username`, `password`); returns a JWT |
| `POST /api/auth/extend-session` | Exchange a valid token for a fresh one |

### Users

| Endpoint | Description |
|----------|-------------|
| `GET /api/users/` | List all users (admin) |
| `POST /api/users/` | Create a user (admin); the very first user can be created unauthenticated to bootstrap the system |
| `GET /api/users/me` | Current user profile |
| `PUT /api/users/me` | Update own profile (name, email, username, theme preference) |
| `POST /api/users/me/change-password` | Change own password |
| `GET /api/users/students` | List all students (admin or `students:read`) |
| `GET /api/users/students/lookup` | Lightweight student lookup (`students:read`) |
| `GET /api/users/students/{student_id}/info` | Student details (`students:read`) |
| `GET /api/users/admins` | List active admins (admin or `users:read`) |
| `GET /api/users/{user_id}` | Get a user |
| `PUT /api/users/{user_id}` | Update a user (admins: any field; students: own profile fields) |
| `DELETE /api/users/{user_id}` | Delete a user (admin) |
| `POST /api/users/{user_id}/reset-password` | Issue a temporary password that must be rotated on next login (admin) |

### Subjects

| Endpoint | Description |
|----------|-------------|
| `GET /api/subjects/` | List subjects |
| `POST /api/subjects/` | Create a subject (admin) |
| `PUT /api/subjects/{subject_id}` | Update a subject (admin) |
| `DELETE /api/subjects/{subject_id}` | Delete a subject (admin) |

### Terms

| Endpoint | Description |
|----------|-------------|
| `GET /api/terms/` | List terms |
| `POST /api/terms/` | Create a term (admin) |
| `GET /api/terms/active` | The currently active term |
| `GET /api/terms/{term_id}` | Get a term |
| `PUT /api/terms/{term_id}` | Update a term (admin) |
| `DELETE /api/terms/{term_id}` | Delete a term (admin) |
| `POST /api/terms/{term_id}/activate` | Make this the active term (admin) |
| `POST /api/terms/{term_id}/auto-link-subjects` | Link all subjects to the term (admin) |
| `POST /api/terms/{term_id}/calculate-grades` | Recalculate term grades (admin) |
| `GET /api/terms/{term_id}/grade-report` | Grade report for the whole term (admin) |
| `GET /api/terms/{term_id}/students/{student_id}/report` | One student's term report |

### Assignment types

| Endpoint | Description |
|----------|-------------|
| `GET /api/assignment-types/` | List assignment types (with grade-book weights, icons, colors) |
| `POST /api/assignment-types/` | Create an assignment type (admin) |
| `PUT /api/assignment-types/{type_id}` | Update an assignment type (admin) |
| `DELETE /api/assignment-types/{type_id}` | Delete an assignment type (admin) |

### Assignment templates

| Endpoint | Description |
|----------|-------------|
| `POST /api/assignments/compose` | Create a template and optionally assign it to students in one transaction (`assignments:write`) |
| `GET /api/assignments/templates` | List templates (supports `search`) (`assignments:read`) |
| `POST /api/assignments/templates` | Create a template (`assignments:write`) |
| `GET /api/assignments/templates/{template_id}` | Get a template |
| `PUT /api/assignments/templates/{template_id}` | Update a template (`assignments:write`) |
| `DELETE /api/assignments/templates/{template_id}` | Delete a template |
| `POST /api/assignments/templates/{template_id}/archive` | Archive a template |
| `GET /api/assignments/templates/{template_id}/assignments` | Student assignments created from a template |
| `GET /api/assignments/templates/{template_id}/export` | Export one template as portable JSON |
| `POST /api/assignments/templates/bulk-export` | Export multiple templates |
| `POST /api/assignments/templates/import` | Import a previously exported template |

### Student assignments & grading

| Endpoint | Description |
|----------|-------------|
| `POST /api/assignments/assign` | Assign a template to one or more students (`assignments:write`) |
| `GET /api/assignments/all-assignments` | All student assignments, filterable — the grading queue (`assignments:read`) |
| `GET /api/assignments/submitted` | Assignments awaiting a grade |
| `POST /api/assignments/bulk-grade` | Grade many assignments in one call |
| `GET /api/assignments/dashboard/overview` | Admin dashboard rollup |
| `GET /api/assignments/my-assignments` | Current student's assignments |
| `POST /api/assignments/my-assignments` | Create a private one-off assignment (student session only) |
| `PUT /api/assignments/my-assignments/{id}` | Edit the student's own one-off before work starts or is submitted |
| `GET /api/assignments/my-term-grades` | Current student's term grades |
| `GET /api/assignments/student-assignments/{id}` | Get one student assignment |
| `PUT /api/assignments/student-assignments/{id}` | Update an assignment instance (students: submission fields only; admins: individualized terms) |
| `DELETE /api/assignments/student-assignments/{id}` | Delete a student assignment (admin) |
| `GET /api/assignments/student-assignments/{id}/time-entries` | List manual work sessions |
| `POST /api/assignments/student-assignments/{id}/time-entries` | Log a dated work session |
| `PUT /api/assignments/time-entries/{entry_id}` | Correct a work session |
| `DELETE /api/assignments/time-entries/{entry_id}` | Delete a work session |
| `POST /api/assignments/student-assignments/{id}/start` | Mark in-progress (student) |
| `POST /api/assignments/student-assignments/{id}/complete` | Submit for grading (student) |
| `POST /api/assignments/student-assignments/{id}/grade` | Grade it (admin) |
| `POST /api/assignments/student-assignments/{id}/archive` | Archive it (admin) |
| `GET /api/assignments/students/{student_id}/assignments` | A student's assignments (admin) |
| `GET /api/assignments/students/{student_id}/progress` | A student's progress summary (`assignments:read`) |
| `GET /api/assignments/student-term-grades/{student_id}` | A student's term grades (admin) |

### Attendance

| Endpoint | Description |
|----------|-------------|
| `GET /api/attendance/` | List attendance records, filterable by student/date range (`attendance:read`) |
| `POST /api/attendance/` | Record attendance for one student (`attendance:write`) |
| `POST /api/attendance/bulk` | Record attendance for many students at once (`attendance:write`) |
| `GET /api/attendance/students` | Students available for attendance (`attendance:read`) |
| `PUT /api/attendance/{record_id}` | Update a record (`attendance:write`) |
| `DELETE /api/attendance/{record_id}` | Delete a record (`attendance:write`) |

### Journal

| Endpoint | Description |
|----------|-------------|
| `GET /api/journal/entries` | List journal entries (admins see all; students see their own) |
| `POST /api/journal/entries` | Create an entry (API keys must attribute via `X-On-Behalf-Of` admin) |
| `GET /api/journal/entries/{entry_id}` | Get an entry |
| `PUT /api/journal/entries/{entry_id}` | Update visible entry fields and set edit attribution (API keys require `X-On-Behalf-Of`) |
| `DELETE /api/journal/entries/{entry_id}` | Delete an entry |
| `POST /api/journal/entries/{entry_id}/mark-read` | Mark an entry read |
| `POST /api/journal/entries/{entry_id}/reactions` | Set reactions on an entry |
| `POST /api/journal/entries/{entry_id}/replies` | Reply to an entry |
| `DELETE /api/journal/replies/{reply_id}` | Delete a reply |
| `GET /api/journal/students` | Students available for journal filters (admin) |
| `GET /api/journal/composer-data` | Prefill data for the entry composer |

Journal creation and composer data accept an optional `timezone` IANA name
(default `UTC`). The web client sends its local timezone so reflection days and
the first-reflection point award use the same school day as the journal display.
Unknown names return 422 before an entry is created. Day bounds include daylight-saving changes.

### Points

| Endpoint | Description |
|----------|-------------|
| `GET /api/points/status` | Is the points system enabled? |
| `POST /api/points/toggle` | Enable/disable the points system (admin) |
| `GET /api/points/my-balance` | Current student's balance |
| `GET /api/points/my-ledger` | Current student's transaction history (paginated) |
| `GET /api/points/student/{student_id}/balance` | A student's balance (`points:read`) |
| `GET /api/points/student/{student_id}/ledger` | A student's transaction history (`points:read`) |
| `GET /api/points/admin/overview` | All students' balances at a glance (`points:read`) |
| `POST /api/points/adjust` | Award or deduct points (`points:write`) |
| `GET /api/points/presets` | Configured quick-award presets |
| `PUT /api/points/presets` | Set quick-award presets (admin) |
| `GET /api/points/journal-points` | Points awarded per journal submission |
| `PUT /api/points/journal-points` | Set journal submission points (admin) |

### Points shop

All shop operations except the image capability URL require the points system to be enabled.

| Endpoint | Description |
|----------|-------------|
| `GET /api/shop/categories` | List categories and active-item counts (`shop:read`) |
| `POST /api/shop/categories` | Create a category (`shop:write`) |
| `PUT /api/shop/categories/{category_id}` | Update a category (`shop:write`) |
| `DELETE /api/shop/categories/{category_id}` | Delete an unused category (`shop:write`) |
| `GET /api/shop/items` | List items; students see active items only (`shop:read`) |
| `POST /api/shop/items` | Create an item (`shop:write`) |
| `GET /api/shop/items/{item_id}` | Get one item (`shop:read`) |
| `PUT /api/shop/items/{item_id}` | Update an item (`shop:write`) |
| `PATCH /api/shop/items/{item_id}` | Toggle an item's live/hidden state (`shop:write`) |
| `DELETE /api/shop/items/{item_id}` | Delete an item and its stored images (`shop:write`) |
| `PUT /api/shop/items/reorder` | Set storefront item order (`shop:write`) |
| `POST /api/shop/redeem` | Redeem an item (student session only) |
| `GET /api/shop/my-redemptions` | Current student's redemption history (student session only) |
| `PUT /api/shop/my-goal` | Set or clear the current student's savings goal (student session only) |
| `GET /api/shop/redemptions` | Redemption queue, filtered by `pending`, `ready`, or `history` (`shop:read`) |
| `POST /api/shop/redemptions/{redemption_id}/approve` | Approve a pending redemption (`shop:write`) |
| `POST /api/shop/redemptions/{redemption_id}/decline` | Decline and refund a pending redemption (`shop:write`) |
| `POST /api/shop/redemptions/{redemption_id}/fulfill` | Mark an approved redemption fulfilled (`shop:write`) |
| `GET /api/shop/admin/overview` | Shop summary counts (`shop:read`) |
| `POST /api/shop/images` | Upload a shop image and return its capability URL (`shop:write`) |
| `GET /api/shop/images/{image_id}` | Serve an immutable shop image by capability URL (no authentication) |

### Lesson planning

Lesson writes synchronize assignments generated from the lesson's linked templates. A nullable lesson `date` places the lesson in the Lesson Drawer; `last_scheduled_date` retains its former placement. Stashing and automatic rollover preserve existing assignments, lesson links, due dates, notes, work logs, submissions, and grades. Rescheduling reuses those assignment IDs; submitted/graded deadlines stay fixed. Each lesson-template link has `assignment_timing`: `draft` (no new assignments), `on_schedule` (the default; create when dated), or `now` (create even in the drawer). Existing work is retained regardless of publication policy. `due_offset_days` (0–365, default 0) sets a relative deadline; `custom_due_date` overrides it. Undated retained work keeps its recorded deadline. To recover a forgotten taught lesson, update its date to `last_scheduled_date` and status to `taught` together. Explicitly removing a student/template or deleting a lesson removes untouched generated assignments, but preserves assignments containing progress or work as unlinked records with warnings.

| Endpoint | Description |
|----------|-------------|
| `GET /api/lessons/` | List scheduled lessons, optionally filtered by an inclusive date range (`lessons:read`) |
| `GET /api/lessons/drawer` | List unscheduled lessons in drawer order (`lessons:read`) |
| `POST /api/lessons/rollover` | Move lessons before the supplied browser-local date into the drawer unless taught (`lessons:write`) |
| `POST /api/lessons/` | Create a scheduled or drawer lesson with students, templates, materials, and resources (`lessons:write`) |
| `GET /api/lessons/my-lessons` | Current student's upcoming lessons with links/progress for only their own assignments; supports date filters (student session only) |
| `GET /api/lessons/assignment-progress?date=YYYY-MM-DD` | Minimal student assignment progress/IDs for the selected school date (`assignments:read`, separate from lesson permissions) |
| `GET /api/lessons/{lesson_id}` | Get one lesson (`lessons:read`) |
| `PUT /api/lessons/{lesson_id}` | Update a lesson and synchronize generated assignments (`lessons:write`) |
| `DELETE /api/lessons/{lesson_id}` | Delete a lesson while preserving assignments with progress or work (`lessons:write`) |
| `PATCH /api/lessons/{lesson_id}/materials/{material_id}` | Toggle a prep material's gathered state (`lessons:write`) |
| `PATCH /api/lessons/reorder` | Reorder lessons or move them between dates/the drawer using a nullable destination date; including taught lessons without changing their status (`lessons:write`) |
| `PATCH /api/lessons/{lesson_id}/status` | Set a lesson's planning/taught status (`lessons:write`) |

### Lesson impact and repeat planning

`POST /api/lessons/impact` accepts a prospective lesson plan plus optional `lesson_id` and `deleting`. It returns student/activity actions (`create`, `reuse`, `move`, `retain`, `unlink`, `remove`, `draft`), assignment IDs, deadlines and explanations without writing records. Permission: `lessons:write` or administrator.

`POST /api/lessons/batch` accepts `lesson_ids` (1–100) and `action` (`schedule`, `restore_taught`, `copy`). Copy requires a target `date`; schedule accepts a target date or a null/omitted date to stash lessons in the drawer. Copies optionally accept `student_ids`; omission keeps each source roster. All sources and students are validated before writes. Restore uses each former date; copying preserves date offsets and planning/material snapshots, resets preparation, and creates new work without grades, submissions or logs.

### Paper completion, help and preferences

Student-assignment updates accept `submission_method: online | paper`. Students can mark work ready for teacher review with optional text notes and existing external links. Paper work is reviewed together in person. Assignment file uploads are not supported.

`POST /api/assignments/student-assignments/{id}/help` creates an open help request with `note` (1–2000 characters). Teachers read the bounded inbox at `GET /api/assignments/help-requests` and resolve with `POST /api/assignments/help-requests/{id}/resolve`, optionally including `response` (up to 2000 characters). The student sees the response on the exact task. Another student's requests are forbidden.

`PUT /api/users/me` accepts `show_points`, `show_effort_signals` and `celebrate_completion`. Administrators can set `student_ui_mode` to `regular` or `simple` through user editing; age does not select a mode automatically. Assignment-page queries additionally accept `due_from`, `due_to`, `include_undated` and `sort=recent` with cursor pagination.

Reflections contain text and optional mood; photo uploads are not supported. Reflection-day signals count student-authored entries and use recorded Present/Late school days for gaps; teacher notes and unrecorded breaks do not manufacture a streak or failure. The student's effort preference suppresses these signals.

### School setup and reward pickup

Authenticated `GET /api/settings/school/identity` returns the program name and optional logo. Administrators update the name with `PUT` and upload/remove a raster logo with `POST`/`DELETE /api/settings/school/logo` (up to 2 MB). Logos retain transparency and are resized to at most 512 pixels. Teacher-only `GET /api/settings/setup/checklist` and `POST /api/settings/setup/attendance-reviewed` support the first-school checklist.

Shop approval accepts optional `pickup_instructions` (up to 1000 characters). Redemptions expose these instructions and `points_refunded`, so clients distinguish requested/held, ready, fulfilled and declined/refunded states accurately.

### Reports

| Endpoint | Description |
|----------|-------------|
| `GET /api/reports/admin/overview` | Program-wide performance report (admin) |
| `GET /api/reports/admin/assignments` | Assignment completion report (admin) |
| `GET /api/reports/admin/student-progress` | Progress for all students (admin) |
| `GET /api/reports/attendance/bulk` | Attendance summary for all students (admin) |
| `GET /api/reports/attendance/student/{student_id}` | One student's attendance report |
| `GET /api/reports/report-card/{student_id}/{term_id}` | Term report card |
| `GET /api/reports/student/overview` | Current student's overview |
| `GET /api/reports/student/subject-performance` | Current student's per-subject performance |
| `GET /api/reports/student/term-grades` | Current student's term grades |
| `GET /api/reports/academic-years` | Academic years present in the data |

### Settings (admin)

| Endpoint | Description |
|----------|-------------|
| `GET /api/settings/` | All system settings |
| `POST /api/settings/` | Create a setting |
| `GET /api/settings/grouped` | Settings grouped by category |
| `GET /api/settings/{setting_key}` | Get one setting |
| `PUT /api/settings/{setting_key}` | Update one setting |
| `PUT /api/settings/attendance/required-days` | Required instructional days per year |
| `PUT /api/settings/attendance/count-excused` | Whether excused absences count as attended |
| `PUT /api/settings/attendance/skip-weekends` | Whether weekends are skipped |
| `PUT /api/settings/grading/scale` | Letter-grade scale |

### Backup & restore (admin)

Format **2.4** adds publication policies, learner preferences, paper completion, task help history and pickup/refund metadata. Versions 1.0–2.3 remain accepted. Shop images and the school logo remain the approved image exceptions and are included in the JSON export. Assignment work and reflections do not store files. Send restore flags under `import_options`; unknown body fields/options and non-boolean flags return `422` before writes. Dry-run imports return additions, updates, skips and, for wipe mode, deletion counts without persisting records. Preview executes dependency resolution and duplicate checks in a savepoint that is rolled back; integration jobs remain untouched. Wipe previews use the post-wipe state, and newly created parents are included when predicting dependent records. The UI requires a preview matching the current file/options before applying a restore; wipe still requires the typed confirmation phrase.

| Endpoint | Description |
|----------|-------------|
| `GET /api/backup/export` | Full system export as JSON (password hashes excluded) |
| `POST /api/backup/import` | Import a backup. Options: `dry_run`, `skip_existing_users`, `update_existing_data`, `allow_admin_import`, and `wipe_before_import` (requires `wipe_confirmation: "WIPE ALL DATA"` in the body) |

### API key management (admin)

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/api-keys/` | List API keys |
| `POST /api/admin/api-keys/` | Create an API key (the full key is shown once) |
| `GET /api/admin/api-keys/permissions` | Available permission strings |
| `GET /api/admin/api-keys/stats` | Usage stats across all keys |
| `GET /api/admin/api-keys/{api_key_id}` | Get a key's metadata |
| `PUT /api/admin/api-keys/{api_key_id}` | Update name/permissions/expiry/active |
| `DELETE /api/admin/api-keys/{api_key_id}` | Delete a key |
| `POST /api/admin/api-keys/{api_key_id}/regenerate` | Regenerate the secret |
| `GET /api/admin/api-keys/{api_key_id}/stats` | Usage stats for one key |

### Integrations (API-key focused)

| Endpoint | Description |
|----------|-------------|
| `GET /api/integrations/assignments/{assignment_id}` | Assignment details (`assignments:read`) |
| `POST /api/integrations/assignments/{assignment_id}/grade` | Grade an assignment (`assignments:grade`) |

### Paperless-ngx integration

Connection management and attachment writes require an admin session or `paperless:write`. Document-library reads require an admin session or `paperless:read`; student access to document content is limited to material attached to their lessons or assignments. Cached metadata and attachments survive a disconnect.

| Endpoint | Description |
|----------|-------------|
| `POST /api/integrations/paperless/test` | Test server credentials without saving them (`paperless:write`) |
| `POST /api/integrations/paperless/connect` | Validate/store a connection and return `202 {status, job}` for initial sync (`paperless:write`) |
| `GET /api/integrations/paperless/scope-options` | Fetch live tags and document types for configuring sync scope (`paperless:write`) |
| `GET /api/integrations/paperless/status` | Connection status, cached counts, settings, and mappings (`paperless:read`) |
| `PATCH /api/integrations/paperless/settings` | Update sync scope, toggles, and tag/document-type mappings (`paperless:write`) |
| `DELETE /api/integrations/paperless/connection` | Disconnect while retaining cached documents and attachments (`paperless:write`) |
| `POST /api/integrations/paperless/sync` | Return `202` with the new or existing active sync job (`paperless:write`) |
| `GET /api/integrations/paperless/sync-jobs/{job_id}` | Job state, phase, progress, counts, timestamps, and actionable errors (`paperless:read`) |
| `GET /api/integrations/paperless/documents` | Search and filter cached documents; optionally rank for a lesson (`paperless:read`) |
| `GET /api/integrations/paperless/documents/{document_id}` | Document details and lesson/template usage (`paperless:read`) |
| `GET /api/integrations/paperless/documents/{external_id}/thumbnail` | Serve an authenticated cached thumbnail; student attachment checks also apply to conditional requests |
| `GET /api/integrations/paperless/documents/{document_id}/content` | Stream inline or attachment content; student access is attachment-scoped (`paperless:read` or authorized session) |
| `POST /api/integrations/paperless/lessons/{lesson_id}/materials` | Attach a cached document to a lesson (`paperless:write`) |
| `DELETE /api/integrations/paperless/lessons/{lesson_id}/materials/{document_id}` | Detach a document from a lesson (`paperless:write`) |
| `POST /api/integrations/paperless/templates/{template_id}/materials` | Attach a student-visible document to an assignment template (`paperless:write`) |
| `DELETE /api/integrations/paperless/templates/{template_id}/materials/{document_id}` | Detach a document from an assignment template (`paperless:write`) |
| `POST /api/integrations/paperless/student-assignments/{assignment_id}/materials` | Attach a one-off document to a student assignment (`paperless:write`) |
| `DELETE /api/integrations/paperless/student-assignments/{assignment_id}/materials/{document_id}` | Detach a one-off document from a student assignment (`paperless:write`) |

New setup must send `scope_mode: "all"` explicitly, or `scope_mode: "selected"`
with nonempty `scope_tag_ids` and/or `scope_doctype_ids`. The two selected axes
are a union. Credentials are validated with API version 10, falling back to 9
only after `406`; subsequent requests explicitly use the negotiated version.

`connect` accepts an optional existing `library_id` for a moved/restored library.
Without that field, the same normalized server URL reuses its namespace and a
new URL creates a separate namespace. Inactive-library content returns `409`;
missing upstream documents return `404`, missing local permission `403`, and
expired/absent OurSchool authentication `401`. The content proxy forwards one
`Range` and `If-Range`, preserving `206`, `416`, range metadata and filenames.

Settings accept `sync_interval_minutes` (integer 5–1440, default 15). Status
includes `library_id`, saved `libraries`, `cache_available`, `api_version`,
`active_job`, `last_sync_at` (last attempt), `last_success_at`, and `next_sync_at`.
Automatic jobs run without an open browser; disabling auto-import leaves
manual sync available. Credential failures require reconnecting. Config edits
and disconnects fence/cancel older jobs. Jobs use `queued`, `running`, `ok`,
`error`, or `cancelled`; phase reports inventory progress. Transient failures
retry at most three attempts. Completed job history is retained for 30 days.

Cached document pages default to 60 (maximum 500), support `offset`, `q`, repeated
`subject_id` and `kind`, and optional `lesson_id`. Totals count the complete
filtered active library. Keyword terms are combined with AND; title and
correspondent support literal substring matching. Ranking runs over the complete
filtered library, with stable score/title/ID ordering. `match_reasons` replaces
`match_pct`; an empty list means there is no matching evidence. OCR keywords
are excluded from browsing projections.

`GET /api/integrations/paperless/documents/{id}/availability` returns
`{ "available": true, "reason": null }` or a connection/missing-content explanation.
It uses the same student attachment authorization as content access, exposes no
server or credential details, and checks connection configuration rather than
upstream reachability. Unknown documents return `404`; unassigned students `403`.
Document `used_in_count` counts all lesson, template and direct student-work
attachments. Detail includes `used_in`, `used_in_templates`, and
`used_in_assignments` (assignment ID, student name and assignment title).

Atomic batch attachment routes: `POST /api/integrations/paperless/{target}/{id}/materials/batch`,
where target is `lessons`, `templates`, or `student-assignments`. Send
`{"document_ids": [1, 2]}` (1–100 IDs). All IDs must be selectable; validation
failure writes nothing. Existing links are returned without duplication.

Backups include library identities/URLs and namespace all documents, mappings,
and attachment references since format 2.3. Credentials and worker jobs are excluded.
Older backups without library identity restore into an isolated legacy namespace;
explicitly select that library when reconnecting its source. Restoring a backup
cancels active jobs and invalidates published cache counts.

Scope narrowing removes documents from selection, while existing attachments
retain their snapshots and authenticated access through the active library.
Documents belonging to an inactive library return `409` for content and
uncached thumbnails. Missing upstream documents return `404`; local attachment
permission failures return `403`, and absent/revoked sessions return `401`.

### Discovery & monitoring

| Endpoint | Description |
|----------|-------------|
| `GET /` | API name, version, and documentation URL |
| `GET /api/meta` | Assignment types, status enums, and API-key permissions (for MCP/AI clients) |
| `GET /api/activity/recent` | Recent activity feed |
| `GET /api/performance/stats` | API performance statistics (admin) |
| `GET /api/performance/summary` | Performance summary (admin) |
| `GET /api/performance/slow-operations` | Slowest operations (admin) |
| `GET /api/performance/query-heavy-operations` | Most query-heavy operations (admin) |
| `POST /api/performance/reset` | Reset performance counters (admin) |
| `GET /errors/recent` | Recent server errors (admin) |
| `GET /errors/{error_id}` | One error's details (admin) |
| `GET /health` | Liveness check |
| `GET /health/db` | Database connectivity check |

</details>
