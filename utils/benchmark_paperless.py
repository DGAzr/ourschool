"""Synthetic HTTP/auth/concurrency benchmark on a disposable migrated database.

DATABASE_URL must name an empty paperless_benchmark_* database. Apply Alembic
head first. Output contains aggregate timings/counts only, never credentials
or document text. Upstream uses the REAL client with a deterministic HTTP
transport; this is not live Paperless or browser validation.
"""

import argparse
import json
import logging
import os
import platform
import statistics
import threading
import time
import tracemalloc
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--sizes", type=int, nargs="+", default=[1000, 10000])
    parser.add_argument(
        "--reuse", action="store_true", help="Reuse only this tool synthetic fixture"
    )
    args = parser.parse_args()
    url = os.environ["DATABASE_URL"]
    if not (make_url(url).database or "").startswith("paperless_benchmark_"):
        raise SystemExit("Use an empty disposable paperless_benchmark_* database")
    from app.main import app
    from app.core import database
    from app.core.database import get_db
    from app.models.paperless import PaperlessSyncJob
    from app.services import paperless_client, paperless_jobs
    from app.core.config import settings

    settings.log_level = "ERROR"
    engine = create_engine(url, pool_size=5, max_overflow=15, pool_pre_ping=True)
    with engine.connect() as db:
        user_count = db.execute(text("SELECT count(*) FROM users")).scalar()
        synthetic_count = db.execute(
            text("SELECT count(*) FROM users WHERE username LIKE 'benchmark%'")
        ).scalar()
        if user_count and not (args.reuse and user_count == synthetic_count == 20):
            raise SystemExit(
                "Database already contains users outside this benchmark fixture"
            )
    Session = sessionmaker(bind=engine)

    def get_session():
        with Session() as db:
            yield db

    app.dependency_overrides[get_db] = get_session
    app.state.disable_paperless_worker = True
    # Worker uses this same isolated connection pool.
    database.engine, database.SessionLocal = engine, Session
    library_size = 1000
    # 24 KB of unique keyword-like OCR per nonempty document, with 10% empty OCR.
    keywords = " ".join(f"curriculum{i:04d}" for i in range(1598)) + " fractions cm 3"

    def handler(request):
        params = request.url.params
        path = request.url.path
        time.sleep(0.002)  # simulated upstream latency per request
        if path != "/api/documents/":
            return httpx.Response(
                200,
                headers={"X-API-Version": "10"},
                json={"count": 0, "next": None, "results": []},
            )
        ids = list(range(1, library_size + 1))
        if params.get("id__in"):
            ids = [int(x) for x in params["id__in"].split(",")]
        page_size, page = int(params.get("page_size", "100")), int(
            params.get("page", "1")
        )
        selected = ids[(page - 1) * page_size : page * page_size]
        fields = params.get("fields", "")

        def document(i):
            if fields == "id":
                return {"id": i}
            if fields == "id,content":
                return {"id": i, "content": "" if i % 10 == 0 else keywords}
            return {
                "id": i,
                "title": f"Curriculum {i:05d}",
                "tags": [],
                "document_type": None,
                "correspondent": None,
                "modified": "2026-10-03T00:00:00Z",
                "created": "2026-09-01",
                "added": "2026-09-01T00:00:00Z",
                "page_count": 10,
            }

        return httpx.Response(
            200,
            headers={"X-API-Version": "10"},
            json={
                "count": len(ids),
                "next": f"?page={page+1}" if page * page_size < len(ids) else None,
                "results": [document(i) for i in selected],
            },
        )

    def factory(base_url, token):
        client = paperless_client.PaperlessClient(base_url, token)
        client._client.close()
        client._client = httpx.Client(
            base_url=base_url,
            headers={"Accept": "application/json; version=10"},
            transport=httpx.MockTransport(handler),
        )
        return client

    paperless_client.create_client = factory
    sql_count = 0
    occupancy = {"peak": 0, "seconds": 0.0}
    lock = threading.Lock()
    checkout_times = {}

    def query(*_):
        nonlocal sql_count
        with lock:
            sql_count += 1

    def checkout(dbapi, record, proxy):
        with lock:
            checkout_times[id(record)] = time.perf_counter()
            occupancy["peak"] = max(occupancy["peak"], len(checkout_times))

    def checkin(dbapi, record):
        with lock:
            started = checkout_times.pop(id(record), None)
            if started:
                occupancy["seconds"] += time.perf_counter() - started

    event.listen(engine, "before_cursor_execute", query)
    event.listen(engine, "checkout", checkout)
    event.listen(engine, "checkin", checkin)
    evidence = {
        "date": datetime.now(timezone.utc).isoformat(),
        "reference": {
            "os": platform.platform(),
            "machine": platform.machine(),
            "python": platform.python_version(),
            "cpu_count": os.cpu_count(),
            "postgres": "15 Docker (local disk)",
            "pool": "5 + 15 overflow",
        },
        "method": "FastAPI TestClient HTTP with real authentication, 20 users after a 20-client browse warmup; real Paperless HTTP client with synthetic transport. 24 KB OCR; 10% empty OCR. No browser or external server.",
        "reuse_fixture": args.reuse,
        "measurements": [],
    }
    base = "/api/integrations/paperless"
    with TestClient(app) as api:
        logging.disable(logging.CRITICAL)
        for i in range(20):
            payload = {
                "email": f"benchmark{i}@test.local",
                "username": f"benchmark{i}",
                "first_name": "Benchmark",
                "last_name": str(i),
                "role": "admin",
                "password": "synthetic-test-password123",
            }
            headers = {} if i == 0 else admins[0]
            if not args.reuse:
                response = api.post("/api/users/", json=payload, headers=headers)
                assert response.status_code == 200, response.text
            token = api.post(
                "/api/auth/login",
                data={"username": payload["username"], "password": payload["password"]},
            ).json()["access_token"]
            if i == 0:
                admins = []
            admins.append({"Authorization": f"Bearer {token}"})
        lesson = api.post(
            "/api/lessons/",
            json={"title": "fractions cm 3", "date": "2026-10-03"},
            headers=admins[0],
        ).json()["lesson"]

        def run(job_id):
            with Session() as db:
                paperless_jobs.run_job(db, job_id)

        def summarize(values):
            ordered = sorted(values)
            return {
                "p50_ms": round(statistics.median(values), 2),
                "p95_ms": round(ordered[int(0.95 * (len(ordered) - 1))], 2),
                "max_ms": round(max(values), 2),
                "requests": len(values),
            }

        for size in args.sizes:
            library_size = size
            response = api.post(
                f"{base}/connect",
                json={
                    "url": "http://benchmark.fake",
                    "token": "synthetic-token",
                    "scope_mode": "all",
                },
                headers=admins[0],
            )
            assert response.status_code == 202, response.text
            tracemalloc.start()
            started = time.perf_counter()
            before = sql_count
            run(response.json()["job"]["id"])
            elapsed = time.perf_counter() - started
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            with Session() as db:
                job = db.get(PaperlessSyncJob, response.json()["job"]["id"])
                assert job.state == "ok", job.error
                sync = {
                    "seconds": round(elapsed, 2),
                    "python_peak_mb": round(peak / 1048576, 2),
                    "sql_calls": sql_count - before,
                    **job.counts,
                }
            with engine.begin() as db:
                db.execute(text("ANALYZE paperless_documents"))
            # Warm the 20-client pool separately from cached request samples.
            with ThreadPoolExecutor(max_workers=20) as warmup:
                list(
                    warmup.map(
                        lambda i: api.get(f"{base}/documents", headers=admins[i]),
                        range(20),
                    )
                )
            manual = api.post(f"{base}/sync", headers=admins[0]).json()["id"]
            occupancy.update(peak=0, seconds=0.0)
            executor = ThreadPoolExecutor(max_workers=21)
            background = executor.submit(run, manual)
            operations = {
                "browse": {},
                "search": {"q": "fractions cm 3"},
                "ranking": {"lesson_id": lesson["id"]},
            }

            def user_load(i):
                values = {name: [] for name in operations}
                for _ in range(3):
                    for name, params in operations.items():
                        start = time.perf_counter()
                        response = api.get(
                            f"{base}/documents", params=params, headers=admins[i]
                        )
                        values[name].append((time.perf_counter() - start) * 1000)
                        assert response.status_code == 200, response.text
                        assert response.json()["total"] == (
                            size * 9 // 10 if name == "search" else size
                        )
                return values

            before = sql_count
            user_results = list(executor.map(user_load, range(20)))
            background.result()
            executor.shutdown()
            with Session() as db:
                steady = db.get(PaperlessSyncJob, manual)
                assert steady.state == "ok", steady.error
                steady_counts = steady.counts
            evidence["measurements"].append(
                {
                    "documents": size,
                    "initial_sync": sync,
                    "steady_sync": steady_counts,
                    "read_sql_and_sync_calls": sql_count - before,
                    "connection_occupancy": dict(occupancy),
                    **{
                        name: summarize(
                            [v for result in user_results for v in result[name]]
                        )
                        for name in operations
                    },
                }
            )
            print(json.dumps(evidence["measurements"][-1]), flush=True)
    Path(args.output).write_text(json.dumps(evidence, indent=2) + "\n")
    app.dependency_overrides.clear()
    engine.dispose()


if __name__ == "__main__":
    main()
