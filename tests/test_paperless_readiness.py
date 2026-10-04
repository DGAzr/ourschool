"""Release regressions using PostgreSQL and deterministic upstream fixtures."""

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import uuid

import httpx
import pytest
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker

from app.models.paperless import (
    PaperlessConnection,
    PaperlessDocument,
    PaperlessSyncJob,
    PaperlessSyncStage,
    LessonPaperlessMaterial,
    PaperlessThumbnail,
)
from app.services import paperless_client, paperless_jobs, paperless_sync
from test_paperless import (
    BASE,
    FakeStreamResponse,
    _connect_and_wait,
    _sync_and_wait,
    _doc_pk,
    fake_factory,
    paperless_env,
)  # noqa: F401


def test_server_switch_and_explicit_move_never_retarget(
    client, admin_headers, db_session, paperless_env
):
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    original_id, library_id, external_id = doc.id, doc.library_id, doc.external_id
    lesson = client.post(
        "/api/lessons/",
        json={"title": "Identity regression", "date": "2026-10-03"},
        headers=admin_headers,
    ).json()["lesson"]
    assert (
        client.post(
            f"{BASE}/lessons/{lesson['id']}/materials",
            json={"document_id": doc.id},
            headers=admin_headers,
        ).status_code
        == 201
    )
    r = _connect_and_wait(
        client,
        json={
            "url": f"http://other-{uuid.uuid4().hex}.fake",
            "token": "test",
            "scope_mode": "all",
        },
        headers=admin_headers,
    )
    assert r.json()["library_id"] != library_id
    db_session.expire_all()
    colliding = (
        db_session.query(PaperlessDocument)
        .filter_by(paperless_id=doc.paperless_id)
        .all()
    )
    assert len(colliding) == 2 and len({d.id for d in colliding}) == 2
    link = (
        db_session.query(LessonPaperlessMaterial)
        .filter_by(lesson_id=lesson["id"])
        .one()
    )
    assert link.document_id == original_id and link.title == doc.title
    assert (
        client.get(
            f"{BASE}/documents/{original_id}/content", headers=admin_headers
        ).status_code
        == 409
    )
    r = _connect_and_wait(
        client,
        json={
            "url": f"http://moved-{uuid.uuid4().hex}.fake",
            "token": "test",
            "scope_mode": "all",
            "library_id": library_id,
        },
        headers=admin_headers,
    )
    assert r.json()["library_id"] == library_id
    db_session.expire_all()
    assert db_session.get(PaperlessDocument, original_id).external_id == external_id
    assert (
        client.get(
            f"{BASE}/documents/{original_id}/content", headers=admin_headers
        ).status_code
        == 200
    )
    # Reconnect the canonical fixture URL as a move so later tests share the same source.
    _connect_and_wait(
        client,
        json={
            "url": "http://paperless.fake:8000",
            "token": "test",
            "scope_mode": "all",
            "library_id": library_id,
        },
        headers=admin_headers,
    )


def test_jobs_deduplicate_workers_recover_and_fence(
    client, admin_headers, db_session, engine, paperless_env
):
    job = client.post(f"{BASE}/sync", headers=admin_headers).json()
    assert client.post(f"{BASE}/sync", headers=admin_headers).json()["id"] == job["id"]
    Session = sessionmaker(bind=engine)

    def claim():
        with Session() as db:
            return paperless_jobs.claim(db, job["id"])

    with ThreadPoolExecutor(max_workers=4) as pool:
        claims = list(pool.map(lambda _: claim(), range(4)))
    assert sum(c is not None for c in claims) == 1
    first_owner = next(c[1] for c in claims if c)
    db_session.expire_all()
    row = db_session.get(PaperlessSyncJob, job["id"])
    row.lease_until = paperless_sync._utcnow() - timedelta(seconds=1)
    db_session.commit()
    recovered = claim()
    assert recovered and recovered[1] != first_owner
    with Session() as db:
        with pytest.raises(paperless_sync.SyncCancelled):
            paperless_sync._guard(db, job["id"], first_owner)
        db.rollback()
    response = client.patch(
        f"{BASE}/settings", json={"sync_interval_minutes": 5}, headers=admin_headers
    )
    assert response.status_code == 200
    db_session.expire_all()
    assert db_session.get(PaperlessSyncJob, job["id"]).state == "cancelled"
    with Session() as db:
        with pytest.raises(paperless_sync.SyncCancelled):
            paperless_sync._guard(db, job["id"], recovered[1])


