"""Paged list APIs; existing array endpoints remain compatible."""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dual_auth import (
    AuthUser,
    is_admin_user,
    is_student_user,
    require_admin_or_student_self_or_permission,
    require_user_or_permission,
)
from app.crud.assignment_reads import (
    T,
    A,
    template_projection,
    template_stats,
    assignment_base,
    assignment_projection,
    assignment_summary,
    scoped_filters,
    tab_predicates,
    term_filter,
    after_date,
    encode_cursor,
    decode_cursor,
)
from app.models.user import User
from app.models.term import Term

from app.utils.request_performance import record_rows

router = APIRouter()


@router.get("/templates/page")
def template_page(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser, Depends(require_user_or_permission("assignments:read"))
    ],
    subject_id: int | None = None,
    search: str | None = Query(None, max_length=200),
    assignment_type: str | None = None,
    archived: bool = False,
    include_one_offs: bool = False,
    with_stats: bool = True,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None, max_length=1024),
):
    query = template_projection(db).filter(T.is_archived.is_(archived))
    if isinstance(auth_user, User) and not is_admin_user(auth_user):
        query = query.filter(T.created_by == auth_user.id)
    if not include_one_offs:
        query = query.filter(T.is_library.is_(True))
    if subject_id is not None:
        query = query.filter(T.subject_id == subject_id)
    if assignment_type:
        query = query.filter(T.assignment_type == assignment_type)
    if search:
        pattern = (
            "%"
            + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            + "%"
        )
        query = query.filter(
            or_(
                T.name.ilike(pattern, escape="\\"),
                T.description.ilike(pattern, escape="\\"),
            )
        )
    total = query.with_entities(func.count(T.id)).scalar()
    name = func.lower(T.name)
    if cursor:
        value, row_id = decode_cursor(cursor)
        if value is None:
            raise HTTPException(422, "Invalid page cursor")
        query = query.filter(or_(name > value, (name == value) & (T.id > row_id)))
    # Return the database-normalized key; Python lower() can differ by locale.
    rows = (
        query.add_columns(name.label("sort_name"))
        .order_by(name, T.id)
        .limit(limit + 1)
        .all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    record_rows(len(rows))
    stats = template_stats(db, [r.id for r in rows]) if with_stats else {}
    items = []
    for row in rows:
        item = dict(row._mapping)
        item.pop("sort_name")
        item["is_summary"] = True
        if with_stats:
            item.update(
                stats.get(
                    row.id,
                    dict(total_assigned=0, active_assigned=0, average_grade=None),
                )
            )
        items.append(item)
    return dict(
        items=items,
        total=total,
        next_cursor=(
            encode_cursor(rows[-1].sort_name, rows[-1].id) if has_more else None
        ),
    )


@router.get("/page")
def assignment_page(
    db: Annotated[Session, Depends(get_db)],
    auth_user: Annotated[
        AuthUser,
        Depends(require_admin_or_student_self_or_permission("assignments:read")),
    ],
    subject_id: int | None = None,
    student_id: int | None = None,
    template_id: int | None = None,
    lesson_id: int | None = None,
    term_id: int | None = None,
    term_basis: Literal["assigned", "original_due", "effective"] = "effective",
    student_view: bool = False,
    active_students: bool = False,
    effective_due: bool = False,
    today: date | None = None,
    tab: Literal[
        "all",
        "open",
        "to_grade",
        "graded",
        "excused",
        "todo",
        "submitted",
        "done",
        "needs",
        "overdue",
        "awaiting",
        "queue_all",
        "review",
    ] = "all",
    due_from: date | None = None,
    due_to: date | None = None,
    include_undated: bool = False,
    sort: Literal["due", "recent"] = "due",
    search: str | None = Query(None, max_length=200),
    assignment_type: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None, max_length=1024),
):
    if is_student_user(auth_user):
        if student_id is not None and student_id != auth_user.id:
            raise HTTPException(403, "Students can only view their own assignments")
        student_id = auth_user.id
        student_view = True
    query = scoped_filters(
        assignment_base(db, active_students=active_students),
        subject_id=subject_id,
        student_id=student_id,
        template_id=template_id,
        search=search,
        assignment_type=assignment_type,
    )
    if lesson_id is not None:
        query = query.filter(A.lesson_id == lesson_id)
    due = (
        func.coalesce(A.extended_due_date, A.due_date)
        if student_view or effective_due
        else A.due_date
    )
    if due_from and due_to and due_from > due_to:
        raise HTTPException(422, "Start date must be on or before end date")
    if due_from:
        query = query.filter(
            or_(due >= due_from, due.is_(None)) if include_undated else due >= due_from
        )
    if due_to:
        query = query.filter(
            or_(due <= due_to, due.is_(None)) if include_undated else due <= due_to
        )
    predicates = tab_predicates(today)
    if term_id is not None:
        term = db.query(Term).filter(Term.id == term_id).first()
        if term is None:
            raise HTTPException(404, "Term not found")
        if student_view:
            # Student tabs historically show all open work; only Done uses term.
            predicates["done"] = predicates["done"] & term_filter(term, term_basis)
        else:
            query = query.filter(term_filter(term, term_basis))
    counts_row = query.with_entities(
        *(
            func.count(A.id).filter(predicate).label(key)
            for key, predicate in predicates.items()
        )
    ).one()
    counts = dict(counts_row._mapping)
    query = query.filter(predicates[tab])
    if sort == "recent":
        ordering = func.coalesce(A.updated_at, A.created_at)
        if cursor:
            stamp, row_id = decode_cursor(cursor)
            try:
                stamp = datetime.fromisoformat(stamp)
            except (TypeError, ValueError):
                raise HTTPException(422, "Invalid recent-work cursor") from None
            query = query.filter(
                or_(ordering < stamp, (ordering == stamp) & (A.id < row_id))
            )
        order_by = (ordering.desc(), A.id.desc())
    else:
        ordering = due
        if cursor:
            query = query.filter(after_date(cursor, due))
        order_by = (due.asc().nullslast(), A.id)
    rows = (
        assignment_projection(query, include_feedback=student_view)
        .add_columns(ordering.label("sort_date"))
        .order_by(*order_by)
        .limit(limit + 1)
        .all()
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    record_rows(len(rows))
    return dict(
        items=[assignment_summary(row) for row in rows],
        counts=counts,
        total=counts[tab],
        next_cursor=(
            encode_cursor(rows[-1].sort_date, rows[-1].id) if has_more else None
        ),
    )
