# Roadmap

Work deliberately deferred from the 1.0 release, in rough priority order.
None of these block tagging `v1.0.0` (see [RELEASING.md](RELEASING.md) for the
release procedure); they're the backlog for 1.x.

## Code health

Most of the original code-health backlog shipped on 2026-07-02 (module
splits, `any` elimination with `no-explicit-any` at error, full lint/format
CI gating for both backend and frontend, knip clean). What remains:

- **React-hooks compiler-suite warnings**: 39 warnings across
  `set-state-in-effect` (23), `immutability` (7), `only-export-components`
  (5), and singles (`static-components`, `purity`, `refs`,
  `preserve-manual-memoization`). These rules stay at `warn` in
  `frontend/eslint.config.js` because fixing them means real component
  refactors with regression risk. Burn down file by file, then flip the
  rules to `error`.

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
