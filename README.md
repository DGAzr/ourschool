# 🏫 OurSchool

**Homeschool Management System**

OurSchool is a self-hosted homeschool management system for families who take attendance seriously, grade assignments carefully, and really don't want to maintain a pile of spreadsheets. It handles the administrative grind — attendance, subjects, assignments, grading, reports, and a shameless gamification points system — so you can spend more time on the actual teaching.

> **Public beta — `v1.1-beta`**
>
> This beta adds lesson planning, the Points Shop, and Paperless-ngx integration.
> Back up your data before every upgrade and review the [migration guide](docs/migrations.md) for upgrade guidance.


## ✨ Features

- **Multi-user auth** — Separate logins for parents (admin) and students. Program administrators see the whole picture for all students while students get a streamlined view of their own work and progress.
- **Attendance tracking** — Daily records with status and notes. Flexible academic terms (`semester`, `quarter`, `trimester`, or `custom`) that map to your jurisdiction's reporting requirements.
- **Subjects** — Configure subject areas with names, descriptions, and colors. They persist across terms so you're not re-entering them every year.
- **Assignment templates → student assignments** — Create a template once, assign it to one or more students. Inline row grading and bulk-grade support mean less clicking.
- **Lesson planning and Teach** — Plan instruction by exact date, park unfinished ideas in a persistent Lesson Drawer, run each day's lessons from a dedicated Teach module, track preparation, link reusable assignment templates, and give students a My Lessons view of their schedule.
- **Points Shop** — Turn earned points into an optional reward catalog with student goals, redemption history, inventory controls, and an admin fulfillment queue.
- **Paperless-ngx integration** — Connect a self-hosted Paperless-ngx server, sync and search teaching materials, and attach documents to lessons, templates, or individual assignments.
- **Journal** — Teacher and student entries with date tracking, reactions, and threaded replies.
- **Reports** — Performance reports, attendance summaries, assignment completion rates, grade trends, and term report cards. 
- **System backup / restore** — Full export/import with dry-run preview, cross-version compatibility, and stable external IDs for conflict-free entity resolution. Two restore modes: the default merge, or **wipe-and-restore** for true point-in-time recovery (guarded by a typed confirmation; your admin login always survives).
- **Light/dark/system theme** — Synced to your account, so your preference follows you across devices.
- **Integration API** — REST API with Bearer token and API key (`os_` prefix) auth. MCP-ready: `GET /api/meta` for enum/permission discovery. Full endpoint reference below.


### Sharing a device with a student

Click your account name at the bottom of the sidebar and choose **Switch to
Student**. Choose an active student, then enter and confirm a six-digit PIN.
The student can use their normal account and save real work. Every OurSchool
tab sharing that browser session switches together; other devices stay separate.

Use **Return to Parent/Teacher** and enter that PIN to return to your account.
Five incorrect attempts pause PIN entry for five minutes. If you forget the PIN,
sign out and log in normally. Session expiry also signs out; it never unlocks
parent access automatically. This feature controls OurSchool, not the device.

Browser-session upgrades require everyone to log in once. Password changes and
successful backup restores also revoke browser sessions. Sessions and PINs are
excluded from JSON backups; all school work keeps its existing backup support.

## 🚀 Quick Start (Docker — recommended)

Requires Docker Compose 2.20 or later. Pull the official images from GHCR.

```bash
# 1. Grab the compose file and sample env
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/DGAzr/ourschool/main/env.EXAMPLE

# 2. Set up your environment
cp env.EXAMPLE .env
# Edit .env — at minimum, replace SECRET_KEY with a real secret:
#   openssl rand -hex 32

# 3. Launch (includes a bundled PostgreSQL container)
docker compose -f docker-compose.ghcr.yml up -d

# 4. Open the app
open http://localhost:4173
```

That's it. The backend runs migrations and seeds an admin account automatically on first start.

> ⚠️ **Default credentials:** Admin login is `admin` / `admin123` — these are public knowledge and exist only to get you in the door. The app requires you to choose a new password on first login.

