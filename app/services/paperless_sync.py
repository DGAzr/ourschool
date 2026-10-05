# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""Bounded staged sync: network reads never hold a database transaction."""

from datetime import datetime, timedelta, timezone
from itertools import islice
from types import SimpleNamespace
import uuid
import logging

from sqlalchemy import select, or_, cast, text
from sqlalchemy.dialects.postgresql import insert, JSONB
from sqlalchemy.orm import Session, defer, noload

from app.core import crypto
from app.enums import MaterialKind
from app.models.paperless import (
    PaperlessConnection,
    PaperlessSyncJob,
    PaperlessSyncStage,
    PaperlessTagMap,
    PaperlessDoctypeMap,
    PaperlessDocument,
    PaperlessThumbnail,
    LessonPaperlessMaterial,
    TemplatePaperlessMaterial,
    StudentAssignmentPaperlessMaterial,
)
from app.models.subject import Subject
from app.services import paperless_client, paperless_ranking

BATCH_SIZE = 100
MAX_KEYWORDS = 2000
LEASE_SECONDS = 120


class SyncCancelled(Exception):
    """A newer configuration or lease owner superseded this job."""


def _utcnow():
    return datetime.now(timezone.utc)


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise paperless_client.PaperlessError(
            "Paperless returned an invalid document timestamp."
        ) from exc


def _as_utc(value):
    if value is None:
        return None
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def get_connection(db: Session):
    return db.get(PaperlessConnection, 1)


def mapping_options_ready(conn):
    return (
        conn.mapping_scope_tag_ids is not None
        and conn.mapping_scope_doctype_ids is not None
        and sorted(set(conn.scope_tag_ids or [])) == conn.mapping_scope_tag_ids
        and sorted(set(conn.scope_doctype_ids or [])) == conn.mapping_scope_doctype_ids
    )


def client_for(conn):
    client = paperless_client.create_client(
        conn.url, crypto.decrypt_secret(conn.token_encrypted)
    )
    if isinstance(client, paperless_client.PaperlessClient):
        client.api_version = conn.api_version
        client._client.headers["Accept"] = (
            f"application/json; version={conn.api_version}"
        )
    return client


def _default_kind(name):
    for needles, kind in (
        (("worksheet",), MaterialKind.WORKSHEET),
        (("test", "quiz", "exam"), MaterialKind.TEST),
        (("textbook", "reading", "book"), MaterialKind.READING),
        (("reference",), MaterialKind.REFERENCE),
        (("form",), MaterialKind.FORM),
    ):
        if any(word in name.lower() for word in needles):
            return kind.value
    return MaterialKind.OTHER.value


def _extract_keywords(content):
    return " ".join(sorted(paperless_ranking.words(content))[:MAX_KEYWORDS]) or None


def _subject_for_tags(tag_ids, tag_map):
    return next((tag_map[t] for t in tag_ids or [] if tag_map.get(t) is not None), None)


def _iter_scoped_documents(client, conn):
    if not conn.scope_tag_ids and not conn.scope_doctype_ids:
        yield from client.iter_documents(with_content=False)
        return
    seen = set()
    streams = []
    if conn.scope_tag_ids:
        streams.append(
            client.iter_documents(with_content=False, tag_ids=conn.scope_tag_ids)
        )
    if conn.scope_doctype_ids:
        streams.append(
            client.iter_documents(
                with_content=False, doctype_ids=conn.scope_doctype_ids
            )
        )
    for stream in streams:
        for payload in stream:
            if payload["id"] not in seen:
                seen.add(payload["id"])
                yield payload


def _guard(db, job_id, owner):
    # Lock connection before job everywhere to avoid deadlocks with settings.
    conn = db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    job = (
        db.query(PaperlessSyncJob)
        .filter_by(id=job_id)
        .populate_existing()
        .with_for_update()
        .one()
    )
    if (
        conn is None
        or conn.library_id != job.library_id
        or conn.revision != job.revision
        or job.state != "running"
        or job.owner != owner
        or _as_utc(job.lease_until) < _utcnow()
    ):
        raise SyncCancelled()
    job.lease_until = _utcnow() + timedelta(seconds=LEASE_SECONDS)
    return conn, job


