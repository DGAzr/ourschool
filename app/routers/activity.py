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

"""APIs for activity tracking."""
from datetime import datetime, timedelta
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_, or_

from app.core.database import get_db
from app.core.logging import get_logger, log_business_event
from app.models.user import User, UserRole
from app.models.assignment import StudentAssignment, AssignmentTemplate
from app.models.attendance import AttendanceRecord
from app.models.lesson import Lesson, LessonAssignment
from app.enums import AssignmentStatus
from app.routers.auth import get_current_active_user

logger = get_logger("activity")

router = APIRouter()


class ActivityItem:
    """Represents a single activity item."""
    
    def __init__(
        self,
        activity_type: str,
        description: str,
        timestamp: datetime,
        user_name: str = "",
        student_name: str = "",
        details: dict = None
    ):
        self.activity_type = activity_type
        self.description = description
        self.timestamp = timestamp
        self.user_name = user_name
        self.student_name = student_name
        self.details = details or {}
    
    def to_dict(self):
        """Convert to dictionary for JSON response."""
        return {
            "activity_type": self.activity_type,
            "description": self.description,
            "timestamp": self.timestamp.isoformat(),
            "user_name": self.user_name,
            "student_name": self.student_name,
            "details": self.details,
            "time_ago": self._get_time_ago()
        }
    
    def _get_time_ago(self):
        """Generate human-readable time difference."""
        now = datetime.utcnow()
        diff = now - self.timestamp
        
        if diff.days > 0:
            return f"{diff.days} day{'s' if diff.days != 1 else ''} ago"
        elif diff.seconds >= 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif diff.seconds >= 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        else:
            return "Just now"


