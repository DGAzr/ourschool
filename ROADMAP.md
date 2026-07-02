# Roadmap

Work deliberately deferred from the 1.0 release, in rough priority order.
None of these block tagging `v1.0.0` (see [RELEASING.md](RELEASING.md) for the
release procedure); they're the backlog for 1.x.

## Code health

- **Split the two oversized backend modules**: `app/routers/assignments.py`
  (~1,600 lines: templates + student assignments + grading + bulk-grade) and
  `app/crud/reports.py` (~1,500 lines). Mechanical extraction, but touch it
  with test coverage in place (grading/report tests now exist).
- **Frontend type-safety burn-down**: ~90 `any` usages remain (top offenders:
  `services/terms.ts`, `types/reports.ts`, `services/assignments.ts`,
  import/export modals, `Admin.tsx`). Re-tighten the eslint rules currently
  downgraded to `warn` in `frontend/eslint.config.js` (react-hooks suite +
  `no-explicit-any`) once the count is near zero.
- **Make lint/format blocking in CI**: `ruff`/`black`/`vulture` (backend) and
  `lint`/`knip` (frontend) run with `continue-on-error: true` in
  `.github/workflows/ci.yml`. Clean up the pre-existing debt, then flip them
  to gating.
- Hoist the function-local imports scattered through hot paths
  (`assignments.py`, `integrations.py`, `main.py`).

## UX polish

- **Empty states** for Grading, MyPoints, AdminSettings, and AdminBackup
  (Attendance/Journal/Dashboard already handle empties).
- **Server-side theme persistence**: `ThemeContext` persists to localStorage
  only; needs a user-preferences endpoint on the backend first.

## Features under consideration

- **Wipe-and-restore backup mode**: the importer is merge-only by design
  (documented in `app/routers/backup/importers.py`). A truncate-before-import
  option with a strong confirmation UI would give true point-in-time restore
  semantics.
- **Automated backup scheduling** in-app, replacing the documented host-cron
  approach (README.Docker.md "Back up on a schedule").

## Known limitations (accepted for 1.x)

- The in-memory login rate-limit and error store reset on restart and don't
  span multiple workers (fine for single-family scale).
- Backup export omits password hashes by design; a full restore onto a fresh
  database requires password resets.
- JWT is stored in localStorage (XSS-readable). Mitigated by rehype-sanitize
  on all markdown rendering and the strict CSP headers; revisit if the threat
  model changes (e.g., a hosted multi-tenant offering).
- `activity.py` uses the server-local date for "today"; the server timezone
  should match the family's.