def _stage(db, job_id, owner, kind, rows, processed):
    _, job = _guard(db, job_id, owner)
    if rows:
        statement = insert(PaperlessSyncStage).values(
            [
                {"job_id": job_id, "kind": kind, "upstream_id": p["id"], "payload": p}
                for p in rows
            ]
        )
        db.execute(
            statement.on_conflict_do_update(
                index_elements=["job_id", "kind", "upstream_id"],
                set_={"payload": statement.excluded.payload},
            )
        )
    job.phase = kind
    job.processed = processed
    db.commit()


def sync_all(db, conn, client, job_id, owner):
    """Stage the entire inventory, then atomically publish a complete generation."""
    config = SimpleNamespace(
        **{
            key: getattr(conn, key)
            for key in (
                "library_id",
                "index_ocr",
                "mapped_only",
                "scope_tag_ids",
                "scope_doctype_ids",
            )
        }
    )
    tags_old = {
        m.paperless_tag_id: (m.subject_id, m.auto_matched)
        for m in db.query(PaperlessTagMap).filter_by(library_id=config.library_id)
    }
    kinds_old = {
        m.paperless_doctype_id: m.material_kind
        for m in db.query(PaperlessDoctypeMap).filter_by(library_id=config.library_id)
    }
    subjects = {s.name.strip().lower(): s.id for s in db.query(Subject)}
    db.commit()
    tags = list(client.iter_tags())
    tag_map = {}
    for tag in tags:
        old = tags_old.get(tag["id"])
        tag["subject_id"] = (
            old[0] if old and not old[1] else subjects.get(tag["name"].strip().lower())
        )
        tag["auto_matched"] = old[1] if old else True
        tag_map[tag["id"]] = tag["subject_id"]
    for start in range(0, len(tags), BATCH_SIZE):
        _stage(db, job_id, owner, "tags", tags[start : start + BATCH_SIZE], 0)
    _stage(db, job_id, owner, "tags", [], 0)
    doctypes = list(client.iter_document_types())
    kind_map = {}
    for dtype in doctypes:
        dtype["material_kind"] = kinds_old.get(
            dtype["id"], _default_kind(dtype["name"])
        )
        kind_map[dtype["id"]] = dtype["material_kind"]
    for start in range(0, len(doctypes), BATCH_SIZE):
        _stage(db, job_id, owner, "doctypes", doctypes[start : start + BATCH_SIZE], 0)
    _stage(db, job_id, owner, "doctypes", [], 0)
    correspondents = {c["id"]: c["name"] for c in client.iter_correspondents()}
    _stage(db, job_id, owner, "documents", [], 0)
    stream = iter(_iter_scoped_documents(client, config))
    processed = 0
    ocr_count = 0
    scoped_tag_ids, scoped_doctype_ids = set(), set()
    while batch := list(islice(stream, BATCH_SIZE)):
        # Availability comes from Sync Scope, not the mapped-only import subset.
        for payload in batch:
            scoped_tag_ids.update(payload.get("tags") or [])
            if payload.get("document_type") is not None:
                scoped_doctype_ids.add(payload["document_type"])
        ids = [p["id"] for p in batch]
        old = {
            r.paperless_id: r
            for r in db.query(PaperlessDocument)
            .options(noload(PaperlessDocument.subject))
            .filter(
                PaperlessDocument.library_id == config.library_id,
                PaperlessDocument.paperless_id.in_(ids),
            )
        }
        # Copy lean attributes before releasing the transaction. OCR keywords
        # are fetched only for changed metadata that needs to retain them.
        previous_rows = {
            pid: {
                key: getattr(row, key)
                for key in (
                    "title",
                    "asn",
                    "correspondent",
                    "paperless_doctype_id",
                    "material_kind",
                    "subject_id",
                    "tag_ids",
                    "page_count",
                    "paperless_created",
                    "paperless_added",
                    "paperless_modified",
                    "ocr_indexed_at",
                    "present",
                )
            }
            for pid, row in old.items()
        }
        db.rollback()
        old = {pid: SimpleNamespace(**row) for pid, row in previous_rows.items()}
        rows, need_content = [], []
        for payload in batch:
            subject_id = _subject_for_tags(payload.get("tags"), tag_map)
            if config.mapped_only and subject_id is None:
                continue
            previous = old.get(payload["id"])
            modified = _parse_dt(payload.get("modified"))
            if modified is None:
                raise paperless_client.PaperlessError(
                    "Paperless omitted the document revision."
                )
            if config.index_ocr and (
                previous is None
                or not previous.ocr_indexed_at
                or _as_utc(modified) != _as_utc(previous.paperless_modified)
            ):
                need_content.append(payload["id"])
            rows.append(
                {
                    "id": payload["id"],
                    "title": payload.get("title") or f"Document {payload['id']}",
                    "asn": (
                        str(payload["archive_serial_number"])
                        if payload.get("archive_serial_number") is not None
                        else None
                    ),
                    "correspondent": correspondents.get(payload.get("correspondent")),
                    "paperless_doctype_id": payload.get("document_type"),
                    "material_kind": kind_map.get(
                        payload.get("document_type"), MaterialKind.OTHER.value
                    ),
                    "subject_id": subject_id,
                    "tag_ids": payload.get("tags") or [],
                    "page_count": payload.get("page_count"),
                    **{
                        f"paperless_{key}": (
                            _as_utc(_parse_dt(payload.get(key))).isoformat()
                            if payload.get(key)
                            else None
                        )
                        for key in ("created", "added", "modified")
                    },
                    "keywords": None,
                    "ocr_indexed_at": (
                        previous.ocr_indexed_at.isoformat()
                        if previous and previous.ocr_indexed_at
                        else None
                    ),
                }
            )
        needs_keywords = []
        for index, row in enumerate(rows):
            previous = old.get(row["id"])
            if (
                previous
                and _as_utc(previous.paperless_modified)
                != _as_utc(_parse_dt(row["paperless_modified"]))
                and not config.index_ocr
            ):
                row["ocr_indexed_at"] = None
            metadata_changed = (
                previous is None
                or not previous.present
                or any(
                    (
                        _as_utc(_parse_dt(value)) != _as_utc(getattr(previous, key))
                        if key.startswith("paperless_")
                        and key
                        in (
                            "paperless_created",
                            "paperless_added",
                            "paperless_modified",
                        )
                        or key == "ocr_indexed_at"
                        else value != getattr(previous, key)
                    )
                    for key, value in row.items()
                    if key not in ("id", "keywords")
                )
            )
            if not metadata_changed and row["id"] not in need_content:
                rows[index] = {"id": row["id"], "unchanged": True}
            elif previous and row["id"] not in need_content:
                needs_keywords.append(row["id"])
        if needs_keywords:
            keywords = dict(
                db.query(PaperlessDocument.paperless_id, PaperlessDocument.keywords)
                .filter(
                    PaperlessDocument.library_id == config.library_id,
                    PaperlessDocument.paperless_id.in_(needs_keywords),
                )
                .all()
            )
            for row in rows:
                if row["id"] in keywords:
                    row["keywords"] = keywords[row["id"]]
            db.rollback()
        if need_content:
            _stage(db, job_id, owner, "ocr", [], processed)
            content = {
                p["id"]: p.get("content")
                for p in client.iter_documents_content(need_content)
            }
            if set(content) != set(need_content):
                raise paperless_client.PaperlessError(
                    "Paperless did not return all requested OCR documents."
                )
            for row in rows:
                if row["id"] in content:
                    row["keywords"] = _extract_keywords(content[row["id"]])
                    row["ocr_indexed_at"] = _utcnow().isoformat()
            ocr_count += len(need_content)
        processed += len(rows)
        _stage(db, job_id, owner, "documents", rows, processed)
    conn, job = _guard(db, job_id, owner)
    if getattr(client, "truncated", False):
        raise paperless_client.PaperlessError(
            "Paperless inventory exceeded the page limit. Narrow the scope; no cached documents were removed."
        )
    # Promotion contains no network I/O. Mapping edits and disconnects serialize here.
    for model in (PaperlessTagMap, PaperlessDoctypeMap):
        db.query(model).filter_by(library_id=config.library_id).update(
            {"in_scope": False}, synchronize_session="fetch"
        )
    for kind, model, identity, columns in (
        ("tags", PaperlessTagMap, "paperless_tag_id", ("subject_id", "auto_matched")),
        ("doctypes", PaperlessDoctypeMap, "paperless_doctype_id", ("material_kind",)),
    ):
        for stage in db.query(PaperlessSyncStage).filter_by(job_id=job_id, kind=kind):
            p = stage.payload
            row = (
                db.query(model)
                .filter_by(library_id=config.library_id, **{identity: p["id"]})
                .first()
            )
            if row is None:
                row = model(library_id=config.library_id, **{identity: p["id"]})
                db.add(row)
            setattr(row, identity.replace("_id", "_name"), p["name"])
            row.in_scope = p["id"] in (
                scoped_tag_ids if kind == "tags" else scoped_doctype_ids
            )
            for key in columns:
                setattr(row, key, p[key])
    last_id = 0
    while (
        stages := db.query(PaperlessSyncStage)
        .filter(
            PaperlessSyncStage.job_id == job_id,
            PaperlessSyncStage.kind == "documents",
            PaperlessSyncStage.upstream_id > last_id,
        )
        .order_by(PaperlessSyncStage.upstream_id)
        .limit(BATCH_SIZE)
        .all()
    ):
        values = []
        for stage in stages:
            p = dict(stage.payload)
            if p.pop("unchanged", False):
                continue
            p["paperless_id"] = p.pop("id")
            p.update(
                library_id=config.library_id,
                external_id=str(uuid.uuid4()),
                present=True,
                synced_at=_utcnow(),
            )
            for key in (
                "paperless_created",
                "paperless_added",
                "paperless_modified",
                "ocr_indexed_at",
            ):
                p[key] = _parse_dt(p[key])
            values.append(p)
        if values:
            statement = insert(PaperlessDocument).values(values)
            columns = [
                k
                for k in values[0]
                if k not in ("library_id", "external_id", "paperless_id", "synced_at")
            ]
            changed = or_(
                *(
                    (
                        cast(PaperlessDocument.tag_ids, JSONB).is_distinct_from(
                            cast(statement.excluded.tag_ids, JSONB)
                        )
                        if k == "tag_ids"
                        else getattr(PaperlessDocument, k).is_distinct_from(
                            getattr(statement.excluded, k)
                        )
                    )
                    for k in columns
                )
            )
            updated = (
                db.execute(
                    statement.on_conflict_do_update(
                        index_elements=["library_id", "paperless_id"],
                        set_={
                            k: getattr(statement.excluded, k)
                            for k in columns + ["synced_at"]
                        },
                        where=changed,
                    ).returning(PaperlessDocument.id)
                )
                .scalars()
                .all()
            )
            # Any revised metadata may reflect a changed file, invalidate its thumbnail.
            if updated:
                db.query(PaperlessThumbnail).filter(
                    PaperlessThumbnail.document_id.in_(updated)
                ).delete(synchronize_session=False)
        last_id = stages[-1].upstream_id
        for stage in stages:
            db.expunge(stage)
    seen_ids = select(PaperlessSyncStage.upstream_id).where(
        PaperlessSyncStage.job_id == job_id, PaperlessSyncStage.kind == "documents"
    )
    db.query(PaperlessDocument).filter(
        PaperlessDocument.library_id == config.library_id,
        PaperlessDocument.present.is_(True),
        ~PaperlessDocument.paperless_id.in_(seen_ids),
    ).update({"present": False}, synchronize_session=False)
    # Drain the GIN pending list before publishing. Otherwise a completed bulk
    # import makes every reader scan megabytes of pending terms until vacuum.
    db.execute(text("SELECT gin_clean_pending_list('idx_paperless_search_terms')"))
    purged = _purge_absent(db, config.library_id)
    now = _utcnow()
    conn.last_sync_at = conn.last_success_at = now
    conn.last_sync_status, conn.last_sync_error = "ok", None
    conn.mapping_scope_tag_ids = sorted(set(config.scope_tag_ids or []))
    conn.mapping_scope_doctype_ids = sorted(set(config.scope_doctype_ids or []))
    conn.needs_reconnect = False
    conn.document_count, conn.tag_count, conn.doctype_count = (
        processed,
        len(tags),
        len(doctypes),
    )
    conn.next_sync_at = (
        now + timedelta(minutes=conn.sync_interval_minutes)
        if conn.auto_import
        else None
    )
    job.state, job.phase, job.finished_at = "ok", "complete", now
    job.counts = dict(
        document_count=processed,
        tag_count=len(tags),
        doctype_count=len(doctypes),
        purged_count=purged,
        ocr_document_count=ocr_count,
        duration_ms=round((now - _as_utc(job.started_at)).total_seconds() * 1000),
        upstream_requests=getattr(client, "request_count", 0),
        upstream_bytes=getattr(client, "response_bytes", 0),
    )
    db.query(PaperlessSyncStage).filter_by(job_id=job_id).delete(
        synchronize_session=False
    )
    db.commit()
    logging.getLogger(__name__).info(
        "Paperless sync complete", extra={"job_id": job.id, **job.counts}
    )
    return job.counts


