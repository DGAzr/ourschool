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

"""Cached Paperless discovery, durable sync, and authorized document access.

Library identities survive disconnects and moves. Thumbnails and content use
session/API-key authentication and the same student attachment checks.
"""

import logging
from datetime import timedelta
from urllib.parse import quote
import uuid
from collections import OrderedDict
from threading import Lock
from time import monotonic
from typing import Annotated, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
)
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from sqlalchemy import func, case, literal, String, select, union_all, text
from sqlalchemy.dialects.postgresql import array, aggregate_order_by
from sqlalchemy.orm import defer, noload
from sqlalchemy.orm import Session

from app.core import crypto
from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    is_student_user,
    is_admin_user,
    require_admin_or_permission,
    require_user_or_permission,
)
from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.lesson import Lesson, lesson_students
from app.models.paperless import (
    LessonPaperlessMaterial,
    PaperlessConnection,
    PaperlessLibrary,
    PaperlessSyncJob,
    PaperlessDoctypeMap,
    PaperlessDocument,
    PaperlessTagMap,
    StudentAssignmentPaperlessMaterial,
    TemplatePaperlessMaterial,
    snapshot_fields,
)
from app.models.subject import Subject
from app.models.user import User
from app.schemas.paperless import (
    DoctypeMapResponse,
    DocumentAssignmentUsage,
    DocumentLessonUsage,
    PaperlessDocumentAvailability,
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
    PaperlessConnectResponse,
    PaperlessJobResponse,
    PaperlessLibraryResponse,
    PaperlessBatchAttachRequest,
    PaperlessTestResponse,
    TagMapResponse,
)
from app.services import (
    paperless_client,
    paperless_ranking,
    paperless_sync,
    paperless_jobs,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations/paperless", tags=["paperless"])
_facet_cache = OrderedDict()
_facet_lock = Lock()


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
    libraries = db.query(PaperlessLibrary).order_by(PaperlessLibrary.created_at).all()
    cache_available = (
        db.query(PaperlessDocument.id).filter_by(present=True).first() is not None
    )
    if conn is None:
        return PaperlessStatusResponse(
            connected=False,
            cache_available=cache_available,
            libraries=[
                PaperlessLibraryResponse.model_validate(library)
                for library in libraries
            ],
        )
    token_masked = None
    needs_reconnect = conn.needs_reconnect
    try:
        token_masked = _mask_token(crypto.decrypt_secret(conn.token_encrypted))
    except crypto.SecretDecryptError:
        needs_reconnect = True
    tags = (
        db.query(PaperlessTagMap)
        .filter_by(library_id=conn.library_id)
        .order_by(PaperlessTagMap.paperless_tag_name)
        .all()
    )
    doctypes = (
        db.query(PaperlessDoctypeMap)
        .filter_by(library_id=conn.library_id)
        .order_by(PaperlessDoctypeMap.paperless_doctype_name)
        .all()
    )
    job = paperless_jobs.active_job(db, conn.library_id)
    return PaperlessStatusResponse(
        connected=not needs_reconnect,
        needs_reconnect=needs_reconnect,
        library_id=conn.library_id,
        libraries=[
            PaperlessLibraryResponse.model_validate(library) for library in libraries
        ],
        cache_available=cache_available,
        sync_interval_minutes=conn.sync_interval_minutes,
        api_version=conn.api_version,
        next_sync_at=conn.next_sync_at,
        last_success_at=conn.last_success_at,
        active_job=PaperlessJobResponse.model_validate(job) if job else None,
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
        mapped_subject_count=len(
            {t.subject_id for t in tags if t.subject_id is not None}
        ),
        scope_tag_ids=conn.scope_tag_ids or [],
        scope_doctype_ids=conn.scope_doctype_ids or [],
        tag_maps=[TagMapResponse.model_validate(t) for t in tags],
        doctype_maps=[DoctypeMapResponse.model_validate(d) for d in doctypes],
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
    db.rollback()
    try:
        with paperless_client.create_client(
            credentials.url, credentials.token
        ) as client:
            counts = client.test()
    except paperless_client.PaperlessError as exc:
        raise _paperless_http_error(exc)
    return PaperlessTestResponse(**counts)


@router.post("/connect", response_model=PaperlessConnectResponse, status_code=202)
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
    db.rollback()  # credential validation does not need a database connection
    try:
        with paperless_client.create_client(
            credentials.url, credentials.token
        ) as client:
            counts = client.test()
    except paperless_client.PaperlessError as exc:
        raise _paperless_http_error(exc)
    # All connection mutations serialize using one transaction-scoped advisory lock,
    # including initial installation when there is no row to lock yet.
    db.execute(func.pg_advisory_xact_lock(704221))
    conn = db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    if credentials.library_id:
        library = db.get(PaperlessLibrary, credentials.library_id)
        if library is None:
            raise HTTPException(status_code=404, detail="Library not found")
    elif conn and conn.url == credentials.url:
        library = db.get(PaperlessLibrary, conn.library_id)
    else:
        library = (
            db.query(PaperlessLibrary)
            .filter_by(url=credentials.url)
            .order_by(PaperlessLibrary.created_at.desc())
            .first()
        )
        if library is None:
            library = PaperlessLibrary(id=str(uuid.uuid4()), url=credentials.url)
            db.add(library)
            db.flush()
    library.url = credentials.url
    if conn:
        paperless_jobs.cancel_jobs(db, conn.library_id)
        conn.revision += 1
        if conn.library_id != library.id:
            conn.document_count = conn.tag_count = conn.doctype_count = 0
            conn.last_success_at = conn.last_sync_at = None
    else:
        conn = PaperlessConnection(id=1, revision=1)
        db.add(conn)
    conn.library_id, conn.url = library.id, credentials.url
    conn.token_encrypted = crypto.encrypt_secret(credentials.token)
    conn.api_version = counts.get("api_version", 10)
    conn.scope_tag_ids = _normalize_scope(credentials.scope_tag_ids)
    conn.scope_doctype_ids = _normalize_scope(credentials.scope_doctype_ids)
    conn.needs_reconnect = False
    conn.last_sync_status, conn.last_sync_error = None, None
    db.flush()
    job = paperless_jobs.enqueue(db, conn)
    db.commit()
    return PaperlessConnectResponse(
        status=_status_response(db), job=PaperlessJobResponse.model_validate(job)
    )


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
        client = paperless_sync.client_for(conn)
        db.rollback()
        with client:
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
    db.execute(func.pg_advisory_xact_lock(704221))
    conn = _get_connection_or_409(db)
    db.refresh(conn, with_for_update=True)
    paperless_jobs.cancel_jobs(db, conn.library_id)
    conn.revision += 1
    if update.sync_interval_minutes is not None:
        conn.sync_interval_minutes = update.sync_interval_minutes

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
        rows = {
            m.paperless_tag_id: m
            for m in db.query(PaperlessTagMap).filter_by(library_id=conn.library_id)
        }
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
        rows = {
            m.paperless_doctype_id: m
            for m in db.query(PaperlessDoctypeMap).filter_by(library_id=conn.library_id)
        }
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
    conn.next_sync_at = (
        paperless_sync._utcnow() + timedelta(minutes=conn.sync_interval_minutes)
        if conn.auto_import and not conn.needs_reconnect
        else None
    )
    db.commit()
    return _status_response(db)


@router.delete("/connection", status_code=204)
def disconnect(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    """Remove the connection while retaining library mappings.

    Cached documents, thumbnails and lesson/template attachments survive so
    everything keeps rendering from cache; reconnecting re-syncs.
    """
    db.execute(func.pg_advisory_xact_lock(704221))
    conn = _get_connection_or_409(db)
    db.refresh(conn, with_for_update=True)
    paperless_jobs.cancel_jobs(db, conn.library_id)
    db.delete(conn)
    db.commit()
    return Response(status_code=204)


@router.post("/sync", response_model=PaperlessJobResponse, status_code=202)
def sync_now(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    db.execute(func.pg_advisory_xact_lock(704221))
    conn = _get_connection_or_409(db)
    db.refresh(conn, with_for_update=True)
    if conn.needs_reconnect:
        raise HTTPException(
            status_code=409, detail="Reconnect Paperless before syncing"
        )
    job = paperless_jobs.enqueue(db, conn)
    db.commit()
    return PaperlessJobResponse.model_validate(job)


@router.get("/sync-jobs/{job_id}", response_model=PaperlessJobResponse)
def get_sync_job(
    job_id: str,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:read"))
    ],
):
    job = db.get(PaperlessSyncJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Sync job not found")
    return PaperlessJobResponse.model_validate(job)


# --- Documents ---------------------------------------------------------------


def _attachment_usage_counts(db, ids):
    if not ids:
        return {}
    links = union_all(
        *[
            select(model.document_id).where(model.document_id.in_(ids))
            for model in (
                LessonPaperlessMaterial,
                TemplatePaperlessMaterial,
                StudentAssignmentPaperlessMaterial,
            )
        ]
    ).subquery()
    return dict(
        db.query(links.c.document_id, func.count()).group_by(links.c.document_id).all()
    )


def _document_item(doc, used_in_count, match_reasons=None, attached=None):
    item = PaperlessDocumentItem.model_validate(doc)
    item.used_in_count = used_in_count
    item.match_reasons = match_reasons or []
    item.attached = attached
    return item


def _search_vector():
    return PaperlessDocument.search_vector


def _library_facets(base, conn):
    key = (
        (conn.library_id, conn.revision, conn.last_success_at)
        if conn and conn.last_success_at
        else None
    )
    # Small generation-keyed cache shared by all users in this process.
    # Sync, mapping edits and restore invalidate the generation; no OCR is kept.
    with _facet_lock:
        if key and key in _facet_cache:
            timestamp, facets = _facet_cache[key]
            if monotonic() - timestamp < 5:
                return facets
        kinds = dict(
            base.with_entities(
                PaperlessDocument.material_kind, func.count(PaperlessDocument.id)
            )
            .group_by(PaperlessDocument.material_kind)
            .all()
        )
        subjects = {
            str(sid): count
            for sid, count in base.with_entities(
                PaperlessDocument.subject_id, func.count(PaperlessDocument.id)
            )
            .filter(PaperlessDocument.subject_id.isnot(None))
            .group_by(PaperlessDocument.subject_id)
            .all()
        }
        if key:
            _facet_cache[key] = (monotonic(), (kinds, subjects))
            while len(_facet_cache) > 32:
                _facet_cache.popitem(last=False)
        return kinds, subjects


@router.get("/documents", response_model=PaperlessDocumentListResponse)
def list_documents(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:read"))
    ],
    subject_id: Annotated[Optional[List[int]], Query()] = None,
    kind: Annotated[Optional[List[str]], Query()] = None,
    q: Annotated[Optional[str], Query(max_length=300)] = None,
    lesson_id: Optional[int] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 60,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    conn = paperless_sync.get_connection(db)
    base = (
        db.query(PaperlessDocument)
        .options(defer(PaperlessDocument.keywords), noload(PaperlessDocument.subject))
        .filter(PaperlessDocument.present.is_(True))
    )
    if conn:
        base = base.filter(PaperlessDocument.library_id == conn.library_id)
    if (q and q.strip()) or lesson_id is not None:
        # PostgreSQL underestimates TOAST reads for large text vectors. At
        # 10k documents dense terms otherwise choose a 400ms sequential scan
        # instead of a 3ms GIN bitmap scan. Keep the setting request-local.
        db.execute(text("SET LOCAL enable_seqscan = off"))
    filtered = base
    if subject_id:
        filtered = filtered.filter(PaperlessDocument.subject_id.in_(subject_id))
    if kind:
        filtered = filtered.filter(PaperlessDocument.material_kind.in_(kind))
    if q and q.strip():
        escaped = (
            q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        # Keep each search axis independently indexed. A single OR lets the
        # planner choose the library-order index and re-read every TOAST vector.
        search_ids = (
            union_all(
                select(PaperlessDocument.id).where(
                    _search_vector().op("@@")(func.plainto_tsquery("simple", q.strip()))
                ),
                select(PaperlessDocument.id).where(
                    PaperlessDocument.title.ilike(f"%{escaped}%", escape="\\")
                ),
                select(PaperlessDocument.id).where(
                    PaperlessDocument.correspondent.ilike(f"%{escaped}%", escape="\\")
                ),
            )
            .cte("search_matches")
            .prefix_with("MATERIALIZED")
        )
        filtered = filtered.filter(PaperlessDocument.id.in_(select(search_ids.c.id)))
    total = (
        conn.document_count
        if conn
        and conn.last_success_at
        and not subject_id
        and not kind
        and not (q and q.strip())
        else filtered.count()
    )
    kind_facets, subject_facets = _library_facets(base, conn)
    attached_ids = set()
    reasons = {}
    if lesson_id is not None:
        lesson = db.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(status_code=404, detail="Lesson not found")
        attached_ids = {
            pid
            for (pid,) in db.query(LessonPaperlessMaterial.document_id).filter_by(
                lesson_id=lesson_id
            )
        }
        tokens = sorted(
            paperless_ranking.words(
                (lesson.title or "") + " " + (lesson.objective or "")
            )
        )[:32]
        match_subject = (
            PaperlessDocument.subject_id == lesson.subject_id
            if lesson.subject_id is not None
            else literal(False)
        )
        # Use GIN-backed term reads instead of loading every document's large
        # vector once per lesson word. The join retains zero-evidence rows.
        if tokens:
            term_reads = []
            for term in tokens:
                query = select(
                    PaperlessDocument.id.label("document_id"),
                    literal(term).label("term"),
                ).where(
                    PaperlessDocument.present.is_(True),
                    _search_vector().op("@@")(func.plainto_tsquery("simple", term)),
                )
                if conn:
                    query = query.where(PaperlessDocument.library_id == conn.library_id)
                term_reads.append(query)
            term_matches = union_all(*term_reads).subquery()
            evidence = (
                select(
                    term_matches.c.document_id,
                    func.count().label("hits"),
                    func.array_agg(
                        aggregate_order_by(term_matches.c.term, term_matches.c.term)
                    ).label("terms"),
                )
                .group_by(term_matches.c.document_id)
                .cte("match_evidence")
            )
            filtered = filtered.outerjoin(
                evidence, evidence.c.document_id == PaperlessDocument.id
            )
            matched = func.coalesce(evidence.c.terms, array([], type_=String))
            hit_count = func.coalesce(evidence.c.hits, 0)
        else:
            matched, hit_count = array([], type_=String), literal(0)
        score = case((match_subject, 60), else_=0) + 11 * func.least(hit_count, 4)
        rows = (
            filtered.add_columns(match_subject, matched)
            .order_by(
                score.desc(), func.lower(PaperlessDocument.title), PaperlessDocument.id
            )
            .offset(offset)
            .limit(limit)
            .all()
        )
        docs = []
        for doc, same_subject, terms in rows:
            docs.append(doc)
            reasons[doc.id] = (["Same subject"] if same_subject else []) + (
                [f"Matching terms: {', '.join(terms[:4])}"] if terms else []
            )
    else:
        docs = (
            filtered.order_by(
                PaperlessDocument.paperless_added.desc().nullslast(),
                PaperlessDocument.id.desc(),
            )
            .offset(offset)
            .limit(limit)
            .all()
        )
    usage = _attachment_usage_counts(db, [d.id for d in docs])
    items = [
        _document_item(
            d,
            usage.get(d.id, 0),
            reasons.get(d.id),
            d.id in attached_ids if lesson_id is not None else None,
        )
        for d in docs
    ]
    return PaperlessDocumentListResponse(
        total=total,
        items=items,
        facets=PaperlessDocumentFacets(kinds=kind_facets, subjects=subject_facets),
    )


@router.get("/documents/{document_id}", response_model=PaperlessDocumentDetail)
def get_document(
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:read"))
    ],
):
    """Document detail + lesson/template/student-work attachment usage."""
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

    assignment_links = (
        db.query(
            StudentAssignmentPaperlessMaterial,
            StudentAssignment,
            User,
            AssignmentTemplate,
        )
        .join(
            StudentAssignment,
            StudentAssignmentPaperlessMaterial.student_assignment_id
            == StudentAssignment.id,
        )
        .join(User, StudentAssignment.student_id == User.id)
        .join(
            AssignmentTemplate, StudentAssignment.template_id == AssignmentTemplate.id
        )
        .filter(StudentAssignmentPaperlessMaterial.document_id == doc.id)
        .order_by(User.first_name, StudentAssignment.id)
        .all()
    )

    detail = PaperlessDocumentDetail.model_validate(doc)
    detail.used_in_count = (
        len(lesson_links) + len(template_links) + len(assignment_links)
    )
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
    detail.used_in_assignments = [
        DocumentAssignmentUsage(
            assignment_id=assignment.id,
            student_name=f"{student.first_name} {student.last_name}",
            assignment_title=template.name,
        )
        for _link, assignment, student, template in assignment_links
    ]
    return detail


def _authorize_document(db, doc, auth_user):
    if isinstance(auth_user, User) and not (
        is_admin_user(auth_user) or is_student_user(auth_user)
    ):
        raise HTTPException(
            status_code=403, detail="Administrator or assigned student access required"
        )
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


@router.get(
    "/documents/{document_id}/availability",
    response_model=PaperlessDocumentAvailability,
)
def document_availability(
    document_id: int,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_user_or_permission("paperless:read"))
    ],
):
    """Describe a permitted document's connection state before opening content.

    The same attachment authorization as content access applies. This checks
    configuration, not upstream reachability, and never exposes server details.
    """
    doc = db.get(PaperlessDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    _authorize_document(db, doc, auth_user)
    if not doc.present:
        return PaperlessDocumentAvailability(
            available=False,
            reason="This document is no longer available in the library.",
        )
    conn = paperless_sync.get_connection(db)
    if conn is None or conn.library_id != doc.library_id or conn.needs_reconnect:
        return PaperlessDocumentAvailability(
            available=False,
            reason="This material's library is disconnected. Reconnect it to open or download the document.",
        )
    try:
        crypto.decrypt_secret(conn.token_encrypted)
    except crypto.SecretDecryptError:
        return PaperlessDocumentAvailability(
            available=False,
            reason="This material's library needs to be reconnected before opening documents.",
        )
    return PaperlessDocumentAvailability(available=True)


@router.get("/documents/{external_id}/thumbnail", name="get_paperless_thumbnail")
def get_thumbnail(
    external_id: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_user_or_permission("paperless:read"))
    ],
):
    """Serve a revision-aware thumbnail after checking attachment access.

    Lazily fetched from Paperless and cached. 404 when unknown, or when the
    thumbnail isn't cached yet and Paperless is unreachable — the frontend
    falls back to a CSS placeholder.
    """
    doc = (
        db.query(PaperlessDocument)
        .filter(PaperlessDocument.external_id == external_id)
        .first()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    _authorize_document(db, doc, auth_user)
    etag = f'"{external_id}:{doc.paperless_modified}"'
    headers = {
        "ETag": etag,
        "Cache-Control": "private, no-cache",
        "Vary": "Authorization",
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    try:
        result = paperless_sync.get_thumbnail(db, doc)
    except crypto.SecretDecryptError:
        result = None
    if result is None:
        raise HTTPException(status_code=404, detail="Thumbnail unavailable")
    data, mime = result
    return Response(
        content=data,
        media_type=mime,
        headers=headers,
    )


@router.get("/documents/{document_id}/content")
def get_document_content(
    document_id: int,
    request: Request,
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

    _authorize_document(db, doc, auth_user)

    conn = _get_connection_or_409(db)
    if conn.library_id != doc.library_id:
        raise HTTPException(
            status_code=409,
            detail="This material belongs to a library that is not connected",
        )
    paperless_id = doc.paperless_id
    safe_title = (
        "".join(
            c for c in (doc.title or "document") if c.isalnum() or c in " ._-"
        ).strip()
        or "document"
    )
    kind = "preview" if disposition == "inline" else "download"
    try:
        upstream_client = paperless_sync.client_for(conn)
    except crypto.SecretDecryptError:
        raise HTTPException(
            status_code=409,
            detail="Stored Paperless token can no longer be decrypted; reconnect required.",
        )
    db.rollback()  # release the authorization connection before streaming
    range_headers = {
        key: request.headers[key]
        for key in ("range", "if-range")
        if key in request.headers
    }
    if "range" in range_headers and (
        len(range_headers["range"]) > 200 or "," in range_headers["range"]
    ):
        upstream_client.close()
        raise HTTPException(status_code=416, detail="Only one byte range is supported")
    try:
        upstream = upstream_client.stream_content(
            paperless_id, kind, headers=range_headers
        )
    except paperless_client.PaperlessError as exc:
        upstream_client.close()
        raise _paperless_http_error(exc)

    def close_upstream():
        upstream.close()
        upstream_client.close()

    def iter_upstream():
        try:
            yield from upstream.iter_raw()
        finally:
            close_upstream()

    media_type = upstream.headers.get("content-type", "application/pdf").split(";")[0]
    if (
        disposition == "inline"
        and upstream.status_code != 416
        and media_type != "application/pdf"
    ):
        upstream.close()
        upstream_client.close()
        raise HTTPException(
            status_code=415,
            detail="This document has no PDF preview; download the original instead",
        )
    # Restrict upstream headers to streaming metadata and a safe filename.
    from email.message import Message

    message = Message()
    message["content-disposition"] = upstream.headers.get("content-disposition", "")
    filename = message.get_filename() or f"{safe_title}.pdf"
    filename = (
        filename.replace("\\", "/").split("/")[-1].replace("\r", "").replace("\n", "")
    )
    headers = {
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(filename)}",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    for key in (
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
        "last-modified",
        "content-encoding",
    ):
        if key in upstream.headers:
            headers[key] = upstream.headers[key]
    return StreamingResponse(
        iter_upstream(),
        status_code=upstream.status_code,
        media_type=media_type,
        headers=headers,
        background=BackgroundTask(close_upstream),
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


def _validate_attachable(db, doc):
    conn = paperless_sync.get_connection(db)
    if not doc.present or (conn and doc.library_id != conn.library_id):
        raise HTTPException(
            status_code=409, detail="This document is no longer selectable"
        )


def _attach_document(
    db: Session, target: str, parent_id: int, document_id: int
) -> PaperlessMaterialResponse:
    """Validate parent + document, reject duplicates, create the snapshot link."""
    db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    parent_model, link_model, fk_field, noun = _ATTACH_TARGETS[target]
    if db.query(parent_model).filter_by(id=parent_id).with_for_update().first() is None:
        raise HTTPException(status_code=404, detail=f"{noun} not found")
    doc = db.get(PaperlessDocument, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    _validate_attachable(db, doc)
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


@router.post(
    "/{target}/{parent_id}/materials/batch",
    response_model=List[PaperlessMaterialResponse],
)
def attach_batch(
    target: str,
    parent_id: int,
    body: PaperlessBatchAttachRequest,
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_admin_or_permission("paperless:write"))
    ],
):
    targets = {
        "lessons": "lesson",
        "templates": "template",
        "student-assignments": "assignment",
    }
    if target not in targets:
        raise HTTPException(status_code=404, detail="Attachment target not found")
    db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    parent_model, link_model, fk_field, noun = _ATTACH_TARGETS[targets[target]]
    parent = (
        db.query(parent_model)
        .filter(parent_model.id == parent_id)
        .with_for_update()
        .first()
    )
    if parent is None:
        raise HTTPException(status_code=404, detail=f"{noun} not found")
    ids = list(dict.fromkeys(body.document_ids))
    docs = {
        d.id: d
        for d in db.query(PaperlessDocument).filter(PaperlessDocument.id.in_(ids))
    }
    if len(docs) != len(ids):
        raise HTTPException(status_code=404, detail="Document not found")
    for doc in docs.values():
        _validate_attachable(db, doc)
    existing = {
        link.document_id: link
        for link in db.query(link_model).filter(
            getattr(link_model, fk_field) == parent_id, link_model.document_id.in_(ids)
        )
    }
    links = []
    for document_id in ids:
        link = existing.get(document_id)
        if link is None:
            link = link_model(
                **{fk_field: parent_id},
                document_id=document_id,
                **snapshot_fields(docs[document_id]),
            )
            db.add(link)
        links.append(link)
    db.commit()
    return [PaperlessMaterialResponse.model_validate(link) for link in links]
