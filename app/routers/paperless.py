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

"""Paperless-NGX integration endpoints.

Admin/teacher surface for the connection, mappings, sync, the Materials
library, and lesson/template attachments — plus two non-admin endpoints:

- The **thumbnail** route is a capability URL (unguessable document
  ``external_id``, no auth) so plain ``<img src>`` works — the app's Bearer
  token lives in localStorage and image tags can't send it. Mirrors
  ``get_shop_image``.
- The **content** proxy is session-authorized: admins always; students only
  for documents attached to an assignment template they have work from.

Kept separate from ``app/routers/integrations.py``, which is exclusively
API-key-scoped — mixing the two auth models in one file invites scoping
mistakes. Disconnecting deletes only the connection row and mapping tables;
cached documents, thumbnails and attachments survive so lessons keep
rendering (reconnecting re-syncs).
"""

import logging
import time
from typing import Annotated, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    is_student_user,
    require_admin_or_permission,
    require_user_or_permission,
)
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.lesson import Lesson, lesson_students
from app.models.paperless import (
    LessonPaperlessMaterial,
    PaperlessConnection,
    PaperlessDoctypeMap,
    PaperlessDocument,
    PaperlessTagMap,
    StudentAssignmentPaperlessMaterial,
    TemplatePaperlessMaterial,
    snapshot_fields,
)
from app.models.subject import Subject
from app.schemas.paperless import (
    DoctypeMapResponse,
    DocumentLessonUsage,
    DocumentTemplateUsage,
    PaperlessAttachRequest,
    PaperlessConnectRequest,
    PaperlessCredentials,
    PaperlessDocumentDetail,
    PaperlessDocumentFacets,
    PaperlessDocumentItem,
    PaperlessDocumentListResponse,
    PaperlessMaterialResponse,
    PaperlessScopeOptionsResponse,
    PaperlessSettingsUpdate,
    PaperlessStatusResponse,
    PaperlessSyncResponse,
    PaperlessTestResponse,
    TagMapResponse,
)
from app.services import paperless_client, paperless_ranking, paperless_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations/paperless", tags=["paperless"])


def _mask_token(token: str) -> str:
    return "••••••••" + token[-4:] if len(token) >= 4 else "••••••••"


def _normalize_scope(ids) -> list:
    """Sorted unique ints — canonical storage form for scope id lists."""
    return sorted({int(i) for i in ids or []})


def _get_connection_or_409(db: Session) -> PaperlessConnection:
    conn = paperless_sync.get_connection(db)
    if conn is None:
        raise HTTPException(status_code=409, detail="Paperless-NGX is not connected")
    return conn


def _paperless_http_error(exc: paperless_client.PaperlessError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=str(exc))


def _status_response(db: Session) -> PaperlessStatusResponse:
    conn = paperless_sync.get_connection(db)
    if conn is None:
        return PaperlessStatusResponse(connected=False)

    token_masked = None
    needs_reconnect = False
    try:
        token_masked = _mask_token(crypto.decrypt_secret(conn.token_encrypted))
    except crypto.SecretDecryptError:
        needs_reconnect = True

    tag_maps = (
        db.query(PaperlessTagMap).order_by(PaperlessTagMap.paperless_tag_name).all()
    )
    doctype_maps = (
        db.query(PaperlessDoctypeMap)
        .order_by(PaperlessDoctypeMap.paperless_doctype_name)
        .all()
    )
    # The mapping cards only show rows inside the sync scope (all rows stay
    # in the DB so manual mappings survive scope changes).
    tag_scope = set(conn.scope_tag_ids or [])
    if tag_scope:
        tag_maps = [m for m in tag_maps if m.paperless_tag_id in tag_scope]
    doctype_scope = set(conn.scope_doctype_ids or [])
    if doctype_scope:
        doctype_maps = [
            m for m in doctype_maps if m.paperless_doctype_id in doctype_scope
        ]
    mapped_subject_count = len(
        {m.subject_id for m in tag_maps if m.subject_id is not None}
    )
    return PaperlessStatusResponse(
        connected=not needs_reconnect,
        needs_reconnect=needs_reconnect,
        url=conn.url,
        token_masked=token_masked,
        auto_import=conn.auto_import,
        index_ocr=conn.index_ocr,
        mapped_only=conn.mapped_only,
        last_sync_at=conn.last_sync_at,
        last_sync_status=conn.last_sync_status,
        last_sync_error=conn.last_sync_error,
        document_count=conn.document_count,
        tag_count=conn.tag_count,
        doctype_count=conn.doctype_count,
        mapped_subject_count=mapped_subject_count,
        scope_tag_ids=conn.scope_tag_ids or [],
        scope_doctype_ids=conn.scope_doctype_ids or [],
        tag_maps=[TagMapResponse.model_validate(m) for m in tag_maps],
        doctype_maps=[DoctypeMapResponse.model_validate(m) for m in doctype_maps],
    )


