"""Paperless-NGX integration tests.

All Paperless HTTP traffic goes through ``FakePaperlessClient`` — the tests
monkeypatch ``app.services.paperless_client.create_client`` (the single seam
every consumer calls through) so no real server is needed.

Each test builds its own fake library with unique Paperless ids (tags,
doctypes, documents) because cache/map tables persist across tests within
the session; a fresh sync soft-deletes documents it doesn't see, which keeps
list/facet assertions isolated.
"""

import itertools
import uuid

import httpx
import pytest

from app.core import crypto
from app.services import paperless_client, paperless_ranking

_id_seq = itertools.count(1)


class FakeStreamResponse:
    """Stand-in for the httpx streaming response the content proxy consumes."""

    def __init__(self, body: bytes, content_type: str = "application/pdf"):
        self.body = body
        self.headers = {"content-type": content_type}
        self.closed = False

    def iter_bytes(self):
        yield self.body

    def close(self):
        self.closed = True


class FakePaperlessClient:
    """Canned Paperless server. ``fail`` simulates auth/transport errors."""

    def __init__(self, tags, doctypes, correspondents, documents, fail=None):
        self.tags = tags
        self.doctypes = doctypes
        self.correspondents = correspondents
        self.documents = documents
        self.fail = fail  # None | "auth" | "unreachable"
        self.truncated = False  # tests flip this to simulate a capped listing
        self.thumb_calls = 0
        self.content_calls = 0
        self.content_id_requests = []  # one entry (the id list) per OCR fetch

    def _maybe_fail(self):
        if self.fail == "auth":
            raise paperless_client.PaperlessError(
                "Paperless rejected the API token.", status=400
            )
        if self.fail == "unreachable":
            raise paperless_client.PaperlessError(
                "Could not reach Paperless server", status=502
            )

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def _count_docs(self, key, value):
        if key == "tag":
            return sum(1 for d in self.documents if value in (d.get("tags") or []))
        return sum(1 for d in self.documents if d.get("document_type") == value)

    def test(self):
        self._maybe_fail()
        return {
            "document_count": len(self.documents),
            "tag_count": len(self.tags),
            "document_type_count": len(self.doctypes),
            "tags": [
                {
                    "id": t["id"],
                    "name": t["name"],
                    "document_count": self._count_docs("tag", t["id"]),
                }
                for t in self.tags
            ],
            "document_types": [
                {
                    "id": d["id"],
                    "name": d["name"],
                    "document_count": self._count_docs("doctype", d["id"]),
                }
                for d in self.doctypes
            ],
        }

    def iter_tags(self):
        self._maybe_fail()
        return iter(self.tags)

    def iter_document_types(self):
        self._maybe_fail()
        return iter(self.doctypes)

    def iter_correspondents(self):
        self._maybe_fail()
        return iter(self.correspondents)

    def iter_documents(self, with_content=True, tag_ids=None, doctype_ids=None):
        self._maybe_fail()
        docs = self.documents
        if tag_ids:
            docs = [d for d in docs if set(d.get("tags") or []) & set(tag_ids)]
        if doctype_ids:
            docs = [d for d in docs if d.get("document_type") in doctype_ids]
        if not with_content:
            # Mirror the real client's lean `fields` param: sweep payloads
            # carry no content, proving sync only gets OCR text through
            # iter_documents_content.
            docs = [{k: v for k, v in d.items() if k != "content"} for d in docs]
        return iter(docs)

    def iter_documents_content(self, paperless_ids):
        self._maybe_fail()
        ids = list(paperless_ids)
        self.content_id_requests.append(ids)
        wanted = set(ids)
        return iter(
            [
                {"id": d["id"], "content": d.get("content")}
                for d in self.documents
                if d["id"] in wanted
            ]
        )

    def get_thumbnail(self, paperless_id):
        self._maybe_fail()
        self.thumb_calls += 1
        return b"THUMBNAIL-BYTES", "image/webp"

    def stream_content(self, paperless_id, kind="preview"):
        self._maybe_fail()
        self.content_calls += 1
        return FakeStreamResponse(b"%PDF-1.7 fake content")


@pytest.fixture()
def fake_factory(monkeypatch):
    """Patch the client seam; returns a setter that installs a fake."""
    holder = {"fake": None, "credentials": []}

    def create_client(url, token):
        holder["credentials"].append((url, token))
        assert holder["fake"] is not None, "install a fake before connecting"
        return holder["fake"]

    monkeypatch.setattr(paperless_client, "create_client", create_client)

    def install(fake):
        holder["fake"] = fake
        return fake

    install.credentials = holder["credentials"]
    return install


