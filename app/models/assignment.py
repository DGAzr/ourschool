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

"""Assignment models."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    case,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.enums import AssignmentStatus, AssignmentType


class AssignmentTemplate(Base):
    """
    Assignment templates.

    Reusable assignment definitions that can be assigned to multiple students.
    They act as blueprints for creating student assignment instances.
    """

    __tablename__ = "assignment_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    instructions = Column(Text)
    assignment_type = Column(
        Enum(AssignmentType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=AssignmentType.HOMEWORK,
    )

    # Relationships
    lesson_id = Column(
        Integer, ForeignKey("lessons.id"), nullable=True
    )  # Can be standalone
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    # Grading information
    max_points = Column(Integer, nullable=False, default=100)

    # Metadata
    estimated_duration_minutes = Column(Integer)  # How long it should take
    prerequisites = Column(Text)  # What students should know first
    materials_needed = Column(Text)  # Required materials/resources

    # Export/Import capabilities
    is_exportable = Column(Boolean, default=True)
    export_data = Column(Text)  # JSON string for export/import

    # Ordering and organization
    order_in_lesson = Column(Integer, default=0)

    # Audit fields
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    lesson = relationship("Lesson", back_populates="assignment_templates")
    subject = relationship("Subject", back_populates="assignment_templates")
    creator = relationship("User", foreign_keys=[created_by])
    student_assignments = relationship(
        "StudentAssignment", back_populates="template", cascade="all, delete-orphan"
    )

    # New: Many-to-many with lessons
    lesson_assignments = relationship(
        "LessonAssignment",
        back_populates="assignment_template",
        cascade="all, delete-orphan",
    )


class StudentAssignment(Base):
    """
    Student assignment instances.

    Created when a template is assigned to a specific student.
    They track individual student progress, grades, and completion.
    """

    __tablename__ = "student_assignments"

    id = Column(Integer, primary_key=True, index=True)

    # References
    template_id = Column(Integer, ForeignKey("assignment_templates.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Assignment details
    assigned_date = Column(Date, nullable=False, default=datetime.utcnow().date)
    due_date = Column(Date)
    extended_due_date = Column(Date)  # If deadline is extended

    # Progress tracking
    status = Column(
        Enum(AssignmentStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=AssignmentStatus.NOT_STARTED,
    )
    started_date = Column(Date)
    completed_date = Column(Date)
    submitted_date = Column(Date)

    # Grading
    points_earned = Column(Float)  # Allow decimal points
    percentage_grade = Column(Float)  # Calculated: (points_earned / max_points) * 100
    letter_grade = Column(String)  # Optional letter grade
    is_graded = Column(Boolean, default=False)
    graded_date = Column(Date)
    graded_by = Column(Integer, ForeignKey("users.id"))

    # Feedback and notes
    teacher_feedback = Column(Text)
    student_notes = Column(Text)  # Student's own notes
    submission_notes = Column(Text)  # Notes when submitting
    submission_artifacts = Column(Text)  # JSON array of artifact links

    # Time tracking
    time_spent_minutes = Column(Integer, default=0)

    # Assignment metadata (can override template defaults)
    custom_instructions = Column(Text)  # Custom instructions for this student
    custom_max_points = Column(Integer)  # Custom point value if different from template

    # Audit fields
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    template = relationship("AssignmentTemplate", back_populates="student_assignments")
    student = relationship(
        "User", foreign_keys=[student_id], back_populates="assigned_assignments"
    )
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    graded_by_user = relationship("User", foreign_keys=[graded_by])
    grade_history = relationship("GradeHistory", back_populates="assignment")

    @property
    def max_points(self):
        """Get the maximum points for this assignment (custom or from template)."""
        return self.custom_max_points or self.template.max_points

    def calculate_percentage_grade(self):
        """Calculate and update the percentage grade."""
        if self.points_earned is not None and self.max_points > 0:
            self.percentage_grade = (self.points_earned / self.max_points) * 100
        return self.percentage_grade

    def update_status(self):
        """Update status based on current state."""
        from datetime import date

        today = date.today()
        effective_due_date = self.extended_due_date or self.due_date

        if self.is_graded:
            self.status = AssignmentStatus.GRADED
        elif self.submitted_date:
            self.status = AssignmentStatus.SUBMITTED
        elif self.started_date:
            self.status = AssignmentStatus.IN_PROGRESS
        elif effective_due_date and today > effective_due_date:
            self.status = AssignmentStatus.OVERDUE
        else:
            self.status = AssignmentStatus.NOT_STARTED

    def update_term_grade(self, session):
        """Update the student's term grade when this assignment is graded."""
        if not self.is_graded or not self.points_earned:
            return

        # Find the active term
        from app.models.term import StudentTermGrade, Term, TermSubject

        active_term = session.query(Term).filter(Term.is_active).first()
        if not active_term:
            return

        # Find the term-subject relationship
        term_subject = (
            session.query(TermSubject)
            .filter(
                TermSubject.term_id == active_term.id,
                TermSubject.subject_id == self.template.subject_id,
            )
            .first()
        )

        if not term_subject:
            return

        # Find or create the student's term grade record
        student_term_grade = (
            session.query(StudentTermGrade)
            .filter(
                StudentTermGrade.student_id == self.student_id,
                StudentTermGrade.term_subject_id == term_subject.id,
            )
            .first()
        )

        if not student_term_grade:
            student_term_grade = StudentTermGrade(
                student_id=self.student_id, term_subject_id=term_subject.id
            )
            session.add(student_term_grade)

        # Recalculate term grade based on all assignments in this term/subject
        assignment_stats = (
            session.query(
                func.sum(StudentAssignment.points_earned).label("total_earned"),
                func.sum(StudentAssignment.custom_max_points).label(
                    "total_possible_custom"
                ),
                func.count(StudentAssignment.id).label("total_assignments"),
                func.sum(case([(StudentAssignment.is_graded, 1)], else_=0)).label(
                    "graded_count"
                ),
            )
            .join(AssignmentTemplate)
            .filter(
                StudentAssignment.student_id == self.student_id,
                AssignmentTemplate.subject_id == self.template.subject_id,
                StudentAssignment.assigned_date >= active_term.start_date,
                StudentAssignment.assigned_date <= active_term.end_date,
            )
            .first()
        )

        if assignment_stats.total_earned is not None:
            # Calculate total possible points
            # (using custom points or template max points)
            total_possible = (
                session.query(
                    func.sum(
                        func.coalesce(
                            StudentAssignment.custom_max_points,
                            AssignmentTemplate.max_points,
                        )
                    )
                )
                .join(AssignmentTemplate)
                .filter(
                    StudentAssignment.student_id == self.student_id,
                    AssignmentTemplate.subject_id == self.template.subject_id,
                    StudentAssignment.assigned_date >= active_term.start_date,
                    StudentAssignment.assigned_date <= active_term.end_date,
                    StudentAssignment.is_graded,
                )
                .scalar()
                or 0
            )

            student_term_grade.current_points_earned = assignment_stats.total_earned
            student_term_grade.current_points_possible = total_possible
            student_term_grade.assignments_completed = (
                assignment_stats.graded_count or 0
            )
            student_term_grade.assignments_total = (
                assignment_stats.total_assignments or 0
            )
            student_term_grade.calculate_current_grade()

        session.commit()