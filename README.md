# 🏫 OurSchool

**Homeschool Management System**

OurSchool is a self-hosted homeschool management system for families who take attendance seriously, grade assignments carefully, and really don't want to maintain a pile of spreadsheets. It handles the administrative grind — attendance, subjects, assignments, grading, reports, and a shameless gamification points system — so you can spend more time on the actual teaching.

> **Beta — `v1.0.0-beta.10`**  
> Pre-stable software. The database schema may have breaking changes until the planned 2026–2027 stable release. Use the built-in system backup/restore (with dry-run preview) to safeguard your data between updates.


## ✨ Features

- **Multi-user auth** — Separate logins for parents (admin) and students. Program administrators see the whole picture for all students while students get a streamlined view of their own work and progress.
- **Attendance tracking** — Daily records with status and notes. Flexible academic terms (`semester`, `quarter`, `trimester`, or `custom`) that map to your jurisdiction's reporting requirements.
- **Subjects** — Configure subject areas with names, descriptions, and colors. They persist across terms so you're not re-entering them every year.
- **Assignment templates → student assignments** — Create a template once, assign it to one or more students. Inline row grading and bulk-grade support mean less clicking.
- **Optional gamification** — As assignments are graded, students earn points redeemable for whatever your household considers a reward. The whole system is opt-in and can be toggled off in Admin Center.
- **Journal** — Teacher and student entries with date tracking, reactions, and threaded replies.
- **Reports** — Performance reports, attendance summaries, assignment completion rates, grade trends, and term report cards. 
- **System backup / restore** — Full export/import with dry-run preview, cross-version compatibility (hopefully...), and stable external IDs for conflict-free entity resolution. Two restore modes: the default merge, or **wipe-and-restore** for true point-in-time recovery (guarded by a typed confirmation; your admin login always survives).
- **Light/dark/system theme** — Synced to your account, so your preference follows you across devices.
- **Integration API** — REST API with Bearer token and API key (`os_` prefix) auth. MCP-ready: `GET /api/meta` for enum/permission discovery. Full endpoint reference below.


## 🚀 Quick Start (Docker — recommended)

The fastest path. Just yoink the official images from GHCR.

```bash
# 1. Grab the compose file and sample env
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/env.EXAMPLE

# 2. Set up your environment
cp env.EXAMPLE .env
# Edit .env — at minimum, replace SECRET_KEY with a real secret:
#   openssl rand -hex 32

# 3. Launch (includes a bundled PostgreSQL container)
docker compose -f docker-compose.ghcr.yml --profile local-db up -d

# 4. Open the app
open http://localhost:4173
```

That's it. The backend runs migrations and seeds an admin account automatically on first start.

> ⚠️ **Default credentials:** Admin login is `admin` / `admin123` — these are public knowledge and exist only to get you in the door. The app requires you to choose a new password on first login.

> 📌 **External database?** Skip `--profile local-db` and set `DATABASE_URL` in `.env` instead.