def make_library(math_name, sci_name):
    """A small canned library keyed to two subject names, with unique ids."""
    base = next(_id_seq) * 1000
    tags = [
        {"id": base + 1, "name": math_name},
        {"id": base + 2, "name": sci_name},
        {"id": base + 3, "name": f"Unrelated-{base}"},
    ]
    doctypes = [
        {"id": base + 1, "name": "Worksheet"},
        {"id": base + 2, "name": "Unit Test"},
        {"id": base + 3, "name": "Recipe"},
    ]
    correspondents = [{"id": base + 1, "name": "Saxon Math"}]
    docs = [
        {
            "id": base + 1,
            "title": "Adding fractions practice",
            "archive_serial_number": 101,
            "correspondent": base + 1,
            "document_type": base + 1,
            "tags": [tags[0]["id"]],
            "page_count": 4,
            "created": "2026-06-01T00:00:00Z",
            "added": "2026-06-02T00:00:00Z",
            "content": "practice adding fractions with unlike denominators",
        },
        {
            "id": base + 2,
            "title": "Multiplication quiz",
            "archive_serial_number": 102,
            "correspondent": None,
            "document_type": base + 2,
            "tags": [tags[0]["id"]],
            "page_count": 2,
            "created": "2026-06-03T00:00:00Z",
            "added": "2026-06-04T00:00:00Z",
            "content": "timed multiplication quiz facts",
        },
        {
            "id": base + 3,
            "title": "Photosynthesis lab sheet",
            "archive_serial_number": None,
            "correspondent": None,
            "document_type": base + 1,
            "tags": [tags[1]["id"]],
            "page_count": 3,
            "created": "2026-06-05T00:00:00Z",
            "added": "2026-06-06T00:00:00Z",
            "content": "photosynthesis lab chloroplast light experiment",
        },
        {
            "id": base + 4,
            "title": "Household form",
            "archive_serial_number": None,
            "correspondent": None,
            "document_type": None,
            "tags": [tags[2]["id"]],
            "page_count": 1,
            "created": None,
            "added": None,
            "content": "some unrelated household paperwork",
        },
    ]
    return {
        "tags": tags,
        "doctypes": doctypes,
        "correspondents": correspondents,
        "documents": docs,
    }


BASE = "/api/integrations/paperless"


@pytest.fixture()
def paperless_env(client, admin_headers, fake_factory):
    """Two subjects + a connected fake Paperless server (initial sync ran)."""
    tok = uuid.uuid4().hex[:8]
    math_name = f"Math-{tok}"
    sci_name = f"Science-{tok}"
    subjects = {}
    for name in (math_name, sci_name):
        r = client.post("/api/subjects/", json={"name": name}, headers=admin_headers)
        assert r.status_code == 200, r.text
        subjects[name] = r.json()

    library = make_library(math_name, sci_name)
    fake = fake_factory(FakePaperlessClient(**library))

    r = client.post(
        f"{BASE}/connect",
        json={"url": "http://paperless.fake:8000", "token": f"token-{tok}-abcd"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return {
        "math": subjects[math_name],
        "sci": subjects[sci_name],
        "math_name": math_name,
        "sci_name": sci_name,
        "library": library,
        "fake": fake,
        "token": f"token-{tok}-abcd",
        "status": r.json(),
    }


def _doc_row(db_session, paperless_id):
    """Cached row for a Paperless id, or None when the sync purged it."""
    from app.models.paperless import PaperlessDocument

    doc = (
        db_session.query(PaperlessDocument)
        .filter(PaperlessDocument.paperless_id == paperless_id)
        .first()
    )
    if doc is not None:
        db_session.refresh(doc)
    return doc


def _doc_pk(db_session, paperless_id):
    doc = _doc_row(db_session, paperless_id)
    assert doc is not None
    return doc


# --- crypto ------------------------------------------------------------------


def test_crypto_roundtrip(engine):
    secret = "paperless-token-123"
    encrypted = crypto.encrypt_secret(secret)
    assert secret not in encrypted
    assert crypto.decrypt_secret(encrypted) == secret
    with pytest.raises(crypto.SecretDecryptError):
        crypto.decrypt_secret("not-a-fernet-token")


# --- ranking (pure) ----------------------------------------------------------


def test_ranking_scores_subject_and_hits():
    # Same subject alone: 60.
    assert paperless_ranking.score(1, None, "Doc", 1, "Lesson", None) == 60
    # Different subject, no word overlap: 0.
    assert paperless_ranking.score(2, None, "Doc", 1, "Lesson", None) == 0
    # Hits are words len > 3, capped at 4, 11 points each.
    score = paperless_ranking.score(
        1,
        "fractions denominators practice adding",
        "Adding fractions",
        1,
        "Fractions",
        "practice adding fractions with unlike denominators today",
    )
    assert score == 60 + 4 * 11  # cap at 4 hits


def test_ranking_match_pct_clamps():
    assert paperless_ranking.match_pct(0) == 46
    assert paperless_ranking.match_pct(60) == 73
    assert paperless_ranking.match_pct(104) == 97  # 126.88 clamped
    assert paperless_ranking.match_pct(500) == 97


# --- real client pagination (httpx transport) ---------------------------------


def test_pagination_ignores_advertised_next_host():
    """A Paperless server behind a misconfigured reverse proxy advertises
    ``next`` links with its internal scheme/host (e.g. an http:// address
    with a closed port). Pagination must re-issue against the configured
    base_url, keeping only the query string."""
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        if request.url.params.get("page", "1") == "1":
            return httpx.Response(
                200,
                json={
                    "next": (
                        "http://paperless.internal:8000/api/documents/"
                        "?page=2&page_size=100"
                    ),
                    "results": [{"id": 1}],
                },
            )
        return httpx.Response(200, json={"next": None, "results": [{"id": 2}]})

    client = paperless_client.PaperlessClient("https://papers.example.com", "tok")
    client._client = httpx.Client(
        base_url="https://papers.example.com",
        transport=httpx.MockTransport(handler),
    )
    assert [d["id"] for d in client.iter_documents()] == [1, 2]
    assert calls[1].startswith("https://papers.example.com/api/documents/")
    assert "page=2" in calls[1]


def test_iter_documents_sends_scope_filter_params():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url)
        return httpx.Response(200, json={"next": None, "results": []})

    client = paperless_client.PaperlessClient("https://papers.example.com", "tok")
    client._client = httpx.Client(
        base_url="https://papers.example.com",
        transport=httpx.MockTransport(handler),
    )
    list(client.iter_documents(tag_ids=[1, 2]))
    list(client.iter_documents(doctype_ids=[3]))
    list(client.iter_documents())
    assert calls[0].params["tags__id__in"] == "1,2"
    assert calls[1].params["document_type__id__in"] == "3"
    assert "tags__id__in" not in calls[1].params
    assert "tags__id__in" not in calls[2].params
    assert "document_type__id__in" not in calls[2].params


def test_pagination_page_cap_sets_truncated(monkeypatch):
    """Stopping at MAX_PAGES with results remaining flips ``truncated`` so
    the sync layer can refuse to treat the listing as complete."""
    monkeypatch.setattr(paperless_client, "MAX_PAGES", 2)

    def endless(request: httpx.Request) -> httpx.Response:
        page = int(request.url.params.get("page", "1"))
        return httpx.Response(
            200,
            json={
                "next": f"https://papers.example.com/api/documents/?page={page + 1}",
                "results": [{"id": page}],
            },
        )

    client = paperless_client.PaperlessClient("https://papers.example.com", "tok")
    client._client = httpx.Client(
        base_url="https://papers.example.com",
        transport=httpx.MockTransport(endless),
    )
    assert [d["id"] for d in client.iter_documents()] == [1, 2]
    assert client.truncated is True

    def one_page(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"next": None, "results": [{"id": 1}]})

    client = paperless_client.PaperlessClient("https://papers.example.com", "tok")
    client._client = httpx.Client(
        base_url="https://papers.example.com",
        transport=httpx.MockTransport(one_page),
    )
    list(client.iter_documents())
    assert client.truncated is False