# --- Connection management -------------------------------------------------


@router.post("/test", response_model=PaperlessTestResponse)
def test_connection(
    credentials: PaperlessCredentials,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Validate credentials against the server without saving anything."""
    try:
        with paperless_client.create_client(
            credentials.url, credentials.token
        ) as client:
            counts = client.test()
    except paperless_client.PaperlessError as exc:
        raise _paperless_http_error(exc)
    return PaperlessTestResponse(**counts)


@router.post("/connect", response_model=PaperlessStatusResponse)
def connect(
    credentials: PaperlessConnectRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Validate, store the connection (token encrypted), and run a first sync.

    The request's sync scope always overwrites the stored one — a reconnect
    takes whatever the picker sent, never a stale scope.
    """
    try:
        with paperless_client.create_client(
            credentials.url, credentials.token
        ) as client:
            client.test()

            conn = paperless_sync.get_connection(db)
            if conn is None:
                conn = PaperlessConnection(
                    url=credentials.url,
                    token_encrypted=crypto.encrypt_secret(credentials.token),
                )
                db.add(conn)
            else:
                conn.url = credentials.url
                conn.token_encrypted = crypto.encrypt_secret(credentials.token)
            conn.scope_tag_ids = _normalize_scope(credentials.scope_tag_ids)
            conn.scope_doctype_ids = _normalize_scope(credentials.scope_doctype_ids)
            db.flush()

            paperless_sync.sync_all(db, conn, client)
    except paperless_client.PaperlessError as exc:
        raise _paperless_http_error(exc)
    return _status_response(db)


@router.get("/scope-options", response_model=PaperlessScopeOptionsResponse)
def get_scope_options(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Live tag/doctype lists for editing the sync scope after connect."""
    conn = _get_connection_or_409(db)
    try:
        with paperless_sync.client_for(conn) as client:
            counts = client.test()
    except crypto.SecretDecryptError:
        raise HTTPException(
            status_code=409,
            detail="Stored Paperless token can no longer be decrypted; reconnect required.",
        )
    except paperless_client.PaperlessError as exc:
        raise _paperless_http_error(exc)
    return PaperlessScopeOptionsResponse(
        tags=counts["tags"], document_types=counts["document_types"]
    )


@router.get("/status", response_model=PaperlessStatusResponse)
def get_status(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:read"))
    ],
):
    """Connection status, counts, toggles and mappings."""
    return _status_response(db)


@router.patch("/settings", response_model=PaperlessStatusResponse)
def update_settings(
    update: PaperlessSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Update toggles and/or remap tags/doctypes.

    A remapped tag flips ``auto_matched`` off (sync will never overwrite it
    again) and cached documents re-derive their subject/kind. Attachment
    snapshots are deliberately left as-is. A scope change (like the toggles)
    takes effect on the next sync — no Paperless I/O happens here.
    """
    conn = _get_connection_or_409(db)

    if update.auto_import is not None:
        conn.auto_import = update.auto_import
    if update.index_ocr is not None:
        conn.index_ocr = update.index_ocr
    if update.mapped_only is not None:
        conn.mapped_only = update.mapped_only
    if update.scope_tag_ids is not None:
        conn.scope_tag_ids = _normalize_scope(update.scope_tag_ids)
    if update.scope_doctype_ids is not None:
        conn.scope_doctype_ids = _normalize_scope(update.scope_doctype_ids)

    mappings_changed = False
    if update.tag_maps:
        rows = {m.paperless_tag_id: m for m in db.query(PaperlessTagMap).all()}
        for change in update.tag_maps:
            row = rows.get(change.paperless_tag_id)
            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Unknown Paperless tag id {change.paperless_tag_id}",
                )
            if change.subject_id is not None and not db.get(Subject, change.subject_id):
                raise HTTPException(
                    status_code=404,
                    detail=f"Subject {change.subject_id} not found",
                )
            row.subject_id = change.subject_id
            row.auto_matched = False
            mappings_changed = True

    if update.doctype_maps:
        rows = {m.paperless_doctype_id: m for m in db.query(PaperlessDoctypeMap).all()}
        for change in update.doctype_maps:
            row = rows.get(change.paperless_doctype_id)
            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "Unknown Paperless document type id "
                        f"{change.paperless_doctype_id}"
                    ),
                )
            row.material_kind = change.material_kind
            mappings_changed = True

    if mappings_changed:
        paperless_sync.rederive_documents(db)
    db.commit()
    return _status_response(db)


