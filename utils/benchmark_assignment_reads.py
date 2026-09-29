"""Synthetic assignment read benchmark; never uses the application's DB URL.

Run from repo root with .venv/bin/python utils/benchmark_assignment_reads.py.
Requires a disposable PostgreSQL database named assignment_perf on local port
55439 (see the accompanying review). Creates and removes its own unique schema.
Measures route functions + response validation/JSON, not HTTP/auth/browser time.
"""

import gc
import json
import os
import platform
import statistics
import sys
import time
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["SECRET_KEY"] = "synthetic-performance-benchmark-only"
os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://postgres:benchmark-only@127.0.0.1:55439/assignment_perf"
)

from pydantic import TypeAdapter  # noqa: E402
from sqlalchemy import create_engine, event, func, text  # noqa: E402
from sqlalchemy.orm import Session, joinedload  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.database import Base  # noqa: E402
from app.enums import AssignmentStatus, UserRole  # noqa: E402
from app.models.assignment import (
    AssignmentTemplate as T,
    StudentAssignment as A,
)  # noqa: E402
from app.models.subject import Subject  # noqa: E402
from app.models.user import User  # noqa: E402
from app.routers.assignments.analytics import get_assignment_dashboard  # noqa: E402
from app.routers.assignments.grading import (
    get_all_assignments_for_grading,
)  # noqa: E402
from app.routers.assignments.student_assignments import get_my_assignments  # noqa: E402
from app.routers.assignments.templates import get_assignment_templates  # noqa: E402
from app.schemas.assignment import (  # noqa: E402
    AssignmentTemplateResponse,
    StudentAssignmentResponse,
)

SCHEMA = "perf_" + uuid.uuid4().hex
URL = os.environ["DATABASE_URL"]
control = create_engine(URL)
engine = create_engine(URL, connect_args={"options": f"-csearch_path={SCHEMA},public"})
admin = User(id=1, role=UserRole.ADMIN)
student = User(id=2, role=UserRole.STUDENT)
assignment_adapter = TypeAdapter(list[StudentAssignmentResponse])
template_adapter = TypeAdapter(list[AssignmentTemplateResponse])
any_adapter = TypeAdapter(dict)
counter = {"count": 0, "execute_ms": 0.0}
evidence = {
    "method": "3 measured repetitions after 1 warmup, fresh Session per call",
    "platform": platform.platform(),
    "schema_source": "current SQLAlchemy metadata, not Alembic migration replay",
    "students": 10,
    "description_chars": 256,
    "instructions_chars": 1024,
    "attachments": 0,
    "measurements": [],
    "plans": {},
}


@event.listens_for(engine, "before_cursor_execute")
def before_execute(conn, cursor, statement, parameters, context, executemany):
    context.perf_start = time.perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def after_execute(conn, cursor, statement, parameters, context, executemany):
    counter["count"] += 1
    counter["execute_ms"] += (time.perf_counter() - context.perf_start) * 1000


def measure(label, size, fn, adapter):
    samples = []
    for iteration in range(4):
        gc.collect()
        with Session(engine) as db:
            counter.update(count=0, execute_ms=0.0)
            start = time.perf_counter()
            result = fn(db)
            queried = time.perf_counter()
            validated = adapter.validate_python(result, from_attributes=True)
            payload = adapter.dump_json(validated)
            end = time.perf_counter()
            sample = {
                "total_ms": (end - start) * 1000,
                "route_ms": (queried - start) * 1000,
                "serialization_ms": (end - queried) * 1000,
                "cursor_execute_ms": counter["execute_ms"],
                "sql_count": counter["count"],
                "rows": len(result),
                "json_bytes": len(payload),
            }
        del result, validated, payload
        if iteration:
            samples.append(sample)
    row = {"label": label, "assignment_rows_in_database": size}
    row.update(
        {k: round(statistics.median(s[k] for s in samples), 3) for k in samples[0]}
    )
    row["samples"] = samples
    evidence["measurements"].append(row)
    print(json.dumps({k: v for k, v in row.items() if k != "samples"}), flush=True)


def templates(db, limit=100):
    return get_assignment_templates(
        db,
        admin,
        subject_id=None,
        search=None,
        include_archived=False,
        include_one_offs=False,
        skip=0,
        limit=limit,
    )


def grouped_templates(db, limit=100):
    """Experimental replacement for per-template stats; does not change app code."""
    rows = (
        db.query(T)
        .options(joinedload(T.subject), joinedload(T.creator))
        .filter(T.is_archived.is_(False), T.is_library.is_(True))
        .limit(limit)
        .all()
    )
    active = [
        AssignmentStatus.NOT_STARTED,
        AssignmentStatus.IN_PROGRESS,
        AssignmentStatus.OVERDUE,
        AssignmentStatus.SUBMITTED,
    ]
    stats = (
        db.query(
            A.template_id,
            func.count(A.id),
            func.count(A.id).filter(A.status.in_(active)),
            func.avg(A.percentage_grade).filter(A.is_graded),
        )
        .filter(A.template_id.in_([t.id for t in rows]))
        .group_by(A.template_id)
        .all()
    )
    by_id = {r[0]: r[1:] for r in stats}
    for template in rows:
        total, active_count, avg = by_id.get(template.id, (0, 0, None))
        template.total_assigned = total
        template.active_assigned = active_count
        template.average_grade = float(avg) if avg is not None else None
    return rows


def slim_page(db):
    return [
        dict(r._mapping)
        for r in db.query(
            A.id,
            A.student_id,
            A.template_id,
            A.assigned_date,
            A.due_date,
            A.status,
            A.is_graded,
            A.percentage_grade,
            T.name,
            T.subject_id,
        )
        .join(T)
        .order_by(A.assigned_date.desc(), A.id.desc())
        .limit(50)
        .all()
    ]


