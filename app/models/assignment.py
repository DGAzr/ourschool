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
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
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

    __table_args__ = (
        Index("idx_assignment_templates_subject_id", "subject_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    instructions = Column(Text)
    assignment_type = Column(
        Enum(AssignmentType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=AssignmentType.HOMEWORK,
    )

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

    # Audit fields
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    is_archived = Column(Boolean, default=False, nullable=False)

    # Relationships
    # selectin avoids N+1 when iterating templates and touching .subject
    subject = relationship(
        "Subject", back_populates="assignment_templates", lazy="selectin"
    )
    creator = relationship("User", foreign_keys=[created_by])
    student_assignments = relationship(
        "StudentAssignment", back_populates="template", cascade="all, delete-orphan"
    )


class StudentAssignment(Base):
    """
    Student assignment instances.

    Created when a template is assigned to a specific student.
    They track individual student progress, grades, and completion.
    """

    __tablename__ = "student_assignments"

    __table_args__ = (
        Index("idx_student_assignments_student_assigned_date", "student_id", "assigned_date"),
        Index("idx_student_assignments_student_graded_date", "student_id", "graded_date"),
        Index("idx_student_assignments_template_id", "template_id"),
        Index("idx_student_assignments_student_id", "student_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # References
    template_id = Column(Integer, ForeignKey("assignment_templates.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Assignment details
    assigned_date = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
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
    graded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

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
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    # selectin avoids N+1 when serializing assignment lists / report cards
    template = relationship(
        "AssignmentTemplate", back_populates="student_assignments", lazy="selectin"
    )
    student = relationship(
        "User", foreign_keys=[student_id], back_populates="assigned_assignments"
    )
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    graded_by_user = relationship("User", foreign_keys=[graded_by])
    grade_history = relationship("GradeHistory", back_populates="assignment")

    @property
    def max_points(self) -> int:
        """Get the maximum points for this assignment (custom or from template)."""
        return self.custom_max_points or (self.template.max_points if self.template else 100) or 100

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
        """Update the student's term grade when this assignment is graded.

        Uses the canonical points-weighted calculation (with per-assignment-type
        weights) and buckets assignments into the term by effective due date, so
        the persisted StudentTermGrade agrees with the live report card.
        """
        if not self.is_graded or self.points_earned is None:
            return

        from app.models.term import StudentTermGrade, Term, TermSubject
        from app.crud.settings import get_assignment_type_weights
        from app.utils.grading import (
            calculate_letter_grade,
            compute_weighted_grade,
            term_membership_filter,
        )

        # Resolve the term this assignment belongs to by its effective due date,
        # so grading past/future-dated work persists to the correct term rather
        # than only the active one. Fall back to the active term if none matches.
        if self.template is None:
            return

        eff = self.extended_due_date or self.due_date or self.assigned_date
        target_term = None
        if eff is not None:
            target_term = (
                session.query(Term)
                .filter(Term.start_date <= eff, Term.end_date >= eff)
                .order_by(Term.start_date.desc())
                .first()
            )
        if target_term is None:
            target_term = session.query(Term).filter(Term.is_active).first()
        if target_term is None:
            return

        # Find (or auto-create) the term-subject relationship.
        term_subject = (
            session.query(TermSubject)
            .filter(
                TermSubject.term_id == target_term.id,
                TermSubject.subject_id == self.template.subject_id,
            )
            .first()
        )

        if not term_subject:
            term_subject = TermSubject(
                term_id=target_term.id,
                subject_id=self.template.subject_id,
            )
            session.add(term_subject)
            session.flush()

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

        # Recalculate from all assignments in this term/subject (membership by
        # effective due date), applying the same weighting as the report card.
        assignments = (
            session.query(StudentAssignment)
            .join(AssignmentTemplate)
            .filter(
                StudentAssignment.student_id == self.student_id,
                AssignmentTemplate.subject_id == self.template.subject_id,
                term_membership_filter(target_term),
            )
            .all()
        )

        graded = [
            a
            for a in assignments
            if a.points_earned is not None
            and (a.is_graded or a.status == AssignmentStatus.GRADED)
        ]
        type_weights = get_assignment_type_weights(session)
        earned, possible, percentage = compute_weighted_grade(
            (
                (
                    a.points_earned,
                    a.custom_max_points
                    or (a.template.max_points if a.template else None),
                    a.template.assignment_type if a.template else None,
                )
                for a in graded
            ),
            type_weights,
        )

        student_term_grade.current_points_earned = earned
        student_term_grade.current_points_possible = possible
        student_term_grade.assignments_completed = len(graded)
        student_term_grade.assignments_total = len(assignments)
        student_term_grade.current_percentage = (
            round(percentage, 2) if possible > 0 else None
        )
        student_term_grade.current_letter_grade = (
            calculate_letter_grade(percentage) if possible > 0 else None
        )
        student_term_grade.last_calculated = datetime.now(timezone.utc)

        # NOTE: No session.commit() here — the caller (grading router)
        # manages the transaction boundary and calls db.commit() after
        # the full operation completes.