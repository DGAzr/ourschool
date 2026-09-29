"""Measure shipping paged reads against a fresh, migrated disposable database.

Uses the fixed localhost assignment_perf database from benchmark_assignment_reads;
refuses to seed a database containing users. Run Alembic there first. The JSON
output is separate from the original baseline and contains synthetic data only.
"""

import gc
import inspect
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import benchmark_assignment_reads as seed
from fastapi.encoders import jsonable_encoder
from fastapi.params import Param
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from app.routers.assignments.pages import assignment_page, template_page
from app.routers.assignments.analytics import get_assignment_dashboard
from app.crud.assignment_report_pages import report_page
from app.models.paperless import (
    PaperlessDocument,
    TemplatePaperlessMaterial,
    StudentAssignmentPaperlessMaterial,
)

engine = seed.engine
out = {
    "method": "Actual route functions plus FastAPI-compatible JSON encoding; 5 samples after warmup; no HTTP/auth/browser",
    "schema": "Alembic head on PostgreSQL 15; disposable disk-backed database",
    "baseline": "assignment-performance-2026-09-28-evidence.json",
    "measurements": [],
    "concurrency": [],
    "plans": {},
}


def invoke(fn, db, **kwargs):
    args = {}
    for name, parameter in inspect.signature(fn).parameters.items():
        default = parameter.default
        if default is not inspect.Parameter.empty:
            args[name] = default.default if isinstance(default, Param) else default
    args.update(db=db, **kwargs)
    return fn(**args)


def timed(fn):
    start = time.perf_counter()
    with Session(engine) as db:
        value = fn(db)
        payload = JSONResponse(jsonable_encoder(value)).body
    return dict(
        ms=(time.perf_counter() - start) * 1000,
        bytes=len(payload),
        rows=len(value.get("items", [])),
        total=value.get("total"),
    )


def measure(name, size, fn):
    timed(fn)
    samples = []
    for _ in range(5):
        gc.collect()
        seed.counter.update(count=0, execute_ms=0)
        sample = timed(fn)
        sample["sql_count"] = seed.counter["count"]
        samples.append(sample)
    row = dict(
        name=name,
        stored_assignments=size,
        median_ms=statistics.median(s["ms"] for s in samples),
        json_bytes=samples[0]["bytes"],
        rows=samples[0]["rows"],
        total=samples[0]["total"],
        sql_count=samples[0]["sql_count"],
        samples=samples,
    )
    out["measurements"].append(row)
    print(json.dumps({k: v for k, v in row.items() if k != "samples"}), flush=True)


def add_materials():
    with engine.begin() as conn:
        conn.execute(
            PaperlessDocument.__table__.insert(),
            [
                dict(
                    id=i,
                    paperless_id=i,
                    title=f"Material {i}",
                    keywords="keyword " * 1000,
                )
                for i in range(1, 101)
            ],
        )
        conn.execute(
            TemplatePaperlessMaterial.__table__.insert(),
            [
                dict(
                    template_id=i, document_id=(i % 100) + 1, title="Synthetic material"
                )
                for i in range(1, 1001)
            ],
        )
        conn.execute(
            StudentAssignmentPaperlessMaterial.__table__.insert(),
            [
                dict(
                    student_assignment_id=i,
                    document_id=(i % 100) + 1,
                    title="Instance material",
                )
                for i in range(1, 1001)
            ],
        )
        conn.execute(text("ANALYZE"))


def save():
    Path("docs/assignment-performance-2026-09-28-after.json").write_text(
        json.dumps(out, indent=2) + "\n"
    )


