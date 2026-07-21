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

"""Synchronizes the local Paperless metadata cache.

``sync_all`` pulls tags, document types, correspondents and document
metadata from Paperless into the cache tables (see ``app/models/paperless``)
in one synchronous pass — there is no job queue in this app, and a
single-family library (hundreds of documents) syncs in seconds. The
"Auto-import new documents" toggle is implemented as :func:`maybe_refresh`:
an opportunistic, error-swallowing re-sync when the cache is stale.

A connection may carry a sync scope (selected tag/doctype ids, union
semantics — see :func:`_iter_scoped_documents`); documents outside it are
never fetched. Tag/doctype *maps* are still synced in full so manual
mappings survive scope changes and subject derivation works for any tag an
in-scope document carries; the router filters what the mapping UI shows.

Documents are never hard-deleted here: rows missing from Paperless (or
outside the sync scope) are flagged ``present=False`` so lesson/template
attachments can't be orphaned by a flaky sync.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session, defer

from app.core import crypto
from app.enums import MaterialKind
from app.models.paperless import (
    LessonPaperlessMaterial,
    PaperlessConnection,
    PaperlessDoctypeMap,
    PaperlessDocument,
    PaperlessTagMap,
    PaperlessThumbnail,
    StudentAssignmentPaperlessMaterial,
    TemplatePaperlessMaterial,
)
from app.models.subject import Subject
from app.services import paperless_client, paperless_ranking

logger = logging.getLogger(__name__)

# maybe_refresh() re-syncs when the last sync is older than this.
STALE_AFTER = timedelta(minutes=15)
# Cap stored keyword lists so one OCR-heavy scan can't bloat a row.
MAX_KEYWORDS = 2000

# Heuristic doctype-name → material-kind defaults applied to newly seen
# doctypes (the teacher can remap in Settings).
_KIND_HINTS = (
    (("worksheet",), MaterialKind.WORKSHEET),
    (("test", "quiz", "exam"), MaterialKind.TEST),
    (("textbook", "reading", "book"), MaterialKind.READING),
    (("reference",), MaterialKind.REFERENCE),
    (("form",), MaterialKind.FORM),
)


def get_connection(db: Session) -> Optional[PaperlessConnection]:
    """Return the configured connection row, or None when not connected."""
    return db.query(PaperlessConnection).order_by(PaperlessConnection.id).first()


def client_for(conn: PaperlessConnection):
    """Build a client for the stored connection (decrypts the token).

    Raises :class:`app.core.crypto.SecretDecryptError` when the token can no
    longer be decrypted (SECRET_KEY rotation) — callers surface that as
    "reconnect required".
    """
    token = crypto.decrypt_secret(conn.token_encrypted)
    return paperless_client.create_client(conn.url, token)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Normalize for comparison; naive values (pre-tz DBs) are assumed UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _default_kind(doctype_name: str) -> str:
    lowered = doctype_name.lower()
    for needles, kind in _KIND_HINTS:
        if any(needle in lowered for needle in needles):
            return kind.value
    return MaterialKind.OTHER.value


def _extract_keywords(content: Optional[str]) -> Optional[str]:
    """Distinct lowercased words (len > 3) from OCR text, space-joined."""
    if not content:
        return None
    word_set = paperless_ranking.words(content)
    return " ".join(sorted(word_set)[:MAX_KEYWORDS]) or None


def _sync_tags(db: Session, client) -> int:
    """Upsert tag→subject maps; auto-match new tags by subject name."""
    subjects_by_name = {s.name.strip().lower(): s.id for s in db.query(Subject).all()}
    existing = {m.paperless_tag_id: m for m in db.query(PaperlessTagMap).all()}
    count = 0
    for tag in client.iter_tags():
        count += 1
        row = existing.get(tag["id"])
        if row is None:
            row = PaperlessTagMap(
                paperless_tag_id=tag["id"],
                paperless_tag_name=tag["name"],
                subject_id=subjects_by_name.get(tag["name"].strip().lower()),
                auto_matched=True,
            )
            db.add(row)
        else:
            row.paperless_tag_name = tag["name"]
            # Re-run name matching only for rows the teacher never touched.
            if row.auto_matched:
                row.subject_id = subjects_by_name.get(tag["name"].strip().lower())
    return count


def _sync_doctypes(db: Session, client) -> int:
    """Upsert doctype→kind maps with name-based defaults for new rows."""
    existing = {m.paperless_doctype_id: m for m in db.query(PaperlessDoctypeMap).all()}
    count = 0
    for doctype in client.iter_document_types():
        count += 1
        row = existing.get(doctype["id"])
        if row is None:
            db.add(
                PaperlessDoctypeMap(
                    paperless_doctype_id=doctype["id"],
                    paperless_doctype_name=doctype["name"],
                    material_kind=_default_kind(doctype["name"]),
                )
            )
        else:
            row.paperless_doctype_name = doctype["name"]
    return count


def _subject_for_tags(tag_ids, tag_map: Dict[int, Optional[int]]) -> Optional[int]:
    """First mapped subject among the document's tags, in tag order."""
    for tag_id in tag_ids or []:
        subject_id = tag_map.get(tag_id)
        if subject_id is not None:
            return subject_id
    return None


