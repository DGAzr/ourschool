# Database Migration Guide

OurSchool uses [Alembic](https://alembic.sqlalchemy.org/) for schema migrations.

**Migrations run automatically.** On every container start, `start.sh` waits
for the database and runs `alembic upgrade head` before starting the API — a
normal upgrade (new `IMAGE_TAG`, `docker compose pull`, `up -d`) migrates the
database without any manual steps.

The `v1.0.0` release retains the full migration chain from the alpha and beta
releases. A beta installation can upgrade directly to 1.0 through the normal
container startup process; no intermediate release is required.

> ⚠️ **Back up before upgrading.** A failed migration can leave the database
> in an intermediate state. Take a backup before pulling a new release:
>
> ```bash
> docker compose -f docker-compose.ghcr.yml exec db \
>   pg_dump -U postgres ourschool > backup_$(date +%Y%m%d_%H%M%S).sql
> ```
>
> See "Backup and Restore" in the [deployment guide](deployment.md) for the
> full backup/restore story, including the built-in JSON export.

## Checking migration status

```bash
# Inside the backend container (Docker):
docker compose -f docker-compose.ghcr.yml exec backend alembic current
docker compose -f docker-compose.ghcr.yml exec backend alembic history

# From a source checkout:
python -m alembic current
python -m alembic history
```

`alembic current` should report the same revision as the newest file in
`alembic/versions/` (the head). The authoritative list of revisions and what
each one does is the migration files themselves — each has a docstring
describing its purpose.

## Applying and rolling back

```bash
# Upgrade to latest (normally automatic on container start)
python -m alembic upgrade head

# Upgrade/downgrade to a specific revision
python -m alembic upgrade <revision_id>
python -m alembic downgrade <revision_id>

# Step back one revision
python -m alembic downgrade -1
```

> ⚠️ Some migrations are destructive on downgrade (e.g.
> `remove_lessons_feature` cannot restore dropped lesson data). Downgrading
> is a development tool, not an upgrade-recovery strategy — restore from
> backup instead.

## If a migration fails on upgrade

1. Read the backend logs: `docker compose -f docker-compose.ghcr.yml logs backend`
2. Do **not** retry blindly — note the failing revision in the error output.
3. Restore the pre-upgrade backup, pin `IMAGE_TAG` back to the previous
   release, and start the stack again.
4. Report the failure (see [SECURITY.md](../SECURITY.md) for contact, or open a
   GitHub issue) with the log output and your previous version.

## For contributors: creating migrations

1. Change the SQLAlchemy models in `app/models/`.
2. Generate: `alembic revision --autogenerate -m "description_of_changes"`
   (or `alembic revision -m "..."` for hand-written SQL).
3. **Review the generated file** — autogenerate misses server defaults,
   custom SQL, and can emit destructive operations.
4. Test against a real PostgreSQL: `alembic upgrade head`, then
   `alembic downgrade -1 && alembic upgrade head` to prove reversibility.
5. CI applies the full chain to a fresh database on every PR; a broken chain
   fails the build.

Conventions:
- Filenames are timestamped: `YYYY_MM_DD_HHMM-revision_id_description.py`.
- Use readable revision ids (e.g. `add_icon_to_entities`) rather than hashes.
- Keep the chain linear — one head, no branches.
- New datetime columns must be `DateTime(timezone=True)`; the schema was
  standardized on `timestamptz` in `standardize_timestamptz`.

## Environment integration

The migration environment (`alembic/env.py`):
- Loads the database URL from the same settings/env vars as the application
  (`DATABASE_URL` or the individual `DATABASE_*` vars).
- Imports all application models automatically, so autogenerate sees the
  full schema.

Baseline revision: `74e3c52e185b` (`initial_database_schema`, 2025-08-07).
