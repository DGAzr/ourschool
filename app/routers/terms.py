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

"""APIs for terms."""
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.term import Term
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.term import TermCreate, TermResponse, TermUpdate
from app.services.term_grading import TermGradingService

router = APIRouter()


@router.get("/", response_model=List[TermResponse])
def get_terms(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all terms."""
    return db.query(Term).order_by(Term.academic_year.desc(), Term.term_order).all()


@router.get("/active", response_model=TermResponse)
def get_active_term(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get the currently active term."""
    term = db.query(Term).filter(Term.is_active).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No active term found"
        )
    return term


@router.get("/{term_id}", response_model=TermResponse)
def get_term(
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get a specific term by ID."""
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Term not found"
        )
    return term


@router.post("/", response_model=TermResponse)
def create_term(
    term_data: TermCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new term."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create terms",
        )

    # Validate dates
    if term_data.start_date >= term_data.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date",
        )

    # Check for overlapping terms in the same academic year
    existing_term = (
        db.query(Term)
        .filter(
            Term.academic_year == term_data.academic_year,
            Term.term_order == term_data.term_order,
        )
        .first()
    )

    if existing_term:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A term with order {term_data.term_order} already exists for "
                f"academic year {term_data.academic_year}"
            ),
        )

    # Create the term
    try:
        db_term = Term(**term_data.dict(), created_by=current_user.id)

        db.add(db_term)
        db.commit()
        db.refresh(db_term)

        return db_term
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating term: {e!s}",
        ) from e


@router.put("/{term_id}", response_model=TermResponse)
def update_term(
    term_id: int,
    term_data: TermUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update a term."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update terms",
        )

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Term not found"
        )

    # Validate dates if provided
    start_date = term_data.start_date or term.start_date
    end_date = term_data.end_date or term.end_date

    if start_date >= end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date",
        )

    # Check for conflicts with term order in the same academic year
    if term_data.academic_year and term_data.term_order:
        existing_term = (
            db.query(Term)
            .filter(
                Term.academic_year == term_data.academic_year,
                Term.term_order == term_data.term_order,
                Term.id != term_id,
            )
            .first()
        )

        if existing_term:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"A term with order {term_data.term_order} already exists for "
                    f"academic year {term_data.academic_year}"
                ),
            )

    # Update the term
    update_data = term_data.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(term, field, value)

    db.commit()
    db.refresh(term)

    return term


@router.post("/{term_id}/activate", response_model=TermResponse)
def activate_term(
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Activate a term (deactivates all other terms)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can activate terms",
        )

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Term not found"
        )

    # Deactivate all other terms
    db.query(Term).update({Term.is_active: False})

    # Activate the specified term
    term.is_active = True

    db.commit()
    db.refresh(term)

    return term


@router.delete("/{term_id}")
def delete_term(
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete a term."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete terms",
        )

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Term not found"
        )

    # Check if term has associated data
    if term.term_subjects:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete term with associated subjects. Remove subjects first.",
        )

    db.delete(term)
    db.commit()

    return {"message": "Term deleted successfully"}


@router.post("/{term_id}/auto-link-subjects")
def auto_link_subjects_to_term(
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Automatically link subjects to term based on assignment completion dates."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage term subjects",
        )

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Term not found"
        )

    result = TermGradingService.auto_link_subjects_to_terms(db, term_id)
    return {
        "message": f"Successfully linked {result['subjects_linked']} subjects to term",
        "details": result,
    }


@router.post("/{term_id}/calculate-grades")
def calculate_term_grades(
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    student_id: int = None,
):
    """Calculate grades for all students (or specific student) in a term."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can calculate grades",
        )

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Term not found"
        )

    result = TermGradingService.calculate_student_term_grades(db, term_id, student_id)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"]
        )

    return {
        "message": (
            f"Calculated {result['grades_calculated']} grades for "
            f"{result['students_processed']} students"
        ),
        "details": result,
    }


@router.get("/{term_id}/grade-report")
def get_term_grade_report(
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get comprehensive grade report for a term."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view grade reports",
        )

    report = TermGradingService.get_term_grade_report(db, term_id)

    if "error" in report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=report["error"]
        )

    return report


@router.get("/{term_id}/students/{student_id}/report")
def get_student_term_report(
    term_id: int,
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get detailed grade report for a specific student in a term."""
    # Allow students to view their own reports
    if current_user.role == UserRole.STUDENT and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own reports",
        )
    if current_user.role not in (UserRole.ADMIN, UserRole.STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    report = TermGradingService.get_student_term_report(db, term_id, student_id)

    if "error" in report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=report["error"]
        )

    return report