@router.get("/recent")
def get_recent_activity(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)],
    limit: int = Query(default=10, le=50),
    days: int = Query(default=7, le=30)
):
    """Get recent activity for the current user."""
    log_business_event(
        "activity_fetch_recent",
        user_id=str(current_user.id),
        limit=limit,
        days=days
    )
    
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        activities = []
        
        if current_user.role == UserRole.ADMIN:
            # Admin sees all activity
            activities.extend(_get_assignment_activities(db, start_date, end_date))
            activities.extend(_get_attendance_activities(db, start_date, end_date))
            activities.extend(_get_lesson_activities(db, start_date, end_date))
        else:
            # Students see only their own activity
            activities.extend(_get_student_assignment_activities(db, current_user.id, start_date, end_date))
            activities.extend(_get_student_attendance_activities(db, current_user.id, start_date, end_date))
        
        # Sort by timestamp (newest first) and limit
        activities.sort(key=lambda x: x.timestamp, reverse=True)
        activities = activities[:limit]
        
        # Convert to dictionaries
        activity_dicts = [activity.to_dict() for activity in activities]
        
        logger.info(f"Retrieved {len(activity_dicts)} activities for user {current_user.id}")
        
        return {
            "activities": activity_dicts,
            "total": len(activity_dicts),
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get recent activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity")


def _get_assignment_activities(db: Session, start_date: datetime, end_date: datetime) -> List[ActivityItem]:
    """Get assignment-related activities for admin."""
    activities = []
    
    # Recent assignment submissions and grades
    assignments = (
        db.query(StudentAssignment)
        .options(
            joinedload(StudentAssignment.template),
            joinedload(StudentAssignment.student)
        )
        .filter(
            and_(
                StudentAssignment.updated_at >= start_date,
                StudentAssignment.updated_at <= end_date
            )
        )
        .order_by(desc(StudentAssignment.updated_at))
        .limit(20)
        .all()
    )
    
    for assignment in assignments:
        student_name = f"{assignment.student.first_name} {assignment.student.last_name}"
        template_name = assignment.template.name if assignment.template else "Unknown Assignment"
        
        if assignment.status == AssignmentStatus.SUBMITTED and assignment.submitted_date:
            activities.append(ActivityItem(
                activity_type="assignment_submitted",
                description=f"Assignment '{template_name}' submitted",
                timestamp=datetime.combine(assignment.submitted_date, datetime.min.time()),
                student_name=student_name,
                details={
                    "assignment_id": assignment.id,
                    "template_name": template_name,
                    "subject": assignment.template.subject.name if assignment.template and assignment.template.subject else None
                }
            ))
        
        if assignment.percentage_grade is not None and assignment.graded_date:
            activities.append(ActivityItem(
                activity_type="assignment_graded",
                description=f"Assignment '{template_name}' graded ({assignment.percentage_grade:.1f}%)",
                timestamp=datetime.combine(assignment.graded_date, datetime.min.time()),
                student_name=student_name,
                details={
                    "assignment_id": assignment.id,
                    "template_name": template_name,
                    "grade": assignment.percentage_grade,
                    "subject": assignment.template.subject.name if assignment.template and assignment.template.subject else None
                }
            ))
    
    return activities


def _get_attendance_activities(db: Session, start_date: datetime, end_date: datetime) -> List[ActivityItem]:
    """Get attendance-related activities for admin."""
    activities = []
    
    # Recent attendance records
    attendance_records = (
        db.query(AttendanceRecord)
        .options(joinedload(AttendanceRecord.student))
        .filter(
            and_(
                AttendanceRecord.date >= start_date.date(),
                AttendanceRecord.date <= end_date.date()
            )
        )
        .order_by(desc(AttendanceRecord.date))
        .limit(20)
        .all()
    )
    
    for record in attendance_records:
        student_name = f"{record.student.first_name} {record.student.last_name}"
        
        activities.append(ActivityItem(
            activity_type="attendance_recorded",
            description=f"Attendance marked as {record.status.value if hasattr(record.status, 'value') else record.status}",
            timestamp=datetime.combine(record.date, datetime.min.time()),
            student_name=student_name,
            details={
                "attendance_id": record.id,
                "status": record.status.value if hasattr(record.status, 'value') else record.status,
                "date": record.date.isoformat(),
                "notes": record.notes
            }
        ))
    
    return activities


def _get_lesson_activities(db: Session, start_date: datetime, end_date: datetime) -> List[ActivityItem]:
    """Get lesson-related activities for admin."""
    activities = []
    
    # Recent lessons
    lessons = (
        db.query(Lesson)
        .options(
            joinedload(Lesson.lesson_assignments).joinedload(LessonAssignment.assignment_template).joinedload(AssignmentTemplate.subject)
        )
        .filter(
            and_(
                Lesson.updated_at >= start_date,
                Lesson.updated_at <= end_date
            )
        )
        .order_by(desc(Lesson.updated_at))
        .limit(20)
        .all()
    )
    
    for lesson in lessons:
        activities.append(ActivityItem(
            activity_type="lesson_updated",
            description=f"Lesson '{lesson.title}' updated",
            timestamp=lesson.updated_at,
            details={
                "lesson_id": lesson.id,
                "title": lesson.title,
                "subject": lesson.primary_subject.name if lesson.primary_subject else None,
                "date": lesson.scheduled_date.isoformat() if lesson.scheduled_date else None
            }
        ))
    
    return activities


def _get_student_assignment_activities(db: Session, student_id: int, start_date: datetime, end_date: datetime) -> List[ActivityItem]:
    """Get assignment activities for a specific student."""
    activities = []
    
    # Student's recent assignments
    assignments = (
        db.query(StudentAssignment)
        .options(joinedload(StudentAssignment.template))
        .filter(
            and_(
                StudentAssignment.student_id == student_id,
                StudentAssignment.updated_at >= start_date,
                StudentAssignment.updated_at <= end_date
            )
        )
        .order_by(desc(StudentAssignment.updated_at))
        .limit(15)
        .all()
    )
    
    for assignment in assignments:
        template_name = assignment.template.name if assignment.template else "Unknown Assignment"
        
        if assignment.status == AssignmentStatus.SUBMITTED and assignment.submitted_date:
            activities.append(ActivityItem(
                activity_type="my_assignment_submitted",
                description=f"You submitted '{template_name}'",
                timestamp=datetime.combine(assignment.submitted_date, datetime.min.time()),
                details={
                    "assignment_id": assignment.id,
                    "template_name": template_name,
                    "subject": assignment.template.subject.name if assignment.template and assignment.template.subject else None
                }
            ))
        
        if assignment.percentage_grade is not None and assignment.graded_date:
            activities.append(ActivityItem(
                activity_type="my_assignment_graded",
                description=f"'{template_name}' was graded ({assignment.percentage_grade:.1f}%)",
                timestamp=datetime.combine(assignment.graded_date, datetime.min.time()),
                details={
                    "assignment_id": assignment.id,
                    "template_name": template_name,
                    "grade": assignment.percentage_grade,
                    "subject": assignment.template.subject.name if assignment.template and assignment.template.subject else None
                }
            ))
        
        if assignment.status == AssignmentStatus.NOT_STARTED and assignment.assigned_date:
            activities.append(ActivityItem(
                activity_type="my_assignment_received",
                description=f"New assignment received: '{template_name}'",
                timestamp=datetime.combine(assignment.assigned_date, datetime.min.time()),
                details={
                    "assignment_id": assignment.id,
                    "template_name": template_name,
                    "subject": assignment.template.subject.name if assignment.template and assignment.template.subject else None
                }
            ))
    
    return activities


def _get_student_attendance_activities(db: Session, student_id: int, start_date: datetime, end_date: datetime) -> List[ActivityItem]:
    """Get attendance activities for a specific student."""
    activities = []
    
    # Student's recent attendance
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(
            and_(
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.date >= start_date.date(),
                AttendanceRecord.date <= end_date.date()
            )
        )
        .order_by(desc(AttendanceRecord.date))
        .limit(10)
        .all()
    )
    
    for record in attendance_records:
        activities.append(ActivityItem(
            activity_type="my_attendance_recorded",
            description=f"Your attendance was marked as {record.status.value if hasattr(record.status, 'value') else record.status}",
            timestamp=datetime.combine(record.date, datetime.min.time()),
            details={
                "attendance_id": record.id,
                "status": record.status.value if hasattr(record.status, 'value') else record.status,
                "date": record.date.isoformat(),
                "notes": record.notes
            }
        ))
    
    return activities