def _purge_absent(db, library_id):
    absent = select(PaperlessDocument.id).where(
        PaperlessDocument.library_id == library_id, PaperlessDocument.present.is_(False)
    )
    db.query(PaperlessThumbnail).filter(
        PaperlessThumbnail.document_id.in_(absent)
    ).delete(synchronize_session=False)
    return (
        db.query(PaperlessDocument)
        .filter(
            PaperlessDocument.library_id == library_id,
            PaperlessDocument.present.is_(False),
            ~PaperlessDocument.id.in_(select(LessonPaperlessMaterial.document_id)),
            ~PaperlessDocument.id.in_(select(TemplatePaperlessMaterial.document_id)),
            ~PaperlessDocument.id.in_(
                select(StudentAssignmentPaperlessMaterial.document_id)
            ),
        )
        .delete(synchronize_session=False)
    )


def rederive_documents(db):
    conn = get_connection(db)
    tag_map = {
        m.paperless_tag_id: m.subject_id
        for m in db.query(PaperlessTagMap).filter_by(library_id=conn.library_id)
    }
    kind_map = {
        m.paperless_doctype_id: m.material_kind
        for m in db.query(PaperlessDoctypeMap).filter_by(library_id=conn.library_id)
    }
    for row in (
        db.query(PaperlessDocument)
        .options(defer(PaperlessDocument.keywords))
        .filter_by(library_id=conn.library_id)
        .yield_per(BATCH_SIZE)
    ):
        row.subject_id = _subject_for_tags(row.tag_ids, tag_map)
        row.material_kind = kind_map.get(
            row.paperless_doctype_id, MaterialKind.OTHER.value
        )
    db.flush()