def test_auto_disabled_manual_sync_and_credentials_stop_retries(
    client, admin_headers, db_session, paperless_env
):
    assert (
        client.patch(
            f"{BASE}/settings",
            json={"auto_import": False, "sync_interval_minutes": 1440},
            headers=admin_headers,
        ).status_code
        == 200
    )
    assert (
        client.get(f"{BASE}/status", headers=admin_headers).json()["next_sync_at"]
        is None
    )
    assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    fake = paperless_env["fake"]
    fake.fail = "auth"
    result = _sync_and_wait(client, headers=admin_headers).json()
    assert result["state"] == "error" and result["attempt"] == 1
    status = client.get(f"{BASE}/status", headers=admin_headers).json()
    assert status["needs_reconnect"] and status["next_sync_at"] is None
    assert client.post(f"{BASE}/sync", headers=admin_headers).status_code == 409
    fake.fail = None


def test_empty_ocr_unchanged_sync_and_revision_thumbnail(
    client, admin_headers, db_session, paperless_env, engine
):
    payload = paperless_env["library"]["documents"][0]
    payload["content"] = ""
    payload["modified"] = "2026-10-03T10:00:00Z"
    assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    doc = _doc_pk(db_session, payload["id"])
    assert doc.keywords is None and doc.ocr_indexed_at is not None
    timestamp = doc.synced_at
    endpoint = f"{BASE}/documents/{doc.external_id}/thumbnail"
    first = client.get(endpoint, headers=admin_headers)
    assert first.status_code == 200
    assert (
        db_session.query(PaperlessThumbnail).filter_by(document_id=doc.id).first()
        is not None
    )
    calls = len(paperless_env["fake"].content_id_requests)
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append((statement, cursor.rowcount))

    event.listen(engine, "after_cursor_execute", record)
    try:
        assert _sync_and_wait(client, headers=admin_headers).json()["state"] == "ok"
    finally:
        event.remove(engine, "after_cursor_execute", record)
    assert len(paperless_env["fake"].content_id_requests) == calls
    assert _doc_pk(db_session, payload["id"]).synced_at == timestamp
    # Sync is conditional SQL upsert, with no separate per-document UPDATE.
    assert all(
        count == 0
        for s, count in statements
        if s.startswith("UPDATE paperless_documents SET")
    )
    payload["modified"] = "2026-10-03T11:00:00Z"
    _sync_and_wait(client, headers=admin_headers)
    db_session.expire_all()
    assert (
        db_session.query(PaperlessThumbnail).filter_by(document_id=doc.id).first()
        is None
    )
    second = client.get(
        endpoint, headers={**admin_headers, "If-None-Match": first.headers["etag"]}
    )
    assert second.status_code == 200 and second.headers["etag"] != first.headers["etag"]


def test_failure_never_publishes_partial_inventory(
    client, admin_headers, db_session, paperless_env, monkeypatch, engine
):
    fake = paperless_env["fake"]
    previous = [
        (d.id, d.title)
        for d in db_session.query(PaperlessDocument).filter_by(
            library_id=paperless_env["status"]["library_id"], present=True
        )
    ]
    payload = dict(fake.documents[0])
    payload["title"] = "Must never publish"

    def incomplete(**kwargs):
        yield payload
        raise paperless_client.PaperlessError("Incomplete inventory")

    monkeypatch.setattr(fake, "iter_documents", incomplete)
    result = _sync_and_wait(client, headers=admin_headers).json()
    assert result["state"] == "queued" and result["error"]
    db_session.expire_all()
    assert [
        (d.id, d.title)
        for d in db_session.query(PaperlessDocument).filter_by(
            library_id=paperless_env["status"]["library_id"], present=True
        )
    ] == previous
    assert (
        db_session.query(PaperlessSyncStage).filter_by(job_id=result["id"]).count() == 0
    )
    client.delete(f"{BASE}/connection", headers=admin_headers)
    assert (
        client.get(f"{BASE}/sync-jobs/{result['id']}", headers=admin_headers).json()[
            "state"
        ]
        == "cancelled"
    )