> 📌 **External database?** Set `DATABASE_URL` (or `DATABASE_*`) in `.env`, download `docker-compose.external-db.yml`, and add `-f docker-compose.external-db.yml` to every Compose command. Do not enable the `local-db` profile. See the [deployment guide](docs/deployment.md#using-an-external-database).

> 🏷️ **Image tag:** The compose file defaults to `v1.1-beta`. Change `IMAGE_TAG` in `.env` to pin a different release. All published tags: [ghcr.io/dgazr/ourschool-backend](https://github.com/DGAzr/ourschool/pkgs/container/ourschool-backend).


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

### Plan Lessons

![OurSchool Lesson Planner](utils/OS_LessonPlanner.png?raw=true "Lesson Planner")

### Teach Lessons

![OurSchool Lesson Planner Teach View](utils/OS_LessonPlannerTeach.png?raw=true "Lesson Planner Teach View")

### Points Shop / Gamification

![OurSchool Lesson Planner](utils/OS_PointsShop.png?raw=true "Points Shop")


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
# Edit .env — set DATABASE_URL (or DATABASE_* vars) and SECRET_KEY
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

OurSchool exposes a REST API for integrations, automation, and AI/MCP clients. It supports user-session Bearer tokens and scoped `os_` API keys, with server-advertised permissions and enum discovery through `GET /api/meta`.

See the [API integration guide](docs/api.md) for authentication, permissions, examples, and the complete endpoint reference.

## 🧑‍💻 Development


> At this point most of the code in this app has been built with the help of AI (Claude, DeepSeek, and Qwen models have all been used). This is the same type of workflow I use at my job as well and while I think it is great for velocity I understand that some persons have reservations about interacting with projects which use this technology in their development, so I wanted to be clear about it. I'm sharing this project because it has been immensely useful to my family as we navigate our own homeschool journey and I sincerely hope that it may be useful for another family in a similar position. 

### Project documentation

- [Docker setup and operations](docs/deployment.md)
- [API integration reference](docs/api.md)
- [Database upgrades and migrations](docs/migrations.md)
- [Security policy and vulnerability reporting](SECURITY.md)
- [Maintainer release checklist](docs/releasing.md)
- [Release history](CHANGELOG.md)

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
# Production defaults: bundled PostgreSQL, only frontend host port 4173
docker compose up --build -d

# Development: source mounts, Vite HMR, localhost API/database ports
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
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

**End users:** Use `docker-compose.ghcr.yml` (pulls pre-built images from GHCR) as shown in Quick Start above. PostgreSQL starts by default. For external PostgreSQL, also select `docker-compose.external-db.yml` and configure its connection in `.env`.

**Contributors:** Use `docker-compose.yml` (builds from local Dockerfiles). Select `docker-compose.dev.yml` explicitly for development. A user-owned `docker-compose.override.yml` still loads automatically with bare Compose commands; review or move it aside when adopting these presets. Explicit `-f` commands ignore it.

**Networking:** Production publishes only frontend port `${FRONTEND_PORT:-4173}`. Reach the API at `http://localhost:4173/api/...`; route a PaaS such as Coolify to frontend container port 80. Database/API host ports are available only with the development preset and bind to loopback.

**Security checklist before going live:**
- Generate a real `SECRET_KEY` (`openssl rand -hex 32`). The app refuses to start without it.
- Change the default admin password immediately after first login.
- Set strong DB credentials; the default `postgres`/`postgres` is for local dev only.
- Restrict `ALLOWED_ORIGINS` to your actual domain.
- Put a TLS-terminating reverse proxy (nginx, Caddy, Traefik) in front; the bundled frontend doesn't do TLS or rate limiting beyond nginx's static-file defaults.
- Route public traffic through the frontend and TLS proxy; production does not publish backend or database host ports.
- Disable API docs in production if desired: `ENABLE_API_DOCS=false`.


## 📄 License

Licensed under the **GNU Affero General Public License v3 (AGPLv3)**.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