# --- connection lifecycle ----------------------------------------------------


def test_test_endpoint_success_and_failures(client, admin_headers, fake_factory):
    library = make_library("A", "B")
    fake = fake_factory(FakePaperlessClient(**library))

    r = client.post(
        f"{BASE}/test",
        json={"url": "http://x", "token": "t1234"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["document_count"] == 4
    assert body["tag_count"] == 3
    assert body["document_type_count"] == 3

    fake.fail = "auth"
    r = client.post(
        f"{BASE}/test", json={"url": "http://x", "token": "bad"}, headers=admin_headers
    )
    assert r.status_code == 400, r.text

    fake.fail = "unreachable"
    r = client.post(
        f"{BASE}/test", json={"url": "http://down", "token": "t"}, headers=admin_headers
    )
    assert r.status_code == 502, r.text


def test_connect_syncs_and_encrypts_token(
    client, admin_headers, db_session, paperless_env
):
    from app.models.paperless import PaperlessConnection, PaperlessTagMap

    status = paperless_env["status"]
    assert status["connected"] is True
    assert status["document_count"] == 4
    # Token is masked in the response and encrypted at rest.
    assert status["token_masked"].endswith(paperless_env["token"][-4:])
    assert paperless_env["token"] not in status["token_masked"]
    conn = db_session.query(PaperlessConnection).first()
    assert paperless_env["token"] not in conn.token_encrypted
    assert crypto.decrypt_secret(conn.token_encrypted) == paperless_env["token"]

    # Tag auto-match: subject-named tags map, the unrelated tag doesn't.
    tag_ids = {t["id"]: t for t in paperless_env["library"]["tags"]}
    maps = {
        m.paperless_tag_id: m
        for m in db_session.query(PaperlessTagMap).all()
        if m.paperless_tag_id in tag_ids
    }
    math_tag, sci_tag, other_tag = paperless_env["library"]["tags"]
    assert maps[math_tag["id"]].subject_id == paperless_env["math"]["id"]
    assert maps[sci_tag["id"]].subject_id == paperless_env["sci"]["id"]
    assert maps[other_tag["id"]].subject_id is None

    # Documents derived subject/kind/correspondent; keywords extracted.
    d1 = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    assert d1.subject_id == paperless_env["math"]["id"]
    assert d1.material_kind == "worksheet"
    assert d1.correspondent == "Saxon Math"
    assert d1.asn == "101"
    assert "fractions" in d1.keywords
    d2 = _doc_pk(db_session, paperless_env["library"]["documents"][1]["id"])
    assert d2.material_kind == "test"  # "Unit Test" name heuristic
    d4 = _doc_pk(db_session, paperless_env["library"]["documents"][3]["id"])
    assert d4.subject_id is None
    assert d4.material_kind == "other"


def test_settings_remap_toggles_and_manual_map_survives_sync(
    client, admin_headers, db_session, paperless_env
):
    from app.models.paperless import PaperlessTagMap

    math_tag = paperless_env["library"]["tags"][0]

    # Remap the math tag to the science subject.
    r = client.patch(
        f"{BASE}/settings",
        json={
            "auto_import": False,
            "tag_maps": [
                {
                    "paperless_tag_id": math_tag["id"],
                    "subject_id": paperless_env["sci"]["id"],
                }
            ],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["auto_import"] is False

    row = (
        db_session.query(PaperlessTagMap)
        .filter(PaperlessTagMap.paperless_tag_id == math_tag["id"])
        .first()
    )
    assert row.subject_id == paperless_env["sci"]["id"]
    assert row.auto_matched is False

    # Cached docs re-derived from the new mapping.
    d1 = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    assert d1.subject_id == paperless_env["sci"]["id"]

    # A manual mapping survives a fresh sync (auto-match must not overwrite).
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    db_session.expire_all()
    row = (
        db_session.query(PaperlessTagMap)
        .filter(PaperlessTagMap.paperless_tag_id == math_tag["id"])
        .first()
    )
    assert row.subject_id == paperless_env["sci"]["id"]
    assert row.auto_matched is False

    # Invalid doctype kind rejected by schema validation.
    r = client.patch(
        f"{BASE}/settings",
        json={
            "doctype_maps": [{"paperless_doctype_id": 1, "material_kind": "not-a-kind"}]
        },
        headers=admin_headers,
    )
    assert r.status_code == 422, r.text


# --- sync scope ----------------------------------------------------------------


def _reconnect_with_scope(client, admin_headers, env, scope):
    """Reconnect the paperless_env server with a sync scope (re-runs sync)."""
    r = client.post(
        f"{BASE}/connect",
        json={"url": "http://paperless.fake:8000", "token": env["token"], **scope},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_test_returns_scope_options(client, admin_headers, fake_factory):
    library = make_library("ScopeMath", "ScopeSci")
    fake_factory(FakePaperlessClient(**library))
    r = client.post(
        f"{BASE}/test",
        json={"url": "http://paperless.fake:8000", "token": "token-abcd"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    by_name = {t["name"]: t["document_count"] for t in body["tags"]}
    assert by_name["ScopeMath"] == 2  # fractions + quiz
    kinds = {d["name"]: d["document_count"] for d in body["document_types"]}
    assert kinds["Worksheet"] == 2  # fractions + photosynthesis
    assert kinds["Recipe"] == 0


def test_connect_with_scope_imports_subset(
    client, admin_headers, db_session, paperless_env
):
    from app.models.paperless import PaperlessTagMap

    lib = paperless_env["library"]
    math_tag = lib["tags"][0]["id"]
    status = _reconnect_with_scope(
        client, admin_headers, paperless_env, {"scope_tag_ids": [math_tag]}
    )

    assert status["scope_tag_ids"] == [math_tag]
    assert status["document_count"] == 2  # only the two math-tagged docs
    # Mapping card shrinks to the scoped tag; doctype axis (empty) stays full.
    assert [m["paperless_tag_id"] for m in status["tag_maps"]] == [math_tag]
    lib_doctype_ids = {d["id"] for d in lib["doctypes"]}
    returned_doctypes = {
        m["paperless_doctype_id"] for m in status["doctype_maps"]
    } & lib_doctype_ids
    assert returned_doctypes == lib_doctype_ids

    # All map rows stay in the DB (manual mappings must survive scope changes).
    db_rows = (
        db_session.query(PaperlessTagMap)
        .filter(PaperlessTagMap.paperless_tag_id.in_([t["id"] for t in lib["tags"]]))
        .count()
    )
    assert db_rows == 3

    docs = lib["documents"]
    assert _doc_pk(db_session, docs[0]["id"]).present is True
    assert _doc_pk(db_session, docs[1]["id"]).present is True
    # Out-of-scope docs with no attachments are purged by the sync cleanup.
    assert _doc_row(db_session, docs[2]["id"]) is None
    assert _doc_row(db_session, docs[3]["id"]) is None


def test_scope_union_and_dedupe(client, admin_headers, db_session, paperless_env):
    lib = paperless_env["library"]
    math_tag = lib["tags"][0]["id"]
    worksheet = lib["doctypes"][0]["id"]
    # Doc 1 matches both axes (math tag AND worksheet doctype) — counted once.
    status = _reconnect_with_scope(
        client,
        admin_headers,
        paperless_env,
        {"scope_tag_ids": [math_tag], "scope_doctype_ids": [worksheet]},
    )
    assert status["document_count"] == 3

    docs = lib["documents"]
    assert _doc_pk(db_session, docs[0]["id"]).present is True  # both axes
    assert _doc_pk(db_session, docs[1]["id"]).present is True  # tag only
    assert _doc_pk(db_session, docs[2]["id"]).present is True  # doctype only
    assert _doc_row(db_session, docs[3]["id"]) is None  # out of scope → purged


def test_scope_change_resync_and_manual_map_survives(
    client, admin_headers, db_session, paperless_env
):
    lib = paperless_env["library"]
    math_tag = lib["tags"][0]["id"]
    sci_tag = lib["tags"][1]["id"]

    # Manual remap: math tag → science subject (auto_matched flips off).
    r = client.patch(
        f"{BASE}/settings",
        json={
            "tag_maps": [
                {
                    "paperless_tag_id": math_tag,
                    "subject_id": paperless_env["sci"]["id"],
                }
            ]
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text

    # Scope down to the science tag only; PATCH alone must not sync.
    r = client.patch(
        f"{BASE}/settings",
        json={"scope_tag_ids": [sci_tag]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["scope_tag_ids"] == [sci_tag]
    assert _doc_pk(db_session, lib["documents"][0]["id"]).present is True

    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    db_session.expire_all()
    # Unattached and now out of scope → the cleanup purged the cache row.
    assert _doc_row(db_session, lib["documents"][0]["id"]) is None
    assert _doc_pk(db_session, lib["documents"][2]["id"]).present is True

    # Widen the scope back — the doc returns and the manual mapping held.
    r = client.patch(
        f"{BASE}/settings",
        json={"scope_tag_ids": [math_tag, sci_tag]},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    db_session.expire_all()
    d1 = _doc_pk(db_session, lib["documents"][0]["id"])
    assert d1.present is True
    assert d1.subject_id == paperless_env["sci"]["id"]


def test_scope_zero_matches_keeps_attachments(
    client, admin_headers, db_session, paperless_env
):
    lib = paperless_env["library"]
    doc = _doc_pk(db_session, lib["documents"][0]["id"])

    r = client.post(
        "/api/lessons/",
        json={"title": "Scoped-out lesson", "date": "2026-07-11"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    # Scope to a tag id no document carries: sync succeeds, imports nothing.
    status = _reconnect_with_scope(
        client,
        admin_headers,
        paperless_env,
        {"scope_tag_ids": [lib["tags"][2]["id"] + 500]},
    )
    assert status["last_sync_status"] == "ok"
    assert status["document_count"] == 0

    r = client.get(f"{BASE}/documents", headers=admin_headers)
    assert r.json()["total"] == 0

    # The attachment still renders from its snapshot.
    r = client.get(f"/api/lessons/{lesson['id']}", headers=admin_headers)
    materials = r.json()["paperless_materials"]
    assert len(materials) == 1
    assert materials[0]["title"] == "Adding fractions practice"


def test_scope_options_endpoint(client, admin_headers, paperless_env):
    lib = paperless_env["library"]
    r = client.get(f"{BASE}/scope-options", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    tags = {t["id"]: t for t in body["tags"]}
    math_tag = lib["tags"][0]["id"]
    assert tags[math_tag]["document_count"] == 2
    assert {d["id"] for d in body["document_types"]} == {
        d["id"] for d in lib["doctypes"]
    }

    r = client.delete(f"{BASE}/connection", headers=admin_headers)
    assert r.status_code == 204, r.text
    r = client.get(f"{BASE}/scope-options", headers=admin_headers)
    assert r.status_code == 409, r.text


def test_documents_filtering_and_facets(client, admin_headers, paperless_env):
    math_id = paperless_env["math"]["id"]

    # Unfiltered: this test's four synced docs (older docs got present=False).
    r = client.get(f"{BASE}/documents", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 4
    assert body["facets"]["kinds"]["worksheet"] == 2
    assert body["facets"]["kinds"]["test"] == 1
    assert body["facets"]["subjects"][str(math_id)] == 2

    # Subject filter.
    r = client.get(f"{BASE}/documents?subject_id={math_id}", headers=admin_headers)
    assert {item["title"] for item in r.json()["items"]} == {
        "Adding fractions practice",
        "Multiplication quiz",
    }

    # Kind filter.
    r = client.get(f"{BASE}/documents?kind=test", headers=admin_headers)
    assert [item["title"] for item in r.json()["items"]] == ["Multiplication quiz"]

    # Full-text query hits OCR keywords.
    r = client.get(f"{BASE}/documents?q=chloroplast", headers=admin_headers)
    assert [item["title"] for item in r.json()["items"]] == ["Photosynthesis lab sheet"]

    # Query matches correspondent too.
    r = client.get(f"{BASE}/documents?q=saxon", headers=admin_headers)
    assert [item["title"] for item in r.json()["items"]] == [
        "Adding fractions practice"
    ]


def test_lesson_ranking_attach_detach(client, admin_headers, db_session, paperless_env):
    math_id = paperless_env["math"]["id"]
    r = client.post(
        "/api/lessons/",
        json={
            "title": "Fractions day",
            "date": "2026-07-11",
            "subject_id": math_id,
            "objective": "practice adding fractions with unlike denominators",
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]

    # Ranked list: the fractions worksheet outranks the quiz; pct present.
    r = client.get(
        f"{BASE}/documents?subject_id={math_id}&lesson_id={lesson['id']}",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items[0]["title"] == "Adding fractions practice"
    assert items[0]["match_pct"] > items[1]["match_pct"]
    assert all(item["attached"] is False for item in items)

    # Attach → embedded in the lesson payload, usage counts update.
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    material = r.json()
    assert material["title"] == "Adding fractions practice"
    assert material["external_id"] == doc.external_id

    r = client.get(f"/api/lessons/{lesson['id']}", headers=admin_headers)
    assert r.status_code == 200, r.text
    embedded = r.json()["paperless_materials"]
    assert len(embedded) == 1
    assert embedded[0]["document_id"] == doc.id

    # Duplicate attach → 409.
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 409, r.text

    # Ranked list now flags it attached; detail shows usage.
    r = client.get(
        f"{BASE}/documents?subject_id={math_id}&lesson_id={lesson['id']}",
        headers=admin_headers,
    )
    flagged = {item["title"]: item["attached"] for item in r.json()["items"]}
    assert flagged["Adding fractions practice"] is True
    r = client.get(f"{BASE}/documents/{doc.id}", headers=admin_headers)
    detail = r.json()
    assert detail["used_in_count"] == 1
    assert detail["used_in"][0]["lesson_id"] == lesson["id"]

    # Detach → gone from the lesson.
    r = client.delete(
        f"{BASE}/lessons/{lesson['id']}/materials/{doc.id}", headers=admin_headers
    )
    assert r.status_code == 204, r.text
    r = client.get(f"/api/lessons/{lesson['id']}", headers=admin_headers)
    assert r.json()["paperless_materials"] == []

    # Detaching again → 404.
    r = client.delete(
        f"{BASE}/lessons/{lesson['id']}/materials/{doc.id}", headers=admin_headers
    )
    assert r.status_code == 404, r.text


def test_lesson_delete_cascades_links(client, admin_headers, db_session, paperless_env):
    from app.models.paperless import LessonPaperlessMaterial

    r = client.post(
        "/api/lessons/",
        json={"title": "Cascade check", "date": "2026-07-11"},
        headers=admin_headers,
    )
    lesson = r.json()["lesson"]
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][2]["id"])
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    r = client.delete(f"/api/lessons/{lesson['id']}", headers=admin_headers)
    assert r.status_code == 200, r.text
    remaining = (
        db_session.query(LessonPaperlessMaterial)
        .filter(LessonPaperlessMaterial.lesson_id == lesson["id"])
        .count()
    )
    assert remaining == 0


def test_template_attach_and_student_content_scope(
    client, admin_headers, db_session, paperless_env, classroom, student_factory, assign
):
    template = classroom["template"]
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])

    r = client.post(
        f"{BASE}/templates/{template['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    # Embedded in the template response.
    r = client.get(
        f"/api/assignments/templates/{template['id']}", headers=admin_headers
    )
    assert r.status_code == 200, r.text
    assert [m["document_id"] for m in r.json()["paperless_materials"]] == [doc.id]

    owner, owner_headers = student_factory()
    outsider, outsider_headers = student_factory()
    assign(template["id"], owner["id"])

    content_url = f"{BASE}/documents/{doc.id}/content"
    # Unauthenticated → 401.
    assert client.get(content_url).status_code == 401
    # Admin → 200 (streams the fake PDF).
    r = client.get(content_url, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.content == b"%PDF-1.7 fake content"
    # The assigned student → 200; another student → 403.
    assert client.get(content_url, headers=owner_headers).status_code == 200
    assert client.get(content_url, headers=outsider_headers).status_code == 403

    # attachment disposition also streams.
    r = client.get(f"{content_url}?disposition=attachment", headers=owner_headers)
    assert r.status_code == 200, r.text

    # Detach → student loses access.
    r = client.delete(
        f"{BASE}/templates/{template['id']}/materials/{doc.id}",
        headers=admin_headers,
    )
    assert r.status_code == 204, r.text
    assert client.get(content_url, headers=owner_headers).status_code == 403


def test_lesson_material_student_content_scope(
    client, admin_headers, db_session, paperless_env, student_factory
):
    """A student rostered on a lesson can stream its attached documents."""
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    rostered, rostered_headers = student_factory()
    outsider, outsider_headers = student_factory()

    r = client.post(
        "/api/lessons/",
        json={
            "title": "Materials scope",
            "date": "2026-07-13",
            "student_ids": [rostered["id"]],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    content_url = f"{BASE}/documents/{doc.id}/content"
    assert client.get(content_url, headers=rostered_headers).status_code == 200
    assert client.get(content_url, headers=outsider_headers).status_code == 403

    # The student's own lesson feed embeds the material.
    r = client.get(
        "/api/lessons/my-lessons",
        params={"start_date": "2026-07-13"},
        headers=rostered_headers,
    )
    assert r.status_code == 200, r.text
    mine = [lesson_json for lesson_json in r.json() if lesson_json["id"] == lesson["id"]]
    assert [m["document_id"] for m in mine[0]["paperless_materials"]] == [doc.id]

    # Detach → access revoked.
    r = client.delete(
        f"{BASE}/lessons/{lesson['id']}/materials/{doc.id}", headers=admin_headers
    )
    assert r.status_code == 204, r.text
    assert client.get(content_url, headers=rostered_headers).status_code == 403


# --- assignment-instance materials --------------------------------------------


def test_assignment_attach_detach_and_embed(
    client, admin_headers, db_session, paperless_env, classroom, student_factory, assign
):
    student, _ = student_factory()
    assignment = assign(classroom["template"]["id"], student["id"])
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])

    materials_url = f"{BASE}/student-assignments/{assignment['id']}/materials"
    r = client.post(materials_url, json={"document_id": doc.id}, headers=admin_headers)
    assert r.status_code == 201, r.text
    assert r.json()["title"] == "Adding fractions practice"

    # Duplicate → 409; unknown assignment / unknown document → 404.
    r = client.post(materials_url, json={"document_id": doc.id}, headers=admin_headers)
    assert r.status_code == 409, r.text
    r = client.post(
        f"{BASE}/student-assignments/999999/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 404, r.text
    r = client.post(
        materials_url, json={"document_id": 999999}, headers=admin_headers
    )
    assert r.status_code == 404, r.text

    # Embedded on the assignment detail (instance list, not the template's).
    r = client.get(
        f"/api/assignments/student-assignments/{assignment['id']}",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert [m["document_id"] for m in body["paperless_materials"]] == [doc.id]
    assert body["template"]["paperless_materials"] == []

    r = client.delete(f"{materials_url}/{doc.id}", headers=admin_headers)
    assert r.status_code == 204, r.text
    r = client.delete(f"{materials_url}/{doc.id}", headers=admin_headers)
    assert r.status_code == 404, r.text


def test_assign_with_materials_creates_links_for_batch(
    client, admin_headers, db_session, paperless_env, classroom, student_factory
):
    s1, s1_headers = student_factory()
    s2, s2_headers = student_factory()
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][1]["id"])

    r = client.post(
        "/api/assignments/assign",
        json={
            "template_id": classroom["template"]["id"],
            "student_ids": [s1["id"], s2["id"]],
            # Duplicated id proves the request is deduped.
            "paperless_document_ids": [doc.id, doc.id],
        },
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success_count"] == 2
    for created in body["created_assignments"]:
        assert [m["document_id"] for m in created["paperless_materials"]] == [doc.id]

    # Both students can stream the doc through the content proxy.
    content_url = f"{BASE}/documents/{doc.id}/content"
    assert client.get(content_url, headers=s1_headers).status_code == 200
    assert client.get(content_url, headers=s2_headers).status_code == 200

    # A bogus document id fails the whole batch before anything is created.
    from app.models.assignment import StudentAssignment

    before = db_session.query(StudentAssignment).count()
    r = client.post(
        "/api/assignments/assign",
        json={
            "template_id": classroom["template"]["id"],
            "student_ids": [s1["id"]],
            "paperless_document_ids": [999999],
        },
        headers=admin_headers,
    )
    assert r.status_code == 404, r.text
    assert db_session.query(StudentAssignment).count() == before


def test_instance_content_scope(
    client, admin_headers, db_session, paperless_env, classroom, student_factory, assign
):
    template = classroom["template"]
    owner, owner_headers = student_factory()
    sibling, sibling_headers = student_factory()
    _, outsider_headers = student_factory()
    owner_assignment = assign(template["id"], owner["id"])
    assign(template["id"], sibling["id"])

    doc = _doc_pk(db_session, paperless_env["library"]["documents"][2]["id"])
    content_url = f"{BASE}/documents/{doc.id}/content"

    # Attached to the owner's instance only: owner in, everyone else out.
    r = client.post(
        f"{BASE}/student-assignments/{owner_assignment['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    assert client.get(content_url, headers=owner_headers).status_code == 200
    assert client.get(content_url, headers=sibling_headers).status_code == 403
    assert client.get(content_url, headers=outsider_headers).status_code == 403

    # Same doc also attached to the template: the sibling gains access.
    r = client.post(
        f"{BASE}/templates/{template['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    assert client.get(content_url, headers=sibling_headers).status_code == 200

    # Template link removed: owner keeps access via the instance link.
    r = client.delete(
        f"{BASE}/templates/{template['id']}/materials/{doc.id}",
        headers=admin_headers,
    )
    assert r.status_code == 204, r.text
    assert client.get(content_url, headers=owner_headers).status_code == 200
    assert client.get(content_url, headers=sibling_headers).status_code == 403

    # Instance link removed too: owner is out.
    r = client.delete(
        f"{BASE}/student-assignments/{owner_assignment['id']}/materials/{doc.id}",
        headers=admin_headers,
    )
    assert r.status_code == 204, r.text
    assert client.get(content_url, headers=owner_headers).status_code == 403


def test_assignment_delete_cascades_links(
    client, admin_headers, db_session, paperless_env, classroom, student_factory, assign
):
    from app.models.paperless import StudentAssignmentPaperlessMaterial

    student, _ = student_factory()
    assignment = assign(classroom["template"]["id"], student["id"])
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    r = client.post(
        f"{BASE}/student-assignments/{assignment['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    r = client.delete(
        f"/api/assignments/student-assignments/{assignment['id']}",
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    remaining = (
        db_session.query(StudentAssignmentPaperlessMaterial)
        .filter(
            StudentAssignmentPaperlessMaterial.student_assignment_id
            == assignment["id"]
        )
        .count()
    )
    assert remaining == 0


def test_thumbnail_capability_url_caches(client, db_session, paperless_env):
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][0]["id"])
    fake = paperless_env["fake"]

    # No auth headers at all — capability URL.
    r = client.get(f"{BASE}/documents/{doc.external_id}/thumbnail")
    assert r.status_code == 200, r.text
    assert r.content == b"THUMBNAIL-BYTES"
    assert r.headers["content-type"].startswith("image/webp")
    assert fake.thumb_calls == 1

    # Second hit is served from the cache (no new upstream call).
    r = client.get(f"{BASE}/documents/{doc.external_id}/thumbnail")
    assert r.status_code == 200, r.text
    assert fake.thumb_calls == 1

    # Unknown id → 404.
    r = client.get(f"{BASE}/documents/{uuid.uuid4()}/thumbnail")
    assert r.status_code == 404, r.text


def test_admin_endpoints_reject_students(
    client, admin_headers, paperless_env, student_factory
):
    _, student_headers = student_factory()
    assert client.get(f"{BASE}/status", headers=student_headers).status_code == 403
    assert client.post(f"{BASE}/sync", headers=student_headers).status_code == 403
    assert (
        client.patch(
            f"{BASE}/settings", json={"auto_import": False}, headers=student_headers
        ).status_code
        == 403
    )
    assert client.get(f"{BASE}/documents", headers=student_headers).status_code == 403
    assert (
        client.delete(f"{BASE}/connection", headers=student_headers).status_code == 403
    )
    assert (
        client.post(
            f"{BASE}/student-assignments/1/materials",
            json={"document_id": 1},
            headers=student_headers,
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"{BASE}/student-assignments/1/materials/1", headers=student_headers
        ).status_code
        == 403
    )


def test_disconnect_keeps_cache_and_attachments(
    client, admin_headers, db_session, paperless_env
):
    from app.models.paperless import (
        PaperlessConnection,
        PaperlessDocument,
        PaperlessTagMap,
    )

    r = client.post(
        "/api/lessons/",
        json={"title": "Keeps materials", "date": "2026-07-11"},
        headers=admin_headers,
    )
    lesson = r.json()["lesson"]
    doc = _doc_pk(db_session, paperless_env["library"]["documents"][1]["id"])
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": doc.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    r = client.delete(f"{BASE}/connection", headers=admin_headers)
    assert r.status_code == 204, r.text

    # Connection + maps gone; cache and attachments survive.
    assert db_session.query(PaperlessConnection).count() == 0
    assert db_session.query(PaperlessTagMap).count() == 0
    assert (
        db_session.query(PaperlessDocument)
        .filter(PaperlessDocument.id == doc.id)
        .count()
        == 1
    )
    r = client.get(f"{BASE}/status", headers=admin_headers)
    assert r.json()["connected"] is False
    r = client.get(f"/api/lessons/{lesson['id']}", headers=admin_headers)
    assert len(r.json()["paperless_materials"]) == 1

    # Sync without a connection → 409.
    assert client.post(f"{BASE}/sync", headers=admin_headers).status_code == 409


# --- performance hardening: incremental sync, truncation, cleanup ------------


def test_truncated_sync_is_partial_and_never_removes_documents(
    client, admin_headers, db_session, paperless_env
):
    lib = paperless_env["library"]
    fake = paperless_env["fake"]

    # A doc vanishes from a listing that also hit the page cap: it must NOT
    # be soft-deleted or purged off partial data.
    removed = lib["documents"][3]
    fake.documents = [d for d in lib["documents"] if d["id"] != removed["id"]]
    fake.truncated = True
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["truncated"] is True
    assert body["purged_count"] == 0
    db_session.expire_all()
    assert _doc_pk(db_session, removed["id"]).present is True

    status = client.get(f"{BASE}/status", headers=admin_headers).json()
    assert status["last_sync_status"] == "partial"
    assert status["last_sync_error"]

    # A later complete sync recovers: absence detection and cleanup resume.
    fake.truncated = False
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["truncated"] is False
    assert r.json()["purged_count"] == 1
    db_session.expire_all()
    assert _doc_row(db_session, removed["id"]) is None
    status = client.get(f"{BASE}/status", headers=admin_headers).json()
    assert status["last_sync_status"] == "ok"
    assert not status["last_sync_error"]


def test_sync_fetches_ocr_content_only_for_changed_documents(
    client, admin_headers, db_session, paperless_env
):
    lib = paperless_env["library"]
    fake = paperless_env["fake"]

    # The initial connect fetched content once, for every (new) document.
    assert len(fake.content_id_requests) == 1
    assert set(fake.content_id_requests[0]) == {d["id"] for d in lib["documents"]}

    # Steady state: nothing changed, so a re-sync downloads no OCR content.
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert len(fake.content_id_requests) == 1

    # One document's server-side `modified` moves: only that one refetches.
    doc = lib["documents"][0]
    doc["modified"] = "2026-07-12T08:00:00Z"
    doc["content"] = "brand new fraction drills"
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert fake.content_id_requests[-1] == [doc["id"]]
    db_session.expire_all()
    assert "drills" in _doc_pk(db_session, doc["id"]).keywords

    # Unchanged again (modified stamp kept) → still no refetch.
    requests_before = len(fake.content_id_requests)
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert len(fake.content_id_requests) == requests_before


def test_cleanup_purges_unattached_absent_docs_and_their_thumbnails(
    client, admin_headers, db_session, paperless_env
):
    from app.models.paperless import PaperlessThumbnail

    lib = paperless_env["library"]
    fake = paperless_env["fake"]
    attached = _doc_pk(db_session, lib["documents"][0]["id"])
    unattached = _doc_pk(db_session, lib["documents"][1]["id"])
    link_ids = [attached.id, unattached.id]  # survive the rows' deletion

    r = client.post(
        "/api/lessons/",
        json={"title": "Cleanup lesson", "date": "2026-07-12"},
        headers=admin_headers,
    )
    lesson = r.json()["lesson"]
    r = client.post(
        f"{BASE}/lessons/{lesson['id']}/materials",
        json={"document_id": attached.id},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text

    # Cache both thumbnails.
    for doc in (attached, unattached):
        r = client.get(f"{BASE}/documents/{doc.external_id}/thumbnail")
        assert r.status_code == 200, r.text
    assert (
        db_session.query(PaperlessThumbnail)
        .filter(PaperlessThumbnail.document_id.in_(link_ids))
        .count()
        == 2
    )

    # Both vanish from the server; sync prunes.
    gone = {attached.paperless_id, unattached.paperless_id}
    fake.documents = [d for d in lib["documents"] if d["id"] not in gone]
    r = client.post(f"{BASE}/sync", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["purged_count"] == 1

    db_session.expire_all()
    # Attached doc: soft-deleted but kept (snapshots/detail need the row) —
    # its thumbnail bytes are dropped.
    kept = _doc_pk(db_session, lib["documents"][0]["id"])
    assert kept.present is False
    # Unattached doc: hard-deleted along with its thumbnail.
    assert _doc_row(db_session, lib["documents"][1]["id"]) is None
    assert (
        db_session.query(PaperlessThumbnail)
        .filter(PaperlessThumbnail.document_id.in_(link_ids))
        .count()
        == 0
    )


def test_documents_list_pagination_window(client, admin_headers, paperless_env):
    r = client.get(f"{BASE}/documents?limit=3&offset=0", headers=admin_headers)
    assert r.status_code == 200, r.text
    first = r.json()
    assert first["total"] == 4
    assert len(first["items"]) == 3

    r = client.get(f"{BASE}/documents?limit=3&offset=3", headers=admin_headers)
    assert r.status_code == 200, r.text
    second = r.json()
    assert second["total"] == 4
    assert len(second["items"]) == 1
    assert not {i["id"] for i in first["items"]} & {i["id"] for i in second["items"]}
    # Facets always describe the whole present library, not the page.
    assert sum(second["facets"]["kinds"].values()) == 4
