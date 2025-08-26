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

"""
CRUD operations for the points system.
"""

from typing import List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, desc, func

from app.models.points import StudentPoints, PointTransaction, SystemSettings
from app.models.user import User
from app.enums import UserRole
from app.schemas.points import (
    StudentPointsCreate,
    PointTransactionCreate,
    AdminPointAdjustment,
    SystemSettingCreate,
)


def get_system_setting(db: Session, setting_key: str) -> Optional[SystemSettings]:
    """Get a system setting by key."""
    return db.query(SystemSettings).filter(
        and_(
            SystemSettings.setting_key == setting_key,
            SystemSettings.is_active == True
        )
    ).first()


def is_points_system_enabled(db: Session) -> bool:
    """Check if the points system is enabled."""
    setting = get_system_setting(db, "points_system_enabled")
    if not setting:
        return False
    return setting.setting_value.lower() == "true"


def update_system_setting(db: Session, setting_key: str, setting_value: str) -> SystemSettings:
    """Update or create a system setting."""
    setting = get_system_setting(db, setting_key)
    if setting:
        setting.setting_value = setting_value
    else:
        setting = SystemSettings(
            setting_key=setting_key,
            setting_value=setting_value,
            setting_type="string",
            description=f"System setting for {setting_key}"
        )
        db.add(setting)
    
    db.commit()
    db.refresh(setting)
    return setting


def get_or_create_student_points(db: Session, student_id: int) -> StudentPoints:
    """Get or create a student points record."""
    student_points = db.query(StudentPoints).filter(
        StudentPoints.student_id == student_id
    ).first()
    
    if not student_points:
        student_points = StudentPoints(
            student_id=student_id,
            current_balance=0,
            total_earned=0,
            total_spent=0
        )
        db.add(student_points)
        db.commit()
        db.refresh(student_points)
    
    return student_points


def create_point_transaction(
    db: Session, 
    transaction: PointTransactionCreate, 
    admin_id: Optional[int] = None
) -> PointTransaction:
    """Create a new point transaction and update student balance."""
    # Create the transaction record
    db_transaction = PointTransaction(
        student_id=transaction.student_id,
        amount=transaction.amount,
        transaction_type=transaction.transaction_type,
        source_id=transaction.source_id,
        source_description=transaction.source_description,
        notes=transaction.notes,
        admin_id=admin_id
    )
    db.add(db_transaction)
    
    # Update student points balance
    student_points = get_or_create_student_points(db, transaction.student_id)
    student_points.current_balance += transaction.amount
    
    if transaction.amount > 0:
        student_points.total_earned += transaction.amount
    else:
        student_points.total_spent += abs(transaction.amount)
    
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def admin_adjust_points(
    db: Session, 
    adjustment: AdminPointAdjustment, 
    admin_id: int
) -> PointTransaction:
    """Admin manual point adjustment."""
    transaction_type = "admin_award" if adjustment.amount > 0 else "admin_deduction"
    
    transaction_data = PointTransactionCreate(
        student_id=adjustment.student_id,
        amount=adjustment.amount,
        transaction_type=transaction_type,
        source_description=f"Manual {'award' if adjustment.amount > 0 else 'deduction'} by admin",
        notes=adjustment.notes
    )
    
    return create_point_transaction(db, transaction_data, admin_id)


def award_assignment_points(
    db: Session, 
    student_id: int, 
    assignment_id: int,
    points_earned: int,
    assignment_title: str
) -> PointTransaction:
    """Award points for a graded assignment."""
    transaction_data = PointTransactionCreate(
        student_id=student_id,
        amount=points_earned,
        transaction_type="assignment",
        source_id=assignment_id,
        source_description=f"Assignment: {assignment_title}",
        notes=f"Earned {points_earned} points for completing assignment"
    )
    
    return create_point_transaction(db, transaction_data)


def get_student_points(db: Session, student_id: int) -> Optional[StudentPoints]:
    """Get student points with student information."""
    return db.query(StudentPoints).options(
        joinedload(StudentPoints.student)
    ).filter(StudentPoints.student_id == student_id).first()


