# Roadmap

Work deliberately deferred until after the 1.0 release, in rough priority
order. These items make up the backlog for 1.x.

## Code health

The code-health backlog is clear as of 2026-07-20: module splits, `any`
elimination, full lint/format CI gating for both backend and frontend, knip
clean, and the react-hooks compiler-suite warnings burned down with the
rules enforced at `error`.

## Features under consideration

- **Automated backup scheduling** in-app, replacing the documented host-cron
  approach (README.Docker.md "Back up on a schedule"). Deliberately left to
  the API + external schedulers for now.

## Known limitations (accepted for 1.x)

- The in-memory login rate-limit and error store reset on restart and don't
  span multiple workers (fine for single-family scale).
- Backup export omits password hashes by design; a restore (including
  wipe-and-restore) requires password resets for every user except the
  importing admin, whose account and credentials are preserved.
- JWT is stored in localStorage (XSS-readable). Mitigated by rehype-sanitize
  on all markdown rendering and the strict CSP headers; revisit if the threat
  model changes (e.g., a hosted multi-tenant offering).
- `activity.py` uses the server-local date for "today"; the server timezone
  should match the family's.
