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

"""Request-validation helpers shared across routers."""

from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.crud import assignment_types as crud_types
from app.models.paperless import PaperlessConnection, PaperlessDocument
from app.models.user import User, UserRole


def validate_students(db: Session, student_ids: List[int]) -> List[User]:
    """Resolve student ids to active STUDENT users; 404 if any are missing.

    Shared by lesson planning and assignment composition so neither surface
    can reference inactive/non-student/absent users.
    """
    if not student_ids:
        return []
    students = (
        db.query(User)
        .filter(
            User.id.in_(student_ids),
            User.role == UserRole.STUDENT,
            User.is_active,
        )
        .all()
    )
    missing = set(student_ids) - {s.id for s in students}
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"Students with IDs {sorted(missing)} not found or access denied",
        )
    return students


def validate_assignment_type(db: Session, key: str) -> None:
    """Reject template writes that reference an unknown/inactive type key."""
    type_row = crud_types.get_by_key(db, key)
    if type_row is None or not type_row.is_active:
        raise HTTPException(status_code=400, detail=f"Unknown assignment type '{key}'")


def validate_paperless_documents(
    db: Session, document_ids: List[int]
) -> List[PaperlessDocument]:
    """Resolve selectable Paperless documents for an attachment transaction."""
    if not document_ids:
        return []
    doc_ids = list(dict.fromkeys(document_ids))
    conn = db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    docs = db.query(PaperlessDocument).filter(PaperlessDocument.id.in_(doc_ids)).all()
    missing_doc_ids = set(doc_ids) - {doc.id for doc in docs}
    if missing_doc_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Paperless documents with IDs "
            f"{sorted(missing_doc_ids)} not found",
        )
    if any(
        not doc.present or (conn and doc.library_id != conn.library_id) for doc in docs
    ):
        raise HTTPException(
            status_code=409, detail="A Paperless document is no longer selectable"
        )
    return docs