def _iter_scoped_documents(client, conn: PaperlessConnection):
    """Yield documents inside the connection's sync scope, deduplicated.

    Union (OR) semantics: a document is in scope when it carries any scoped
    tag or its doctype is scoped. Both axes empty = the whole library (one
    unfiltered stream, the pre-scope behavior). Scoped axes are fetched as
    separate server-side-filtered streams — each with its own MAX_PAGES
    budget — and deduplicated by paperless id (a doc matching both axes is
    downloaded twice but yielded once; fine at family scale).
    """
    tag_scope = conn.scope_tag_ids or []
    doctype_scope = conn.scope_doctype_ids or []
    if not tag_scope and not doctype_scope:
        yield from client.iter_documents(with_content=False)
        return
    yielded: set = set()
    if tag_scope:
        for payload in client.iter_documents(with_content=False, tag_ids=tag_scope):
            if payload["id"] not in yielded:
                yielded.add(payload["id"])
                yield payload
    if doctype_scope:
        for payload in client.iter_documents(
            with_content=False, doctype_ids=doctype_scope
        ):
            if payload["id"] not in yielded:
                yielded.add(payload["id"])
                yield payload


def _purge_absent(db: Session) -> int:
    """Drop what soft-deleted documents no longer need; return purge count.

    Thumbnails of absent docs always go (they're re-fetched lazily if the doc
    ever comes back). Absent docs nothing links to are hard-deleted — attached
    ones stay soft-deleted so detail views and snapshots keep working.
    """
    absent_ids = select(PaperlessDocument.id).where(
        PaperlessDocument.present.is_(False)
    )
    db.query(PaperlessThumbnail).filter(
        PaperlessThumbnail.document_id.in_(absent_ids)
    ).delete(synchronize_session=False)
    return (
        db.query(PaperlessDocument)
        .filter(
            PaperlessDocument.present.is_(False),
            ~PaperlessDocument.id.in_(select(LessonPaperlessMaterial.document_id)),
            ~PaperlessDocument.id.in_(select(TemplatePaperlessMaterial.document_id)),
            ~PaperlessDocument.id.in_(
                select(StudentAssignmentPaperlessMaterial.document_id)
            ),
        )
        .delete(synchronize_session=False)
    )


_TRUNCATED_MESSAGE = (
    "Paperless reported more documents than one sync pass fetches; "
    "missing-document detection and cleanup were skipped so nothing gets "
    "removed based on a partial listing. Narrow the sync scope, or sync again."
)