@router.delete("/connection", status_code=204)
def disconnect(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Remove the connection and mapping tables.

    Cached documents, thumbnails and lesson/template attachments survive so
    everything keeps rendering from cache; reconnecting re-syncs.
    """
    conn = _get_connection_or_409(db)
    db.query(PaperlessTagMap).delete()
    db.query(PaperlessDoctypeMap).delete()
    db.delete(conn)
    db.commit()
    return Response(status_code=204)


@router.post("/sync", response_model=PaperlessSyncResponse)
def sync_now(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Synchronous full metadata sync ("Sync now")."""
    conn = _get_connection_or_409(db)
    started = time.monotonic()
    try:
        with paperless_sync.client_for(conn) as client:
            counts = paperless_sync.sync_all(db, conn, client)
    except crypto.SecretDecryptError:
        raise HTTPException(
            status_code=409,
            detail="Stored Paperless token can no longer be decrypted; reconnect required.",
        )
    except paperless_client.PaperlessError as exc:
        raise _paperless_http_error(exc)
    return PaperlessSyncResponse(
        **counts,
        last_sync_at=conn.last_sync_at,
        duration_ms=int((time.monotonic() - started) * 1000),
    )


# --- Documents ---------------------------------------------------------------


def _lesson_usage_counts(db: Session) -> dict:
    """document_id → number of lessons it is attached to."""
    rows = (
        db.query(
            LessonPaperlessMaterial.document_id,
            func.count(LessonPaperlessMaterial.id),
        )
        .group_by(LessonPaperlessMaterial.document_id)
        .all()
    )
    return dict(rows)


def _document_item(
    doc: PaperlessDocument,
    used_in_count: int,
    match_pct: Optional[int] = None,
    attached: Optional[bool] = None,
) -> PaperlessDocumentItem:
    item = PaperlessDocumentItem.model_validate(doc)
    item.used_in_count = used_in_count
    item.match_pct = match_pct
    item.attached = attached
    return item


# Python-side ranking loads its candidates into memory; bound that set so a
# huge library can't make every picker request O(library). The newest docs
# plus everything in the lesson's subject is a superset of anything the
# ranker would place highly.
RANK_CANDIDATE_LIMIT = 1000


@router.get("/documents", response_model=PaperlessDocumentListResponse)
def list_documents(
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:read"))
    ],
    subject_id: Annotated[Optional[List[int]], Query()] = None,
    kind: Annotated[Optional[List[str]], Query()] = None,
    q: Optional[str] = None,
    lesson_id: Optional[int] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 500,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Filtered, optionally lesson-ranked list of cached documents.

    Facet counts are computed over all present documents (unfiltered) so the
    rail always shows the full library shape. With ``lesson_id`` the items
    carry ``match_pct``/``attached`` and are sorted by match score.
    """
    if lesson_id is not None:
        # Best-effort freshness for picker/suggestions, after the response —
        # a stale cache must never add sync latency to a picker request.
        background_tasks.add_task(paperless_sync.refresh_in_background)

    base = db.query(PaperlessDocument).filter(PaperlessDocument.present.is_(True))

    filtered = base
    if subject_id:
        filtered = filtered.filter(PaperlessDocument.subject_id.in_(subject_id))
    if kind:
        filtered = filtered.filter(PaperlessDocument.material_kind.in_(kind))
    if q:
        needle = f"%{q.strip()}%"
        filtered = filtered.filter(
            or_(
                PaperlessDocument.title.ilike(needle),
                PaperlessDocument.keywords.ilike(needle),
                PaperlessDocument.correspondent.ilike(needle),
            )
        )

    usage = _lesson_usage_counts(db)

    # Facets over the whole present library (cheap group-bys).
    kind_facets = dict(
        db.query(PaperlessDocument.material_kind, func.count(PaperlessDocument.id))
        .filter(PaperlessDocument.present.is_(True))
        .group_by(PaperlessDocument.material_kind)
        .all()
    )
    subject_facets = {
        str(sid): count
        for sid, count in db.query(
            PaperlessDocument.subject_id, func.count(PaperlessDocument.id)
        )
        .filter(
            PaperlessDocument.present.is_(True),
            PaperlessDocument.subject_id.isnot(None),
        )
        .group_by(PaperlessDocument.subject_id)
        .all()
    }
    facets = PaperlessDocumentFacets(kinds=kind_facets, subjects=subject_facets)

    if lesson_id is not None:
        lesson = db.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(status_code=404, detail="Lesson not found")
        attached_ids = {
            link.document_id
            for link in db.query(LessonPaperlessMaterial)
            .filter(LessonPaperlessMaterial.lesson_id == lesson_id)
            .all()
        }
        newest_first = filtered.order_by(
            PaperlessDocument.paperless_added.desc().nullslast(),
            PaperlessDocument.id.desc(),
        )
        docs = newest_first.limit(RANK_CANDIDATE_LIMIT).all()
        if len(docs) == RANK_CANDIDATE_LIMIT and lesson.subject_id is not None:
            # Cap hit: top up with the lesson's subject so its docs always
            # rank, however old they are.
            have = {d.id for d in docs}
            subject_docs = (
                newest_first.filter(PaperlessDocument.subject_id == lesson.subject_id)
                .limit(RANK_CANDIDATE_LIMIT)
                .all()
            )
            docs.extend(d for d in subject_docs if d.id not in have)
        ranked = paperless_ranking.rank_documents(
            docs, lesson.subject_id, lesson.title, lesson.objective
        )
        total = len(ranked)
        window = ranked[offset : offset + limit]
        items = [
            _document_item(
                doc,
                usage.get(doc.id, 0),
                match_pct=pct,
                attached=doc.id in attached_ids,
            )
            for doc, _raw, pct in window
        ]
        return PaperlessDocumentListResponse(total=total, items=items, facets=facets)

    total = filtered.count()
    docs = (
        filtered.order_by(
            PaperlessDocument.paperless_added.desc().nullslast(),
            PaperlessDocument.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = [_document_item(doc, usage.get(doc.id, 0)) for doc in docs]
    return PaperlessDocumentListResponse(total=total, items=items, facets=facets)


@router.get("/documents/{document_id}", response_model=PaperlessDocumentDetail)
def get_document(
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:read"))
    ],
):
    """Document detail + lesson/template usage (detail drawer)."""
    doc = db.get(PaperlessDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    lesson_links = (
        db.query(LessonPaperlessMaterial, Lesson)
        .join(Lesson, LessonPaperlessMaterial.lesson_id == Lesson.id)
        .filter(LessonPaperlessMaterial.document_id == doc.id)
        .order_by(Lesson.date.desc())
        .all()
    )
    template_links = (
        db.query(TemplatePaperlessMaterial, AssignmentTemplate)
        .join(
            AssignmentTemplate,
            TemplatePaperlessMaterial.template_id == AssignmentTemplate.id,
        )
        .filter(TemplatePaperlessMaterial.document_id == doc.id)
        .order_by(AssignmentTemplate.name)
        .all()
    )

    detail = PaperlessDocumentDetail.model_validate(doc)
    detail.used_in_count = len(lesson_links)
    detail.used_in = [
        DocumentLessonUsage(
            lesson_id=lesson.id,
            lesson_title=lesson.title,
            subject_id=lesson.subject_id,
            date=lesson.date,
        )
        for _link, lesson in lesson_links
    ]
    detail.used_in_templates = [
        DocumentTemplateUsage(template_id=template.id, template_name=template.name)
        for _link, template in template_links
    ]
    return detail


@router.get("/documents/{external_id}/thumbnail", name="get_paperless_thumbnail")
def get_thumbnail(
    external_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    """Serve a document thumbnail by capability URL (unguessable UUID; no auth).

    Lazily fetched from Paperless and cached. 404 when unknown, or when the
    thumbnail isn't cached yet and Paperless is unreachable — the frontend
    falls back to a CSS placeholder.
    """
    etag = f'"{external_id}"'
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    doc = (
        db.query(PaperlessDocument)
        .filter(PaperlessDocument.external_id == external_id)
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    result = paperless_sync.get_thumbnail(db, doc)
    if result is None:
        raise HTTPException(status_code=404, detail="Thumbnail unavailable")
    data, mime = result
    return Response(
        content=data,
        media_type=mime,
        headers={
            "Cache-Control": "private, max-age=86400",
            "ETag": etag,
        },
    )


@router.get("/documents/{document_id}/content")
def get_document_content(
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_user_or_permission("paperless:read"))
    ],
    disposition: Annotated[str, Query(pattern="^(inline|attachment)$")] = "inline",
):
    """Stream a document's content from Paperless (never cached locally).

    ``inline`` streams the PDF preview for the in-app viewer; ``attachment``
    streams the original file as a download. Admins (and permitted API keys)
    can fetch any document; a student only those attached to an assignment
    template they have work from, directly to one of their assignment
    instances, or to a lesson they are rostered on.
    """
    doc = db.get(PaperlessDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if is_student_user(auth_user):
        allowed = (
            db.query(TemplatePaperlessMaterial)
            .join(
                StudentAssignment,
                StudentAssignment.template_id == TemplatePaperlessMaterial.template_id,
            )
            .filter(
                TemplatePaperlessMaterial.document_id == doc.id,
                StudentAssignment.student_id == auth_user.id,
            )
            .first()
        )
        allowed = allowed or (
            db.query(StudentAssignmentPaperlessMaterial)
            .join(
                StudentAssignment,
                StudentAssignment.id
                == StudentAssignmentPaperlessMaterial.student_assignment_id,
            )
            .filter(
                StudentAssignmentPaperlessMaterial.document_id == doc.id,
                StudentAssignment.student_id == auth_user.id,
            )
            .first()
        )
        allowed = allowed or (
            db.query(LessonPaperlessMaterial)
            .join(
                lesson_students,
                lesson_students.c.lesson_id == LessonPaperlessMaterial.lesson_id,
            )
            .filter(
                LessonPaperlessMaterial.document_id == doc.id,
                lesson_students.c.student_id == auth_user.id,
            )
            .first()
        )
        if allowed is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "This document is not attached to any of your "
                    "assignments or lessons"
                ),
            )

    conn = _get_connection_or_409(db)
    kind = "preview" if disposition == "inline" else "download"
    try:
        upstream_client = paperless_sync.client_for(conn)
    except crypto.SecretDecryptError:
        raise HTTPException(
            status_code=409,
            detail="Stored Paperless token can no longer be decrypted; reconnect required.",
        )
    try:
        upstream = upstream_client.stream_content(doc.paperless_id, kind)
    except paperless_client.PaperlessError as exc:
        upstream_client.close()
        raise _paperless_http_error(exc)

    def iter_upstream():
        try:
            yield from upstream.iter_bytes()
        finally:
            upstream.close()
            upstream_client.close()

    media_type = upstream.headers.get("content-type", "application/pdf").split(";")[0]
    # Prefer Paperless's own filename when it sends one.
    content_disposition = upstream.headers.get("content-disposition")
    if content_disposition is None:
        safe_title = (
            "".join(
                c for c in (doc.title or "document") if c.isalnum() or c in " ._-"
            ).strip()
            or "document"
        )
        content_disposition = f'{disposition}; filename="{safe_title}.pdf"'
    elif disposition == "inline" and content_disposition.startswith("attachment"):
        content_disposition = content_disposition.replace("attachment", "inline", 1)

    return StreamingResponse(
        iter_upstream(),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )


# --- Attachments -------------------------------------------------------------

# The three attachment targets share one attach/detach flow; each entry is
# (parent model, link model, link FK column name, noun for error messages).
_ATTACH_TARGETS = {
    "lesson": (Lesson, LessonPaperlessMaterial, "lesson_id", "Lesson"),
    "template": (
        AssignmentTemplate,
        TemplatePaperlessMaterial,
        "template_id",
        "Template",
    ),
    "assignment": (
        StudentAssignment,
        StudentAssignmentPaperlessMaterial,
        "student_assignment_id",
        "Assignment",
    ),
}


def _attach_document(
    db: Session, target: str, parent_id: int, document_id: int
) -> PaperlessMaterialResponse:
    """Validate parent + document, reject duplicates, create the snapshot link."""
    parent_model, link_model, fk_field, noun = _ATTACH_TARGETS[target]
    if db.get(parent_model, parent_id) is None:
        raise HTTPException(status_code=404, detail=f"{noun} not found")
    doc = db.get(PaperlessDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    existing = (
        db.query(link_model)
        .filter(
            getattr(link_model, fk_field) == parent_id,
            link_model.document_id == doc.id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Document is already attached to this {noun.lower()}",
        )
    link = link_model(
        **{fk_field: parent_id}, document_id=doc.id, **snapshot_fields(doc)
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return PaperlessMaterialResponse.model_validate(link)


def _detach_document(
    db: Session, target: str, parent_id: int, document_id: int
) -> Response:
    """Delete the attachment link; 404 when it doesn't exist."""
    _, link_model, fk_field, _ = _ATTACH_TARGETS[target]
    link = (
        db.query(link_model)
        .filter(
            getattr(link_model, fk_field) == parent_id,
            link_model.document_id == document_id,
        )
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    db.delete(link)
    db.commit()
    return Response(status_code=204)


@router.post(
    "/lessons/{lesson_id}/materials",
    response_model=PaperlessMaterialResponse,
    status_code=201,
)
def attach_to_lesson(
    lesson_id: int,
    body: PaperlessAttachRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Attach a cached document to a lesson (snapshots display fields)."""
    return _attach_document(db, "lesson", lesson_id, body.document_id)


@router.delete("/lessons/{lesson_id}/materials/{document_id}", status_code=204)
def detach_from_lesson(
    lesson_id: int,
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Detach a document from a lesson."""
    return _detach_document(db, "lesson", lesson_id, document_id)


@router.post(
    "/templates/{template_id}/materials",
    response_model=PaperlessMaterialResponse,
    status_code=201,
)
def attach_to_template(
    template_id: int,
    body: PaperlessAttachRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Attach a cached document to an assignment template (student-visible)."""
    return _attach_document(db, "template", template_id, body.document_id)


@router.delete("/templates/{template_id}/materials/{document_id}", status_code=204)
def detach_from_template(
    template_id: int,
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Detach a document from an assignment template."""
    return _detach_document(db, "template", template_id, document_id)


@router.post(
    "/student-assignments/{assignment_id}/materials",
    response_model=PaperlessMaterialResponse,
    status_code=201,
)
def attach_to_assignment(
    assignment_id: int,
    body: PaperlessAttachRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Attach a one-off document to a single assignment instance.

    Rides on top of the template's permanent materials; the assigned student
    sees both sets merged and can view/download through the content proxy.
    """
    return _attach_document(db, "assignment", assignment_id, body.document_id)


@router.delete(
    "/student-assignments/{assignment_id}/materials/{document_id}", status_code=204
)
def detach_from_assignment(
    assignment_id: int,
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Detach a one-off document from an assignment instance."""
    return _detach_document(db, "assignment", assignment_id, document_id)