def get_thumbnail(db, document):
    cached = db.query(PaperlessThumbnail).filter_by(document_id=document.id).first()
    if cached:
        return cached.data, cached.mime_type
    conn = get_connection(db)
    if conn is None or conn.library_id != document.library_id:
        return None
    document_id, paperless_id, revision = (
        document.id,
        document.paperless_id,
        document.paperless_modified,
    )
    library_id, conn_revision = conn.library_id, conn.revision
    client = client_for(conn)
    db.rollback()  # release auth/cache connection before upstream I/O
    try:
        with client:
            data, mime = client.get_thumbnail(paperless_id)
    except paperless_client.PaperlessError:
        return None
    # Serialize cache publication with sync and settings; reject stale responses.
    current_conn = (
        db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    )
    current_doc = (
        db.query(PaperlessDocument)
        .filter_by(id=document_id)
        .populate_existing()
        .with_for_update()
        .first()
    )
    if (
        current_conn is None
        or current_conn.library_id != library_id
        or current_conn.revision != conn_revision
        or current_doc is None
        or _as_utc(current_doc.paperless_modified) != _as_utc(revision)
    ):
        db.rollback()
        return None
    statement = insert(PaperlessThumbnail).values(
        document_id=document_id, data=data, mime_type=mime
    )
    db.execute(statement.on_conflict_do_nothing(index_elements=["document_id"]))
    db.commit()
    return data, mime