def seed(previous, size):
    with engine.begin() as conn:
        conn.execute(
            T.__table__.insert(),
            [
                dict(
                    id=i,
                    name=f"Template {i}",
                    description="d" * 256,
                    instructions="i" * 1024,
                    subject_id=(i % 5) + 1,
                    created_by=1,
                )
                for i in range(previous // 10 + 1, size // 10 + 1)
            ],
        )
        for start in range(previous + 1, size + 1, 5000):
            assignments = []
            for i in range(start, min(start + 5000, size + 1)):
                bucket = ((i - 1) // 10) % 20
                status = (
                    "graded"
                    if bucket < 16
                    else (
                        "not_started"
                        if bucket < 18
                        else "submitted" if bucket == 18 else "excused"
                    )
                )
                work_date = date(2026, 9, 28) - timedelta(days=((i - 1) // 10) % 730)
                assignments.append(
                    dict(
                        id=i,
                        template_id=(i - 1) // 10 + 1,
                        student_id=(i - 1) % 10 + 2,
                        assigned_date=work_date,
                        due_date=work_date + timedelta(days=7),
                        status=status,
                        is_graded=status == "graded",
                        assigned_by=1,
                        points_earned=85 if status == "graded" else None,
                        percentage_grade=85 if status == "graded" else None,
                        submitted_date=(
                            work_date if status in ("graded", "submitted") else None
                        ),
                    )
                )
            conn.execute(A.__table__.insert(), assignments)
        conn.execute(text("ANALYZE"))


def explain(label, query):
    with engine.connect() as conn:
        plan = conn.execute(
            text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query)
        ).scalar_one()
    evidence["plans"][label] = plan


def main():
    with control.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA {SCHEMA}"))
    try:
        Base.metadata.create_all(engine)
        with engine.begin() as conn:
            evidence["postgres_version"] = conn.execute(
                text("SELECT version()")
            ).scalar_one()
            evidence["indexes"] = list(
                conn.execute(
                    text(
                        "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = :schema "
                        "AND tablename IN ('student_assignments', 'assignment_templates')"
                    ),
                    {"schema": SCHEMA},
                ).mappings()
            )
            evidence["indexes"] = [dict(r) for r in evidence["indexes"]]
            conn.execute(
                User.__table__.insert(),
                [
                    dict(
                        id=i,
                        username=f"user{i}",
                        email=f"user{i}@synthetic.invalid",
                        first_name="Synthetic",
                        last_name=str(i),
                        hashed_password="not-a-login",
                        role="admin" if i == 1 else "student",
                    )
                    for i in range(1, 12)
                ],
            )
            conn.execute(
                Subject.__table__.insert(),
                [dict(id=i, name=f"Subject {i}") for i in range(1, 6)],
            )
        previous = 0
        for size in (1000, 5000, 10000, 50000, 100000):
            seed(previous, size)
            previous = size
            measure("templates_100_current", size, templates, template_adapter)
            measure("templates_100_grouped", size, grouped_templates, template_adapter)
            if size in (10000, 100000):
                measure(
                    "templates_1000_current",
                    size,
                    lambda db: templates(db, 1000),
                    template_adapter,
                )
                measure(
                    "templates_1000_grouped",
                    size,
                    lambda db: grouped_templates(db, 1000),
                    template_adapter,
                )
            measure(
                "all_assignments_current",
                size,
                lambda db: get_all_assignments_for_grading(db, admin, None, None, None),
                assignment_adapter,
            )
            measure(
                "student_assignments_current",
                size,
                lambda db: get_my_assignments(db, student, None, None),
                assignment_adapter,
            )
            measure(
                "dashboard_current",
                size,
                lambda db: get_assignment_dashboard(db, admin),
                any_adapter,
            )
            measure("slim_page_50", size, slim_page, TypeAdapter(list[dict]))
            with Session(engine) as db:
                current = template_adapter.dump_python(
                    template_adapter.validate_python(templates(db))
                )
            with Session(engine) as db:
                grouped = template_adapter.dump_python(
                    template_adapter.validate_python(grouped_templates(db))
                )
            assert current == grouped, "Grouped stats changed results"

        queries = {
            "global_page": "SELECT id, assigned_date FROM student_assignments ORDER BY assigned_date DESC, id DESC LIMIT 50",
            "submitted_page": "SELECT id, submitted_date FROM student_assignments WHERE status = 'submitted' ORDER BY submitted_date DESC, id DESC LIMIT 50",
            "student_term": "SELECT id FROM student_assignments WHERE student_id=2 AND coalesce(extended_due_date,due_date,assigned_date) BETWEEN DATE '2026-09-01' AND DATE '2026-09-28'",
        }
        for label, query in queries.items():
            explain(label + "_before", query)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE INDEX perf_global_date ON student_assignments (assigned_date DESC, id DESC)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX perf_submitted_date ON student_assignments (submitted_date DESC, id DESC) WHERE status = 'submitted'"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX perf_student_term ON student_assignments (student_id, (coalesce(extended_due_date,due_date,assigned_date)))"
                )
            )
            conn.execute(text("ANALYZE student_assignments"))
        for label, query in queries.items():
            explain(label + "_after", query)
        measure("slim_page_50_with_index", 100000, slim_page, TypeAdapter(list[dict]))
        evidence["grouped_stats_match_current_on_seed"] = True
        output = Path("docs/assignment-performance-2026-09-28-evidence.json")
        output.write_text(json.dumps(evidence, indent=2) + "\n")
        print(f"Saved {output}", flush=True)
    finally:
        engine.dispose()
        with control.begin() as conn:
            conn.execute(text(f"DROP SCHEMA {SCHEMA} CASCADE"))
        control.dispose()


if __name__ == "__main__":
    main()