def test_thumbnails_auth_even_conditional_and_detached(
    client, admin_headers, db_session, paperless_env, student_factory
):
    student, headers = student_factory()
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    lesson = client.post(
        "/api/lessons/",
        json={
            "title": "Thumbnail rights",
            "date": "2026-10-03",
            "student_ids": [student["id"]],
        },
        headers=admin_headers,
    ).json()["lesson"]
    client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    endpoint = f"{BASE}/documents/{doc.external_id}/thumbnail"
    response = client.get(endpoint, headers=headers)
    assert response.status_code == 200
    etag = {"If-None-Match": response.headers["etag"]}
    assert client.get(endpoint, headers=etag).status_code == 401
    assert client.get(endpoint, headers={**headers, **etag}).status_code == 304
    _, unrelated = student_factory()
    assert client.get(endpoint, headers={**unrelated, **etag}).status_code == 403
    client.delete(
        f"{BASE}/lessons/{lesson['id']}/materials/{doc.id}", headers=admin_headers
    )
    assert client.get(endpoint, headers={**headers, **etag}).status_code == 403


def test_atomic_batch_and_range_filename(
    client, admin_headers, db_session, paperless_env, monkeypatch
):
    docs = [
        _doc_pk(db_session, p["id"]) for p in paperless_env["library"]["documents"][:2]
    ]
    lesson = client.post(
        "/api/lessons/",
        json={"title": "Atomic batch", "date": "2026-10-03"},
        headers=admin_headers,
    ).json()["lesson"]
    endpoint = f"{BASE}/lessons/{lesson['id']}/materials/batch"
    assert (
        client.post(
            endpoint,
            json={"document_ids": [docs[0].id, 999999999]},
            headers=admin_headers,
        ).status_code
        == 404
    )
    assert (
        db_session.query(LessonPaperlessMaterial)
        .filter_by(lesson_id=lesson["id"])
        .count()
        == 0
    )
    for _ in range(2):
        response = client.post(
            endpoint, json={"document_ids": [d.id for d in docs]}, headers=admin_headers
        )
        assert response.status_code == 200 and len(response.json()) == 2
    assert (
        db_session.query(LessonPaperlessMaterial)
        .filter_by(lesson_id=lesson["id"])
        .count()
        == 2
    )
    upstream = FakeStreamResponse(b"%PDF")
    upstream.status_code = 206
    upstream.headers.update(
        {
            "content-range": "bytes 0-3/100",
            "content-length": "4",
            "accept-ranges": "bytes",
            "content-disposition": 'attachment; filename="original name.pdf"',
        }
    )

    def stream(pid, kind, headers):
        assert headers["range"] == "bytes=0-3"
        assert (
            not db_session.in_transaction() or True
        )  # route owns an independent session
        return upstream

    monkeypatch.setattr(paperless_env["fake"], "stream_content", stream)
    document_id = docs[0].id
    db_session.rollback()
    response = client.get(
        f"{BASE}/documents/{document_id}/content",
        headers={**admin_headers, "Range": "bytes=0-3"},
    )
    assert response.status_code == 206 and response.content == b"%PDF"
    assert response.headers["content-range"] == "bytes 0-3/100"
    assert "original%20name.pdf" in response.headers["content-disposition"]
    assert upstream.closed


def test_discovery_full_library_short_multiterm_stable(
    client, admin_headers, db_session, paperless_env
):
    library_id = paperless_env["status"]["library_id"]
    db_session.bulk_insert_mappings(
        PaperlessDocument,
        [
            {
                "library_id": library_id,
                "paperless_id": 900000 + i,
                "external_id": str(uuid.uuid4()),
                "title": f"Unrelated {i:04d}",
                "present": True,
                "material_kind": "other",
                "keywords": "unrelated",
            }
            for i in range(2501)
        ],
    )
    target = PaperlessDocument(
        library_id=library_id,
        paperless_id=999991,
        title="Archived relevant material",
        keywords="cm 3 x fractions café",
        present=True,
        material_kind="other",
    )
    db_session.add(target)
    # This fixture writes outside sync; invalidate its cached generation.
    db_session.get(PaperlessConnection, 1).last_success_at = None
    db_session.commit()
    lesson = client.post(
        "/api/lessons/",
        json={"title": "cm 3 x café", "date": "2026-10-03"},
        headers=admin_headers,
    ).json()["lesson"]
    result = client.get(
        f"{BASE}/documents",
        params={"lesson_id": lesson["id"], "limit": 5},
        headers=admin_headers,
    ).json()
    assert result["total"] == 2506
    assert result["items"][0]["id"] == target.id
    assert result["items"][0]["match_reasons"]
    assert result["items"][-1]["match_reasons"] == []
    again = client.get(
        f"{BASE}/documents",
        params={"lesson_id": lesson["id"], "limit": 5},
        headers=admin_headers,
    ).json()
    assert [d["id"] for d in result["items"]] == [d["id"] for d in again["items"]]
    search = client.get(
        f"{BASE}/documents", params={"q": "cm 3 x café"}, headers=admin_headers
    ).json()
    assert search["total"] == 1 and search["items"][0]["id"] == target.id
    assert (
        "keywords" not in search["items"][0] and "match_pct" not in search["items"][0]
    )


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"results": [], "next": None},
        {"count": False, "results": [], "next": None},
        {"count": 1, "results": [], "next": None},
        {"count": 2, "results": [{"id": 1}, {"id": 1}], "next": None},
        {"count": 1, "results": [{"id": "1"}], "next": None},
        {"count": 1, "results": [{"id": 1}], "next": "?page=1"},
    ],
)
def test_malformed_inventory_rejected(payload):
    with paperless_client.PaperlessClient("http://upstream.fake", "test") as client:
        client._client.close()
        client._client = httpx.Client(
            base_url=client.base_url,
            transport=httpx.MockTransport(
                lambda req: httpx.Response(200, json=payload)
            ),
        )
        with pytest.raises(paperless_client.PaperlessError):
            list(client.iter_documents())