> 🏷️ **Image tag:** The compose file defaults to the release it shipped with. Change `IMAGE_TAG` in `.env` to pin a different release. All published tags: [ghcr.io/dgazr/ourschool-backend](https://github.com/DGAzr/ourschool/pkgs/container/ourschool-backend).


## 📸 Screenshots

### Administrator Dashboard

![OurSchool Admin Dashboard](/utils/OS_Dashboard.png?raw=true "Administrator Dashboard")

### Administrator Assignment Definitions

![OurSchool Assignment Library](/utils/OS_Assignments.png?raw=true "Assignment Library")

### Assign things to Students

![OurSchool Assign to Students](/utils/OS_Assign.png?raw=true "Assign to Students")

### Take Attendance

![OurSchool Attendance](/utils/OS_Attendance.png?raw=true "Attendance")

### Grade Stuff

![OurSchool Grading Desk](/utils/OS_Grading.png?raw=true "Grading Desk")


## ☕ Buy me a coffee

If OurSchool saves you time and/or a mild argument with your spreadsheet, I'd appreciate it!

[![BuyMeACoffee](https://raw.githubusercontent.com/pachadotdev/buymeacoffee-badges/main/bmc-yellow.svg)](https://buymeacoffee.com/cyzfcykbd)


## 🛠️ Manual Setup (from source)

For contributors or anyone who wants to run the app without Docker.

### Prerequisites

- Python **3.11+**
- Node.js **20+**
- PostgreSQL

### Backend

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp env.EXAMPLE .env
# Edit .env — set DATABASE_URL (or POSTGRES_* vars) and SECRET_KEY
# Generate a strong SECRET_KEY: openssl rand -hex 32

# Run migrations
alembic upgrade head

# Seed the initial admin account
python seed_data.py
# Admin login: admin / admin123 (change it!)
# Add --full for demo students, subjects, terms, and sample assignments

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is available at:

| Service | URL |
|---------|-----|
| Frontend (dev) | http://localhost:4173 |
| API | http://localhost:8000 |
| API docs (opt-in) | http://localhost:8000/docs |

> Interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are **disabled by default**; set `ENABLE_API_DOCS=true` in `.env` to expose them.


## 🔌 API Integration

OurSchool has a REST API for external integrations — handy for AI tools, automation, or a second screen that shows grades without navigating the UI.

### Authentication

**User session (Bearer token)**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
# Returns a JWT — use as: Authorization: Bearer <token>
```

**API key** (create under Admin → API Keys)
```bash
curl -H "X-API-Key: os_YOUR_KEY_HERE" \
  http://localhost:8000/api/points/admin/overview
```

Every endpoint accepts a Bearer token. Endpoints in the assignments, attendance, points, users-lookup, and integrations groups also accept an API key carrying the matching permission; everything else (users admin, backup, settings, API-key management, …) is session-only.

### API Key Permissions

| Permission | What it grants |
|------------|----------------|
| `students:read` | Look up students (`/api/users/students/lookup`, `/api/users/students/{id}/info`) |
| `assignments:read` | Read templates, assignments, and student progress |
| `assignments:write` | Create/update templates; assign templates to students |
| `assignments:grade` | Grade student assignments |
| `attendance:read` | Read attendance records |
| `attendance:write` | Create/update/delete attendance records (incl. bulk) |
| `points:read` | Read student points balances and transaction history |
| `points:write` | Adjust student points |

### MCP / enum discovery

```bash
GET /api/meta
```
Returns all active assignment types, assignment status enum values, and available API key permissions. Useful for AI/MCP clients that need to enumerate valid values before taking action.

### Quick example — grade an assignment

```bash
curl -X POST "http://localhost:8000/api/integrations/assignments/123/grade" \
  -H "X-API-Key: os_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"points_earned": 85.0, "teacher_feedback": "Nice work!", "letter_grade": "B+"}'
```

### Python snippet

```python
import requests, os

API_KEY = os.getenv("OURSCHOOL_API_KEY")
headers = {"X-API-Key": API_KEY}

r = requests.get("http://localhost:8000/api/points/admin/overview", headers=headers)
for student in r.json()["student_points"]:
    print(f"{student['student_name']}: {student['current_balance']} pts")
```

### Endpoint reference

The complete API surface as of `v1.0.0-beta.10`. Set `ENABLE_API_DOCS=true` for the interactive version (request/response schemas included) at `/docs`.

<details>
<summary><strong>Expand the full endpoint list</strong></summary>

#### Auth

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Log in (form fields `username`, `password`); returns a JWT |
| `POST /api/auth/extend-session` | Exchange a valid token for a fresh one |

#### Users

| Endpoint | Description |
|----------|-------------|
| `GET /api/users/` | List all users (admin) |
| `POST /api/users/` | Create a user (admin); the very first user can be created unauthenticated to bootstrap the system |
| `GET /api/users/me` | Current user profile |
| `PUT /api/users/me` | Update own profile (name, email, username, theme preference) |
| `POST /api/users/me/change-password` | Change own password |
| `GET /api/users/students` | List all students (admin) |
| `GET /api/users/students/lookup` | Lightweight student lookup (`students:read`) |
| `GET /api/users/students/{student_id}/info` | Student details (`students:read`) |
| `GET /api/users/{user_id}` | Get a user |
| `PUT /api/users/{user_id}` | Update a user (admins: any field; students: own profile fields) |
| `DELETE /api/users/{user_id}` | Delete a user (admin) |
| `POST /api/users/{user_id}/reset-password` | Issue a temporary password that must be rotated on next login (admin) |

#### Subjects

| Endpoint | Description |
|----------|-------------|
| `GET /api/subjects/` | List subjects |
| `POST /api/subjects/` | Create a subject (admin) |
| `PUT /api/subjects/{subject_id}` | Update a subject (admin) |
| `DELETE /api/subjects/{subject_id}` | Delete a subject (admin) |

#### Terms

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

#### Assignment types

| Endpoint | Description |
|----------|-------------|
| `GET /api/assignment-types/` | List assignment types (with grade-book weights, icons, colors) |
| `POST /api/assignment-types/` | Create an assignment type (admin) |
| `PUT /api/assignment-types/{type_id}` | Update an assignment type (admin) |
| `DELETE /api/assignment-types/{type_id}` | Delete an assignment type (admin) |

#### Assignment templates

| Endpoint | Description |
|----------|-------------|
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

#### Student assignments & grading

| Endpoint | Description |
|----------|-------------|
| `POST /api/assignments/assign` | Assign a template to one or more students (`assignments:write`) |
| `GET /api/assignments/all-assignments` | All student assignments, filterable — the grading queue (`assignments:read`) |
| `GET /api/assignments/submitted` | Assignments awaiting a grade |
| `POST /api/assignments/bulk-grade` | Grade many assignments in one call |
| `GET /api/assignments/dashboard/overview` | Admin dashboard rollup |
| `GET /api/assignments/my-assignments` | Current student's assignments |
| `GET /api/assignments/my-term-grades` | Current student's term grades |
| `GET /api/assignments/student-assignments/{id}` | Get one student assignment |
| `PUT /api/assignments/student-assignments/{id}` | Update (students: submission fields only) |
| `DELETE /api/assignments/student-assignments/{id}` | Delete a student assignment (admin) |
| `POST /api/assignments/student-assignments/{id}/start` | Mark in-progress (student) |
| `POST /api/assignments/student-assignments/{id}/complete` | Submit for grading (student) |
| `POST /api/assignments/student-assignments/{id}/grade` | Grade it (admin) |
| `POST /api/assignments/student-assignments/{id}/archive` | Archive it (admin) |
| `GET /api/assignments/students/{student_id}/assignments` | A student's assignments (admin) |
| `GET /api/assignments/students/{student_id}/progress` | A student's progress summary (`assignments:read`) |
| `GET /api/assignments/student-term-grades/{student_id}` | A student's term grades (admin) |

#### Attendance

| Endpoint | Description |
|----------|-------------|
| `GET /api/attendance/` | List attendance records, filterable by student/date range (`attendance:read`) |
| `POST /api/attendance/` | Record attendance for one student (`attendance:write`) |
| `POST /api/attendance/bulk` | Record attendance for many students at once (`attendance:write`) |
| `GET /api/attendance/students` | Students available for attendance (`attendance:read`) |
| `PUT /api/attendance/{record_id}` | Update a record (`attendance:write`) |
| `DELETE /api/attendance/{record_id}` | Delete a record (`attendance:write`) |

#### Journal

| Endpoint | Description |
|----------|-------------|
| `GET /api/journal/entries` | List journal entries (admins see all; students see their own) |
| `POST /api/journal/entries` | Create an entry |
| `GET /api/journal/entries/{entry_id}` | Get an entry |
| `PUT /api/journal/entries/{entry_id}` | Update an entry |
| `DELETE /api/journal/entries/{entry_id}` | Delete an entry |
| `POST /api/journal/entries/{entry_id}/mark-read` | Mark an entry read |
| `POST /api/journal/entries/{entry_id}/reactions` | Set reactions on an entry |
| `POST /api/journal/entries/{entry_id}/replies` | Reply to an entry |
| `DELETE /api/journal/replies/{reply_id}` | Delete a reply |
| `GET /api/journal/students` | Students available for journal filters (admin) |
| `GET /api/journal/composer-data` | Prefill data for the entry composer |

#### Points

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

#### Reports

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

#### Settings (admin)

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

#### Backup & restore (admin)

| Endpoint | Description |
|----------|-------------|
| `GET /api/backup/export` | Full system export as JSON (password hashes excluded) |
| `POST /api/backup/import` | Import a backup. Options: `dry_run`, `skip_existing_users`, `update_existing_data`, `allow_admin_import`, and `wipe_before_import` (requires `wipe_confirmation: "WIPE ALL DATA"` in the body) |

#### API key management (admin)

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

#### Integrations (API-key focused)

| Endpoint | Description |
|----------|-------------|
| `GET /api/integrations/assignments/{assignment_id}` | Assignment details (`assignments:read`) |
| `POST /api/integrations/assignments/{assignment_id}/grade` | Grade an assignment (`assignments:grade`) |

#### Discovery & monitoring

| Endpoint | Description |
|----------|-------------|
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


## 🧑‍💻 Development


> At this point most of the code in this app has been built with the help of AI (Claude, DeepSeek, and Qwen models have all been used). This is the same type of workflow I use at my job as well and while I think it is great for velocity I understand that some persons have reservations about interacting with projects which use this technology in their development, so I wanted to be clear about it. I'm sharing this project because it has been immensely useful to my family as we navigate our own homeschool journey and I sincerely hope that it may be useful for another family in a similar position. 

### Database migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

### Tests

Backend (pytest + httpx — set `DATABASE_URL` and `SECRET_KEY` first):
```bash
pytest
```

Frontend checks:
```bash
cd frontend
npx tsc --noEmit   # type-check
npm run lint        # lint
npm run build       # production build
npm run knip        # unused exports / dead code
```

### Build from source (Docker)

Contributors can build and run locally using the base compose file:
```bash
# Dev mode (live-reload via docker-compose.override.yml, auto-merged):
docker compose up --build

# Production-style build (ignores the dev override):
docker compose -f docker-compose.yml up --build -d
```


## 🏗️ Tech Stack

### Backend
| | |
|---|---|
| **FastAPI** 0.138 | Web framework |
| **SQLAlchemy** 2.0 + psycopg3 | ORM + PostgreSQL driver |
| **Alembic** 1.18 | Database migrations |
| **Pydantic** 2.13 | Data validation |
| **python-jose** + **bcrypt** 5 | JWT auth + password hashing |

### Frontend
| | |
|---|---|
| **React** 19 | UI |
| **TypeScript** 6 | Type safety |
| **Tailwind CSS** 4 | Styling |
| **React Router** 7 | Routing |
| **TanStack Query** 5 | Server state |
| **Vite** 8 | Build tool |
| **lucide-react** | Icons |
| **date-fns** | Date formatting |
| **react-markdown** | Markdown rendering (journal) |


## 🐳 Deployment

**End users:** Use `docker-compose.ghcr.yml` (pulls pre-built images from GHCR) as shown in Quick Start above. The `--profile local-db` flag adds a bundled Postgres container; omit it and set `DATABASE_URL` for an external database.

**Contributors:** Use `docker-compose.yml` (builds from local Dockerfiles). The `docker-compose.override.yml` is merged automatically for live-reload dev mode.

**Security checklist before going live:**
- Generate a real `SECRET_KEY` (`openssl rand -hex 32`). The app refuses to start without it.
- Change the default admin password immediately after first login.
- Set strong DB credentials; the default `postgres`/`postgres` is for local dev only.
- Restrict `ALLOWED_ORIGINS` to your actual domain.
- Put a TLS-terminating reverse proxy (nginx, Caddy, Traefik) in front; the bundled frontend doesn't do TLS or rate limiting.
- Set `BACKEND_BIND=0.0.0.0` only when behind such a proxy (default is loopback).
- Disable API docs in production if desired: `ENABLE_API_DOCS=false`.


## 📄 License

Licensed under the **GNU Affero General Public License v3 (AGPLv3)**.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
