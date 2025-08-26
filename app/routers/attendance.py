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

"""APIs for attendance."""
from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger, log_business_event, log_database_operation
from app.core.error_tracking import track_error, AttendanceError
from app.models.attendance import AttendanceRecord

# Student model no longer needed - using unified User model
from app.models.user import User, UserRole
from app.routers.auth import get_current_active_user
from app.schemas.attendance import (
    AttendanceRecord as AttendanceRecordSchema,
)
from app.schemas.attendance import (
    AttendanceRecordCreate,
    AttendanceRecordUpdate,
    BulkAttendanceCreate,
)

logger = get_logger("attendance")

router = APIRouter()


@router.post("/", response_model=AttendanceRecordSchema)
def create_attendance_record(
    record: AttendanceRecordCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create a new attendance record."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can create attendance records"
        )

    # Verify the student exists
    student = (
        db.query(User)
        .filter(
            User.id == record.student_id,
            User.role == UserRole.STUDENT,
        )
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=404, detail="Student not found or access denied"
        )

    existing_record = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == record.student_id,
            AttendanceRecord.date == record.date,
        )
        .first()
    )

    if existing_record:
        raise HTTPException(
            status_code=400, detail="Attendance record already exists for this date"
        )

    db_record = AttendanceRecord(**record.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.get("/", response_model=List[AttendanceRecordSchema])
def read_attendance_records(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    student_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
):
    """Get all attendance records."""
    query = db.query(AttendanceRecord)

    if current_user.role == UserRole.ADMIN:
        # Get IDs of all active students
        student_ids = (
            db.query(User.id)
            .filter(User.role == UserRole.STUDENT, User.is_active)
        )
        query = query.filter(AttendanceRecord.student_id.in_(student_ids))
    elif current_user.role == UserRole.STUDENT:
        # Students can only see their own attendance records
        query = query.filter(AttendanceRecord.student_id == current_user.id)

    if student_id:
        query = query.filter(AttendanceRecord.student_id == student_id)
    if start_date:
        query = query.filter(AttendanceRecord.date >= start_date)
    if end_date:
        query = query.filter(AttendanceRecord.date <= end_date)

    return query.all()


@router.put("/{record_id}", response_model=AttendanceRecordSchema)
def update_attendance_record(
    record_id: int,
    record_update: AttendanceRecordUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Update an attendance record."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can update attendance records"
        )

    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    # Verify the student exists
    student = (
        db.query(User)
        .filter(
            User.id == record.student_id,
            User.role == UserRole.STUDENT,
        )
        .first()
    )
    if not student:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = record_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.post("/bulk", response_model=List[AttendanceRecordSchema])
def create_bulk_attendance_records(
    bulk_record: BulkAttendanceCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Create multiple attendance records at once."""
    log_business_event(
        "bulk_attendance_request",
        user_id=str(current_user.id),
        date=str(bulk_record.date),
        student_count=len(bulk_record.student_ids)
    )

    try:
        if current_user.role != UserRole.ADMIN:
            logger.warning(
                "Non-admin user %s attempted bulk attendance creation", current_user.id
            )
            raise HTTPException(
                status_code=403,
                detail="Only administrators can create attendance records",
            )

        logger.info("Validating students: %s", bulk_record.student_ids)

        # Verify all students exist
        students = (
            db.query(User)
            .filter(
                User.id.in_(bulk_record.student_ids),
                User.role == UserRole.STUDENT,
                User.is_active,
            )
            .all()
        )

        found_student_ids = {student.id for student in students}
        missing_student_ids = set(bulk_record.student_ids) - found_student_ids

        logger.info(
            "Found students: %s, Missing: %s", found_student_ids, missing_student_ids
        )

        if missing_student_ids:
            logger.error("Missing students: %s", missing_student_ids)
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Students with IDs {list(missing_student_ids)} not found or "
                    "access denied"
                ),
            )

        created_records = []
        errors = []

        for student_id in bulk_record.student_ids:
            logger.info("Processing student %s", student_id)

            # Double-check student still exists (to handle race conditions)
            student_exists = (
                db.query(User)
                .filter(
                    User.id == student_id,
                    User.role == UserRole.STUDENT,
                    User.is_active,
                )
                .first()
            )

            if not student_exists:
                error_msg = f"Student {student_id} no longer exists or access denied"
                logger.error(error_msg)
                errors.append(error_msg)
                continue

            # Check if record already exists for this student and date
            existing_record = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.date == bulk_record.date,
                )
                .first()
            )

            if existing_record:
                logger.info("Updating existing record for student %s", student_id)
                # Update existing record instead of creating duplicate
                existing_record.status = bulk_record.status
                if bulk_record.notes:
                    existing_record.notes = bulk_record.notes
                created_records.append(existing_record)
            else:
                logger.info("Creating new record for student %s", student_id)
                # Create new record
                db_record = AttendanceRecord(
                    student_id=student_id,
                    date=bulk_record.date,
                    status=bulk_record.status,
                    notes=bulk_record.notes,
                )
                db.add(db_record)
                created_records.append(db_record)

        if errors:
            error_detail = f"Errors occurred: {'; '.join(errors)}"
            logger.error(error_detail)
            raise HTTPException(status_code=400, detail=error_detail)

        logger.info("Committing %s attendance records", len(created_records))
        db.commit()

        # Refresh all records
        for record in created_records:
            db.refresh(record)

        logger.info(
            "Successfully created/updated %s attendance records", len(created_records)
        )
        return created_records

    except HTTPException as e:
        logger.error("HTTP Exception in bulk attendance: %s", e.detail)
        db.rollback()
        raise e
    except Exception as e:
        logger.error("Unexpected error in bulk attendance: %s", e, exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create attendance records: {e!s}"
        ) from e


@router.get("/students", response_model=List[dict])
def get_students_for_attendance(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Get all students managed by the current admin for attendance purposes."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can access this endpoint"
        )

    students = (
        db.query(User)
        .filter(
            User.role == UserRole.STUDENT,
            User.is_active,
        )
        .all()
    )

    return [
        {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "grade_level": student.grade_level,
            "email": student.email,
        }
        for student in students
    ]


@router.delete("/{record_id}")
def delete_attendance_record(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Delete an attendance record."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="Only administrators can delete attendance records"
        )

    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    # Verify the student exists
    student = (
        db.query(User)
        .filter(
            User.id == record.student_id,
            User.role == UserRole.STUDENT,
        )
        .first()
    )
    if not student:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(record)
    db.commit()
    return {"message": "Attendance record deleted successfully"}