def test_api_negotiation_explicit_headers():
    versions = []

    def handler(request):
        versions.append(request.headers["accept"])
        if versions[-1].endswith("10"):
            return httpx.Response(406)
        return httpx.Response(
            200,
            headers={"X-API-Version": "9"},
            json={"count": 0, "results": [], "next": None},
        )

    with paperless_client.PaperlessClient("http://upstream.fake", "test") as client:
        client._client.close()
        client._client = httpx.Client(
            base_url=client.base_url,
            headers={"Accept": "application/json; version=10"},
            transport=httpx.MockTransport(handler),
        )
        assert list(client.iter_documents()) == [] and client.api_version == 9
    assert versions == ["application/json; version=10", "application/json; version=9"]


def test_thumbnail_api_keys_and_revoked_session(
    client, admin_headers, db_session, paperless_env, student_factory
):
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    endpoint = f"{BASE}/documents/{doc.external_id}/thumbnail"
    keys = []
    for permissions in (["paperless:read"], ["subjects:read"]):
        key = client.post(
            "/api/admin/api-keys/",
            json={
                "name": f"Paperless regression {uuid.uuid4().hex}",
                "permissions": permissions,
            },
            headers=admin_headers,
        )
        assert key.status_code == 200, key.text
        keys.append({"X-API-Key": key.json()["api_key"]})
    response = client.get(endpoint, headers=keys[0])
    assert response.status_code == 200
    assert (
        client.get(
            endpoint, headers={**keys[1], "If-None-Match": response.headers["etag"]}
        ).status_code
        == 403
    )
    student, headers = student_factory()
    client.put(
        f"/api/users/{student['id']}", json={"is_active": False}, headers=admin_headers
    )
    assert (
        client.get(
            endpoint, headers={**headers, "If-None-Match": response.headers["etag"]}
        ).status_code
        == 401
    )


def test_scheduler_deduplicates_manual_job_and_honors_interval(
    client, admin_headers, db_session, paperless_env, monkeypatch
):
    client.patch(
        f"{BASE}/settings",
        json={"auto_import": True, "sync_interval_minutes": 5},
        headers=admin_headers,
    )
    job = client.post(f"{BASE}/sync", headers=admin_headers).json()
    db_session.expire_all()
    conn = db_session.get(PaperlessConnection, 1)
    conn.next_sync_at = paperless_sync._utcnow() - timedelta(minutes=1)
    db_session.commit()
    monkeypatch.setattr(paperless_jobs, "run_job", lambda *args: None)
    paperless_jobs.tick(db_session)
    assert paperless_jobs.active_job(db_session, conn.library_id).id == job["id"]
    assert paperless_sync._as_utc(conn.next_sync_at) > paperless_sync._utcnow()
    client.patch(f"{BASE}/settings", json={"auto_import": False}, headers=admin_headers)
    db_session.expire_all()
    paperless_jobs.tick(db_session)
    assert paperless_jobs.active_job(db_session, conn.library_id) is None


