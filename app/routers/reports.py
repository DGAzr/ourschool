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

"""APIs for reports."""
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import reports as crud_reports
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.reports import (
    AcademicYear,
    AdminReport,
    AssignmentReport,
    BulkAttendanceReport,
    ReportCard,
    StudentAttendanceReport,
    StudentProgress,
    StudentReport,
    SubjectPerformance,
    TermGrade,
)

router = APIRouter()


@router.get("/student/overview", response_model=StudentReport)
def get_student_report(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retrieve a report of the current student's academic progress."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud_reports.get_student_report(db, current_user.id)


@router.get("/admin/overview", response_model=AdminReport)
def get_admin_report(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retrieve a system-wide academic report for administrators."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud_reports.get_admin_report(db)


@router.get("/student/term-grades", response_model=List[TermGrade])
def get_student_term_grades(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retrieve the current student's grades for each term and subject."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud_reports.get_student_term_grades(db, current_user.id)


@router.get("/student/subject-performance", response_model=List[SubjectPerformance])
def get_student_subject_performance(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retrieve the current student's academic performance by subject."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud_reports.get_student_subject_performance(db, current_user.id)


@router.get("/admin/student-progress", response_model=List[StudentProgress])
def get_all_students_progress(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    term_id: Optional[int] = None,
):
    """Retrieve the academic progress for all students."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud_reports.get_all_students_progress(db, term_id=term_id)


# Attendance Report Endpoints


@router.get("/academic-years", response_model=List[AcademicYear])
def get_academic_years(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all available academic years from terms."""
    return crud_reports.get_academic_years(db)


@router.get("/attendance/student/{student_id}", response_model=StudentAttendanceReport)
def get_student_attendance_report(
    student_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: Optional[date] = Query(None, description="Start date for the report"),
    end_date: Optional[date] = Query(None, description="End date for the report"),
    academic_year: Optional[str] = Query(None, description="Academic year (optional)"),
):
    """
    Get detailed attendance report for a specific student.

    Students can only view their own reports.
    Admins can view reports for their students.
    """
    # Authorization check
    if current_user.role == UserRole.STUDENT:
        if current_user.id != student_id:
            raise HTTPException(
                status_code=403,
                detail="Students can only view their own attendance reports",
            )
    elif current_user.role == UserRole.ADMIN:
        # Admins can access reports for any student in homeschool context
        student = (
            db.query(User)
            .filter(
                User.id == student_id,
                User.role == UserRole.STUDENT,
            )
            .first()
        )
        if not student:
            raise HTTPException(
                status_code=404, detail="Student not found"
            )
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        return crud_reports.get_student_attendance_report(
            db, student_id, start_date, end_date, academic_year
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/attendance/bulk", response_model=BulkAttendanceReport)
def get_bulk_attendance_report(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    start_date: Optional[date] = Query(None, description="Start date for the report"),
    end_date: Optional[date] = Query(None, description="End date for the report"),
    academic_year: Optional[str] = Query(None, description="Academic year (optional)"),
):
    """
    Get attendance report for all students (admin only).

    Useful for compliance reporting.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only administrators can access bulk attendance reports",
        )

    return crud_reports.get_bulk_attendance_report(
        db, start_date, end_date, academic_year
    )


@router.get("/admin/assignments", response_model=AssignmentReport)
def get_assignment_report(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    subject_id: Optional[int] = Query(None, description="Filter by subject ID"),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    term_id: Optional[int] = Query(None, description="Filter by term ID"),
    status: Optional[str] = Query(None, description="Filter by assignment status"),
):
    """Get comprehensive assignment report for administrators."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can access assignment reports"
        )

    return crud_reports.get_assignment_report(
        db, subject_id, student_id, term_id, status
    )


@router.get("/report-card/{student_id}/{term_id}", response_model=ReportCard)
def get_report_card(
    student_id: int,
    term_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """
    Generate a comprehensive report card for a student for a specific term.

    Students can only view their own report cards.
    Admins can view report cards for their students.
    """
    # Authorization check
    if current_user.role == UserRole.STUDENT:
        if current_user.id != student_id:
            raise HTTPException(
                status_code=403, detail="Students can only view their own report cards"
            )
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        return crud_reports.get_report_card(db, student_id, term_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e