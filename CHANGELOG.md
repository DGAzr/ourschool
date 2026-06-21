# Changelog

All notable changes to OurSchool are documented here.

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