def main():
    with engine.begin() as conn:
        assert (
            conn.execute(text("SELECT current_database()")).scalar_one()
            == "assignment_perf"
        )
        assert (
            conn.execute(text("SELECT count(*) FROM users")).scalar_one() == 0
        ), "Use an empty disposable database"
        assert (
            conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
            == "d9e0f1a2b3c4"
        )
        out["postgres"] = conn.execute(text("SELECT version()")).scalar_one()
        conn.execute(
            seed.User.__table__.insert(),
            [
                dict(
                    id=i,
                    username=f"synthetic{i}",
                    email=f"synthetic{i}@test.invalid",
                    first_name="Synthetic",
                    last_name=str(i),
                    hashed_password="unused",
                    role="admin" if i == 1 else "student",
                )
                for i in range(1, 12)
            ],
        )
        conn.execute(
            seed.Subject.__table__.insert(),
            [dict(id=i, name=f"Subject {i}") for i in range(1, 6)],
        )

    def admin_page(db):
        return invoke(assignment_page, db, auth_user=seed.admin)

    previous = 0
    for size in (1000, 10000, 100000, 1000000):
        print(f"Seeding {size:,} assignments", flush=True)
        seed.seed(previous, size)
        previous = size
        measure("admin_page_50", size, admin_page)
        measure(
            "student_page_50",
            size,
            lambda db: invoke(assignment_page, db, auth_user=seed.student, tab="todo"),
        )
        measure(
            "template_page_50",
            size,
            lambda db: invoke(template_page, db, auth_user=seed.admin),
        )
        measure(
            "template_search",
            size,
            lambda db: invoke(
                template_page, db, auth_user=seed.admin, search="Template 99"
            ),
        )
        measure("dashboard", size, lambda db: get_assignment_dashboard(db, seed.admin))
        measure("report_page_50", size, lambda db: report_page(db))
        if size == 100000:
            add_materials()
            measure("admin_page_with_materials", size, admin_page)
            for concurrency in (1, 5, 20):
                start = time.perf_counter()
                with ThreadPoolExecutor(max_workers=concurrency) as pool:
                    samples = list(
                        pool.map(
                            lambda _: timed(admin_page), range(max(10, concurrency * 2))
                        )
                    )
                ordered = sorted(s["ms"] for s in samples)
                record = dict(
                    concurrency=concurrency,
                    stored_assignments=size,
                    requests=len(samples),
                    median_ms=statistics.median(ordered),
                    p95_ms=ordered[__import__("math").ceil(len(ordered) * 0.95) - 1],
                    wall_seconds=time.perf_counter() - start,
                )
                out["concurrency"].append(record)
                print(json.dumps(record), flush=True)
        save()
    with engine.connect() as conn:
        for name, query in {
            "global_page": "SELECT a.id,a.due_date,t.name FROM student_assignments a JOIN assignment_templates t ON t.id=a.template_id JOIN users u ON u.id=a.student_id WHERE u.role='student' ORDER BY a.due_date ASC NULLS LAST,a.id LIMIT 50",
            "student_page": "SELECT id FROM student_assignments WHERE student_id=2 ORDER BY coalesce(extended_due_date,due_date) ASC NULLS LAST,id LIMIT 50",
            "template_search": "SELECT id FROM assignment_templates WHERE NOT is_archived AND is_library AND (name ILIKE '%Template 99999%' OR description ILIKE '%Template 99999%') ORDER BY lower(name),id LIMIT 50",
        }.items():
            out["plans"][name] = conn.execute(
                text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query)
            ).scalar_one()
        # Explicit generic plans cover prepared parameter use, not just literals.
        conn.execute(text("SET LOCAL plan_cache_mode = force_generic_plan"))
        conn.execute(
            text(
                "PREPARE perf_student(integer) AS SELECT id FROM student_assignments "
                "WHERE student_id=$1 ORDER BY coalesce(extended_due_date,due_date) "
                "ASC NULLS LAST,id LIMIT 50"
            )
        )
        conn.execute(
            text(
                "PREPARE perf_submitted(assignmentstatus) AS SELECT id FROM student_assignments "
                "WHERE status=$1 ORDER BY due_date ASC NULLS LAST,id LIMIT 50"
            )
        )
        for name, execution in {
            "prepared_student": "EXECUTE perf_student(2)",
            "prepared_submitted": "EXECUTE perf_submitted('submitted')",
        }.items():
            out["plans"][name] = conn.execute(
                text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + execution)
            ).scalar_one()
        out["index_sizes"] = [
            dict(r._mapping)
            for r in conn.execute(
                text(
                    "SELECT indexrelname,pg_relation_size(indexrelid) bytes FROM pg_stat_user_indexes WHERE indexrelname LIKE 'idx_sa_%' OR indexrelname LIKE 'idx_at_%' ORDER BY indexrelname"
                )
            )
        ]
    save()
    engine.dispose()


if __name__ == "__main__":
    main()
