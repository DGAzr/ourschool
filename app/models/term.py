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

"""Term models."""
from datetime import date, datetime

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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.enums import TermType


class Term(Base):
    """
    Terms define grading periods with flexible start/end dates.

    Each term creates a fresh grading context while preserving historical data.
    """

    __tablename__ = "terms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # e.g., "Fall 2024", "Spring Semester", "Q1"
    description = Column(Text)  # Optional description

    # Flexible date ranges
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # Academic organization
    academic_year = Column(String, nullable=False)  # e.g., "2024-2025"
    term_type = Column(
        Enum(TermType, values_callable=lambda obj: [e.value for e in obj]),
        default=TermType.CUSTOM,
    )  # semester, quarter, etc.

    # Status and ordering
    is_active = Column(Boolean, default=False)  # Only one active term at a time
    term_order = Column(Integer, default=0)  # Order within academic year

    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    term_subjects = relationship(
        "TermSubject", back_populates="term", cascade="all, delete-orphan"
    )

    def __repr__(self):
        """Return a string representation of the term."""
        return f"<Term(name='{self.name}', academic_year='{self.academic_year}')>"

    @property
    def is_current(self):
        """Check if the current date falls within this term."""
        today = date.today()
        return self.start_date <= today <= self.end_date

    def activate(self):
        """Set this term as the active term."""
        self.is_active = True


class TermSubject(Base):
    """
    Junction table linking Terms and Subjects with term-specific grading configuration.

    This allows subjects to be graded differently across terms.
    """

    __tablename__ = "term_subjects"

    __table_args__ = (
        UniqueConstraint("term_id", "subject_id", name="uq_term_subject"),
    )

    id = Column(Integer, primary_key=True, index=True)
    term_id = Column(Integer, ForeignKey("terms.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    # Term-specific subject configuration
    is_active = Column(
        Boolean, default=True
    )  # Whether this subject is taught this term
    weight = Column(Float, default=1.0)  # Weight for GPA calculation
    grading_scale = Column(
        Text
    )  # JSON: Custom grading scale for this subject in this term

    # Term-specific goals and notes
    learning_goals = Column(Text)  # What students should achieve this term
    teacher_notes = Column(Text)  # Teacher notes for this subject this term

    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    term = relationship("Term", back_populates="term_subjects")
    subject = relationship("Subject")  # Will need to update Subject model
    student_grades = relationship(
        "StudentTermGrade", back_populates="term_subject", cascade="all, delete-orphan"
    )


class StudentTermGrade(Base):
    """
    Tracks student grades for a specific subject within a specific term.

    This preserves historical grades while allowing fresh starts each term.
    """

    __tablename__ = "student_term_grades"

    __table_args__ = (
        UniqueConstraint(
            "student_id", "term_subject_id", name="uq_student_term_subject"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    term_subject_id = Column(Integer, ForeignKey("term_subjects.id"), nullable=False)

    # Current term performance
    current_points_earned = Column(Float, default=0.0)
    current_points_possible = Column(Float, default=0.0)
    current_percentage = Column(Float)  # Calculated field
    current_letter_grade = Column(String)  # A, B, C, etc.

    # Final term grades (set at term end)
    final_points_earned = Column(Float)
    final_points_possible = Column(Float)
    final_percentage = Column(Float)
    final_letter_grade = Column(String)
    is_finalized = Column(Boolean, default=False)
    finalized_date = Column(Date)
    finalized_by = Column(Integer, ForeignKey("users.id"))

    # Additional metrics
    assignments_completed = Column(Integer, default=0)
    assignments_total = Column(Integer, default=0)
    attendance_rate = Column(Float)  # Percentage of lessons attended

    # Progress tracking
    progress_notes = Column(Text)  # Teacher observations
    student_reflection = Column(Text)  # Student's self-assessment
    parent_notes = Column(Text)  # Parent feedback/concerns

    # Goals and improvement
    learning_goals = Column(Text)  # Specific goals for this student/subject/term
    areas_for_improvement = Column(Text)
    strengths = Column(Text)

    # Audit fields
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_calculated = Column(DateTime)  # When grades were last recalculated

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    term_subject = relationship("TermSubject", back_populates="student_grades")
    finalizer = relationship("User", foreign_keys=[finalized_by])

    @property
    def term(self):
        """Access the term through the term_subject relationship."""
        return self.term_subject.term if self.term_subject else None

    def calculate_current_grade(self):
        """Calculate current grade based on completed assignments."""
        if self.current_points_possible > 0:
            self.current_percentage = (
                self.current_points_earned / self.current_points_possible
            ) * 100
        else:
            self.current_percentage = None

        self.last_calculated = datetime.utcnow()
        return self.current_percentage

    def finalize_grade(self, finalizer_id):
        """Finalize the grade for the term (typically done at term end)."""
        self.final_points_earned = self.current_points_earned
        self.final_points_possible = self.current_points_possible
        self.final_percentage = self.current_percentage
        self.final_letter_grade = self.current_letter_grade
        self.is_finalized = True
        self.finalized_date = date.today()
        self.finalized_by = finalizer_id

    @property
    def completion_rate(self):
        """Percentage of assignments completed."""
        if self.assignments_total > 0:
            return (self.assignments_completed / self.assignments_total) * 100
        return 0.0


class GradeHistory(Base):
    """
    Audit trail for grade changes within a term.

    Tracks when and why grades were modified.
    """

    __tablename__ = "grade_history"

    id = Column(Integer, primary_key=True, index=True)
    student_term_grade_id = Column(
        Integer, ForeignKey("student_term_grades.id"), nullable=False
    )

    # What changed
    field_name = Column(String, nullable=False)  # e.g., "current_percentage"
    old_value = Column(String)  # Previous value as string
    new_value = Column(String)  # New value as string
    change_reason = Column(Text)  # Why the change was made

    # Who and when
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)

    # Assignment context (if the change was due to a specific assignment)
    assignment_id = Column(Integer, ForeignKey("student_assignments.id"))

    # Relationships
    student_term_grade = relationship("StudentTermGrade")
    changer = relationship("User", foreign_keys=[changed_by])
    assignment = relationship("StudentAssignment")