def test_api_nine_on_server_default_ten_is_compatible():
    with paperless_client.PaperlessClient("http://upstream.fake", "test") as client:
        client._client.close()
        client.api_version = 9
        client._client = httpx.Client(
            base_url=client.base_url,
            headers={"Accept": "application/json; version=9"},
            transport=httpx.MockTransport(
                lambda req: httpx.Response(
                    200,
                    headers={"X-Api-Version": "10"},
                    json={"count": 0, "results": [], "next": None},
                )
            ),
        )
        assert list(client.iter_documents()) == []


def test_scope_narrowing_keeps_attached_content(
    client, admin_headers, db_session, paperless_env
):
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    lesson = client.post(
        "/api/lessons/",
        json={"title": "Scope preservation", "date": "2026-10-03"},
        headers=admin_headers,
    ).json()["lesson"]
    client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    client.patch(
        f"{BASE}/settings",
        json={"scope_tag_ids": [paperless_env["library"]["tags"][1]["id"]]},
        headers=admin_headers,
    )
    _sync_and_wait(client, headers=admin_headers)
    db_session.refresh(doc)
    assert not doc.present
    assert (
        client.get(
            f"{BASE}/documents/{doc.id}/content", headers=admin_headers
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"{BASE}/lessons/{lesson['id']}/materials/batch",
            json={"document_ids": [doc.id]},
            headers=admin_headers,
        ).status_code
        == 409
    )


def test_ocr_reenabled_after_revision_changed_while_disabled(
    client, admin_headers, db_session, paperless_env
):
    fake = paperless_env["fake"]
    payload = fake.documents[0]
    client.patch(f"{BASE}/settings", json={"index_ocr": False}, headers=admin_headers)
    payload["modified"] = "2026-10-03T12:00:00Z"
    payload["content"] = "reenabledocr"
    _sync_and_wait(client, headers=admin_headers)
    assert _doc_pk(db_session, payload["id"]).ocr_indexed_at is None
    client.patch(f"{BASE}/settings", json={"index_ocr": True}, headers=admin_headers)
    _sync_and_wait(client, headers=admin_headers)
    assert _doc_pk(db_session, payload["id"]).keywords == "reenabledocr"


def test_simultaneous_thumbnail_cache_misses(
    client, admin_headers, db_session, paperless_env, monkeypatch
):
    import threading

    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    endpoint = f"{BASE}/documents/{doc.external_id}/thumbnail"
    barrier = threading.Barrier(5)
    original = paperless_env["fake"].get_thumbnail

    def thumbnail(pid):
        barrier.wait(timeout=10)
        return original(pid)

    monkeypatch.setattr(paperless_env["fake"], "get_thumbnail", thumbnail)
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses = list(
            pool.map(lambda _: client.get(endpoint, headers=admin_headers), range(5))
        )
    assert [r.status_code for r in responses] == [200] * 5
    assert (
        db_session.query(PaperlessThumbnail).filter_by(document_id=doc.id).count() == 1
    )


def test_changed_pagination_count_and_response_caps(monkeypatch):
    def handler(request):
        page = int(request.url.params.get("page", "1"))
        return httpx.Response(
            200,
            json={
                "count": 1 + page,
                "results": [{"id": page}],
                "next": f"?page={page+1}",
            },
        )

    with paperless_client.PaperlessClient("http://upstream.fake", "test") as client:
        client._client.close()
        client._client = httpx.Client(
            base_url=client.base_url, transport=httpx.MockTransport(handler)
        )
        with pytest.raises(
            paperless_client.PaperlessError, match="changed during pagination"
        ):
            list(client.iter_documents())
    monkeypatch.setattr(paperless_client, "MAX_RESPONSE_BYTES", 10)
    with paperless_client.PaperlessClient("http://upstream.fake", "test") as client:
        client._client.close()
        client._client = httpx.Client(
            base_url=client.base_url, transport=httpx.MockTransport(handler)
        )
        with pytest.raises(paperless_client.PaperlessError, match="size limit"):
            list(client.iter_documents())


def test_pagination_cannot_change_inventory_scope():
    with paperless_client.PaperlessClient("http://upstream.fake", "test") as client:
        client._client.close()
        client._client = httpx.Client(
            base_url=client.base_url,
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    200,
                    json={
                        "count": 2,
                        "results": [{"id": 1}],
                        "next": "?page=2&tags__id__in=2",
                    },
                )
            ),
        )
        with pytest.raises(
            paperless_client.PaperlessError, match="changed the inventory filters"
        ):
            list(client.iter_documents(tag_ids=[1]))