def get_student_points_ledger(
    db: Session, 
    student_id: int, 
    page: int = 1, 
    per_page: int = 20
) -> Tuple[StudentPoints, List[PointTransaction], int]:
    """Get student points and paginated transaction history."""
    student_points = get_or_create_student_points(db, student_id)
    
    # Get total count for pagination
    total_transactions = db.query(PointTransaction).filter(
        PointTransaction.student_id == student_id
    ).count()
    
    # Get paginated transactions
    transactions = db.query(PointTransaction).options(
        joinedload(PointTransaction.admin)
    ).filter(
        PointTransaction.student_id == student_id
    ).order_by(desc(PointTransaction.created_at)).offset(
        (page - 1) * per_page
    ).limit(per_page).all()
    
    total_pages = (total_transactions + per_page - 1) // per_page
    
    return student_points, transactions, total_pages


def get_all_student_points(db: Session) -> List[StudentPoints]:
    """Get all student points with student information."""
    return db.query(StudentPoints).options(
        joinedload(StudentPoints.student)
    ).join(User).filter(User.role == UserRole.STUDENT).order_by(
        User.first_name, User.last_name
    ).all()


def get_all_students_with_points(db: Session) -> List[StudentPoints]:
    """Get all students with their points (creates zero-balance records for students without points)."""
    # Get all students
    all_students = db.query(User).filter(User.role == UserRole.STUDENT).order_by(
        User.first_name, User.last_name
    ).all()
    
    # Get existing points records
    existing_points = db.query(StudentPoints).options(
        joinedload(StudentPoints.student)
    ).all()
    
    # Create a map of student_id to existing points
    points_map = {sp.student_id: sp for sp in existing_points}
    
    # Create list with all students, using existing points or creating dummy objects
    result = []
    for student in all_students:
        if student.id in points_map:
            # Use existing points record
            student_points = points_map[student.id]
            student_points.student_name = f"{student.first_name} {student.last_name}"
            result.append(student_points)
        else:
            # Create a dummy StudentPoints object for display
            now = datetime.now(timezone.utc)
            dummy_points = StudentPoints(
                id=0,  # Dummy ID (will be ignored since this is not persisted)
                student_id=student.id,
                current_balance=0,
                total_earned=0,
                total_spent=0,
                created_at=now,
                updated_at=now
            )
            dummy_points.student = student
            dummy_points.student_name = f"{student.first_name} {student.last_name}"
            result.append(dummy_points)
    
    return result


def get_admin_points_overview(db: Session) -> dict:
    """Get overview statistics for admin dashboard."""
    # Get basic stats
    total_students_with_points = db.query(StudentPoints).count()
    total_students = db.query(User).filter(User.role == UserRole.STUDENT).count()
    
    total_earned = db.query(func.sum(StudentPoints.total_earned)).scalar() or 0
    total_spent = db.query(func.sum(StudentPoints.total_spent)).scalar() or 0
    
    # Get all students with their points (including those with zero balance)
    student_points = get_all_students_with_points(db)
    
    return {
        "total_students_with_points": total_students_with_points,
        "total_students": total_students,
        "total_points_awarded": total_earned,
        "total_points_spent": total_spent,
        "student_points": student_points
    }


def get_recent_transactions(
    db: Session, 
    student_id: int, 
    limit: int = 5
) -> List[PointTransaction]:
    """Get recent transactions for a student."""
    return db.query(PointTransaction).filter(
        PointTransaction.student_id == student_id
    ).order_by(desc(PointTransaction.created_at)).limit(limit).all()


def delete_student_points_data(db: Session, student_id: int) -> bool:
    """Delete all points data for a student (when student is deleted)."""
    try:
        # Delete transactions first (due to foreign key)
        db.query(PointTransaction).filter(
            PointTransaction.student_id == student_id
        ).delete()
        
        # Delete student points record
        db.query(StudentPoints).filter(
            StudentPoints.student_id == student_id
        ).delete()
        
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False