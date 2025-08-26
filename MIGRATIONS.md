# Database Migration Guide

This document outlines how to use Alembic for database migrations in the OurSchool project.

## Setup Complete ✅

The migration system has been set up with:
- Alembic initialized and configured
- Baseline migration from existing database schema
- Integration with application models and configuration
- Database backup created

## Common Migration Commands

### Check Current Migration Status
```bash
python -m alembic current
```

### View Migration History
```bash
python -m alembic history
```

### Create a New Migration

**Auto-generate from model changes:**
```bash
python -m alembic revision --autogenerate -m "description_of_changes"
```

**Create empty migration for custom SQL:**
```bash
python -m alembic revision -m "description_of_changes"
```

### Apply Migrations

**Upgrade to latest:**
```bash
python -m alembic upgrade head
```

**Upgrade to specific revision:**
```bash
python -m alembic upgrade revision_id
```

### Rollback Migrations

**Downgrade by one revision:**
```bash
python -m alembic downgrade -1
```

**Downgrade to specific revision:**
```bash
python -m alembic downgrade revision_id
```

## Best Practices

### 1. Always Review Auto-Generated Migrations
- Check that the migration captures your intended changes
- Review for any data loss operations
- Test on a copy of production data

### 2. Backup Before Major Changes
```bash
pg_dump "postgresql://user:pass@host/db" > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Model Change Workflow
1. Make changes to SQLAlchemy models
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review the generated migration file
4. Test the migration on development database
5. Apply to production: `alembic upgrade head`

### 4. Data Migration Considerations
- For complex data transformations, create custom migrations
- Use batch operations for large table changes
- Consider downtime requirements for production

## Migration File Structure

```
alembic/
├── versions/
│   └── YYYY_MM_DD_HHMM-revision_id_description.py
├── env.py          # Migration environment configuration
├── script.py.mako  # Migration template
└── README          # Alembic documentation

alembic.ini         # Alembic configuration file
```

## Environment Integration

The migration system is configured to:
- Load database URL from environment variables (`.env` file)
- Import all application models automatically
- Use the same database connection as the application
- Generate timestamped migration filenames

## Baseline Migration

- **Revision ID:** `cd0edd614cc5`
- **Description:** `initial_baseline_from_existing_database`
- **Date:** 2025-08-03
- **Purpose:** Establishes baseline from existing database schema

This baseline includes all tables created by previous manual migration scripts.

## Emergency Procedures

### If Migration Fails
1. Check the error message in the alembic output
2. Rollback to previous working state: `alembic downgrade -1`
3. Fix the issue in the migration file
4. Retry the migration

### Reset Migration History (Development Only)
⚠️ **WARNING: Only use in development environments**

```bash
# Drop alembic version table
psql -d database_url -c "DROP TABLE alembic_version;"

# Re-stamp baseline
python -m alembic stamp cd0edd614cc5
```

## Production Deployment

For production deployments, always:
1. Create a database backup
2. Test migrations on a copy of production data
3. Plan for potential downtime
4. Have a rollback plan ready
5. Monitor the migration process

---

*Migration system established: August 2025*
*Baseline revision: cd0edd614cc5*