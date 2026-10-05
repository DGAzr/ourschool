"""Execute mapping backfill against legacy rows in a disposable SQL schema."""

import importlib.util
from pathlib import Path
import uuid

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text


def test_mapping_migration_preserves_values_and_backfills_configuration(engine):
    path = (
        Path(__file__).parents[1]
        / "alembic/versions/2026_10_05_1200-a5e6f7b8c9d0_paperless_mapping_scope.py"
    )
    spec = importlib.util.spec_from_file_location("mapping_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with engine.connect() as connection, connection.begin() as transaction:
        schema = f"mapping_test_{uuid.uuid4().hex}"
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')
        connection.exec_driver_sql(
            "CREATE TABLE paperless_connection (id integer PRIMARY KEY)"
        )
        connection.exec_driver_sql("INSERT INTO paperless_connection VALUES (1)")
        connection.exec_driver_sql(
            "CREATE TABLE paperless_tag_subject_map (id integer PRIMARY KEY, subject_id integer, auto_matched boolean NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO paperless_tag_subject_map VALUES (1, 42, true), (2, 43, false), (3, NULL, false)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE paperless_doctype_map (id integer PRIMARY KEY, paperless_doctype_name text NOT NULL, material_kind text NOT NULL)"
        )
        connection.exec_driver_sql("""INSERT INTO paperless_doctype_map VALUES
            (1, 'Worksheet', 'worksheet'), (2, 'Unit Test', 'reading'),
            (3, 'Textbook', 'reading'), (4, 'Quiz', 'test'),
            (5, 'Reference', 'reference'), (6, 'Form', 'form'),
            (7, 'Recipe', 'other'), (8, 'Exam Worksheet', 'other')""")
        for _ in range(2):
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
            assert connection.execute(
                text(
                    "SELECT subject_id, auto_matched, configured, in_scope FROM paperless_tag_subject_map ORDER BY id"
                )
            ).all() == [
                (42, True, False, False),
                (43, False, True, False),
                (None, False, True, False),
            ]
            assert connection.execute(
                text(
                    "SELECT material_kind, configured, in_scope FROM paperless_doctype_map ORDER BY id"
                )
            ).all() == [
                ("worksheet", False, False),
                ("reading", True, False),
                ("reading", False, False),
                ("test", False, False),
                ("reference", False, False),
                ("form", False, False),
                ("other", False, False),
                ("other", True, False),
            ]
            assert connection.execute(
                text(
                    "SELECT mapping_scope_tag_ids, mapping_scope_doctype_ids FROM paperless_connection"
                )
            ).one() == (None, None)
            with Operations.context(MigrationContext.configure(connection)):
                migration.downgrade()
        transaction.rollback()