def sync_all(db: Session, conn: PaperlessConnection, client) -> dict:
    """Full metadata sync. Commits on success and on recorded failure.

    The sweep itself is lean (no OCR content); with ``index_ocr`` on, content
    is fetched afterwards only for documents that are new, whose server-side
    ``modified`` moved, or that never got keywords — steady-state syncs
    transfer O(changes), not O(library).

    Returns ``{document_count, tag_count, doctype_count, purged_count,
    truncated}`` (``document_count`` is the server-side count). On a
    Paperless error the connection row records the failure and the exception
    propagates for the router to translate.
    """
    try:
        tag_count = _sync_tags(db, client)
        doctype_count = _sync_doctypes(db, client)
        db.flush()

        tag_map = {
            m.paperless_tag_id: m.subject_id for m in db.query(PaperlessTagMap).all()
        }
        kind_map = {
            m.paperless_doctype_id: m.material_kind
            for m in db.query(PaperlessDoctypeMap).all()
        }
        correspondents = {c["id"]: c["name"] for c in client.iter_correspondents()}

        # keywords is by far the widest column — defer it and track which
        # docs have it via ids only, so the sweep never loads OCR keywords.
        existing = {
            d.paperless_id: d
            for d in db.query(PaperlessDocument)
            .options(defer(PaperlessDocument.keywords))
            .all()
        }
        has_keywords = {
            pid
            for (pid,) in db.query(PaperlessDocument.paperless_id).filter(
                PaperlessDocument.keywords.isnot(None)
            )
        }
        seen: set = set()
        need_content: list = []
        document_count = 0
        for payload in _iter_scoped_documents(client, conn):
            subject_id = _subject_for_tags(payload.get("tags"), tag_map)
            if conn.mapped_only and subject_id is None:
                continue
            document_count += 1
            seen.add(payload["id"])

            doctype_id = payload.get("document_type")
            asn = payload.get("archive_serial_number")
            row = existing.get(payload["id"])
            is_new = row is None
            if is_new:
                row = PaperlessDocument(paperless_id=payload["id"], tag_ids=[])
                db.add(row)
                existing[payload["id"]] = row

            modified = _parse_dt(payload.get("modified"))
            if conn.index_ocr and (
                is_new
                or _as_utc(modified) != _as_utc(row.paperless_modified)
                or payload["id"] not in has_keywords
            ):
                need_content.append(payload["id"])

            row.title = payload.get("title") or f"Document {payload['id']}"
            row.asn = str(asn) if asn is not None else None
            row.correspondent = correspondents.get(payload.get("correspondent"))
            row.paperless_doctype_id = doctype_id
            row.material_kind = kind_map.get(doctype_id, MaterialKind.OTHER.value)
            row.subject_id = subject_id
            row.tag_ids = payload.get("tags") or []
            row.page_count = payload.get("page_count")
            row.paperless_created = _parse_dt(payload.get("created"))
            row.paperless_added = _parse_dt(payload.get("added"))
            row.paperless_modified = modified
            row.present = True
            row.synced_at = _utcnow()

        if need_content:
            for payload in client.iter_documents_content(need_content):
                row = existing.get(payload["id"])
                if row is not None:
                    row.keywords = _extract_keywords(payload.get("content"))

        purged_count = 0
        truncated = bool(getattr(client, "truncated", False))
        if truncated:
            # A capped listing must never be read as "everything else is
            # gone" — skip absence detection entirely and surface it.
            conn.last_sync_status = "partial"
            conn.last_sync_error = _TRUNCATED_MESSAGE
        else:
            # Soft-delete anything the server no longer reports (or that fell
            # out of scope via mapped_only or the sync scope), then drop what
            # absent docs no longer need.
            for paperless_id, row in existing.items():
                if paperless_id not in seen and row.present:
                    row.present = False
            db.flush()
            purged_count = _purge_absent(db)
            conn.last_sync_status = "ok"
            conn.last_sync_error = None

        conn.last_sync_at = _utcnow()
        conn.document_count = document_count
        conn.tag_count = tag_count
        conn.doctype_count = doctype_count
        db.commit()
        return {
            "document_count": document_count,
            "tag_count": tag_count,
            "doctype_count": doctype_count,
            "purged_count": purged_count,
            "truncated": truncated,
        }
    except paperless_client.PaperlessError as exc:
        db.rollback()
        conn.last_sync_at = _utcnow()
        conn.last_sync_status = "error"
        conn.last_sync_error = str(exc)
        db.commit()
        raise


def rederive_documents(db: Session) -> None:
    """Recompute cached subject/kind after a mapping change. Flushes only."""
    tag_map = {
        m.paperless_tag_id: m.subject_id for m in db.query(PaperlessTagMap).all()
    }
    kind_map = {
        m.paperless_doctype_id: m.material_kind
        for m in db.query(PaperlessDoctypeMap).all()
    }
    rows = db.query(PaperlessDocument).options(defer(PaperlessDocument.keywords))
    for row in rows:
        row.subject_id = _subject_for_tags(row.tag_ids, tag_map)
        row.material_kind = kind_map.get(
            row.paperless_doctype_id, MaterialKind.OTHER.value
        )
    db.flush()


def maybe_refresh(db: Session) -> None:
    """Opportunistic re-sync when auto_import is on and the cache is stale.

    Best-effort by design: swallows every error (a dead Paperless server
    must never break browsing the cache).
    """
    conn = get_connection(db)
    if conn is None or not conn.auto_import:
        return
    if conn.last_sync_at is not None:
        last = conn.last_sync_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if _utcnow() - last < STALE_AFTER:
            return
    try:
        with client_for(conn) as client:
            sync_all(db, conn, client)
    except Exception:  # noqa: BLE001 - best-effort refresh only
        logger.warning("Opportunistic Paperless refresh failed", exc_info=True)


def refresh_in_background() -> None:
    """:func:`maybe_refresh` as a FastAPI background task.

    Runs after the response is sent, when the request's session is already
    closed — so it opens (and always closes) its own.
    """
    from app.core import database

    if database.SessionLocal is None:
        return
    db = database.SessionLocal()
    try:
        maybe_refresh(db)
    finally:
        db.close()


def get_thumbnail(
    db: Session, document: PaperlessDocument
) -> Optional[Tuple[bytes, str]]:
    """Return cached thumbnail bytes, lazily fetching on first access.

    Returns None when the thumbnail is not cached and Paperless is
    unreachable/not connected (the frontend falls back to a CSS placeholder).
    Commits after a successful fetch so the cache write survives.
    """
    if document.thumbnail is not None:
        return document.thumbnail.data, document.thumbnail.mime_type

    conn = get_connection(db)
    if conn is None:
        return None
    try:
        with client_for(conn) as client:
            data, mime = client.get_thumbnail(document.paperless_id)
    except (paperless_client.PaperlessError, crypto.SecretDecryptError):
        return None

    db.add(PaperlessThumbnail(document_id=document.id, data=data, mime_type=mime))
    db.commit()
    return data, mime
