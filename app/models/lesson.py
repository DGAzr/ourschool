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

"""Lesson models."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Subject(Base):
    """Subject model."""

    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    color = Column(String, default="#3B82F6")
    created_at = Column(DateTime, default=datetime.utcnow)

    assignment_templates = relationship("AssignmentTemplate", back_populates="subject")
    term_subjects = relationship("TermSubject", back_populates="subject")


class Lesson(Base):
    """Lesson model."""

    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    scheduled_date = Column(Date, nullable=False)
    start_time = Column(Time)
    end_time = Column(Time)
    estimated_duration_minutes = Column(
        Integer
    )  # Estimated time to complete in minutes
    materials_needed = Column(Text)
    objectives = Column(Text)
    prerequisites = Column(Text)  # What students should know before this lesson
    resources = Column(Text)  # JSON string of resources (links, files, etc.)
    lesson_order = Column(Integer, default=0)  # Order for display/organization
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assignment_templates = relationship(
        "AssignmentTemplate", back_populates="lesson", cascade="all, delete-orphan"
    )

    # New: Many-to-many with assignment templates
    lesson_assignments = relationship(
        "LessonAssignment", back_populates="lesson", cascade="all, delete-orphan"
    )

    @property
    def subjects(self):
        """Get all subjects for this lesson based on its assignments."""
        subjects = set()
        for lesson_assignment in self.lesson_assignments:
            if lesson_assignment.assignment_template and lesson_assignment.assignment_template.subject:
                subjects.add(lesson_assignment.assignment_template.subject)
        return list(subjects)

    @property
    def subject_names(self):
        """Get all subject names for this lesson as a list of strings."""
        return [subject.name for subject in self.subjects]

    @property
    def subject_colors(self):
        """Get all subject colors for this lesson."""
        return [subject.color for subject in self.subjects]

    @property
    def primary_subject(self):
        """Get the first subject (for backward compatibility)."""
        subjects = self.subjects
        return subjects[0] if subjects else None


class LessonAssignment(Base):
    """
    Junction table between Lessons and Assignment Templates with additional metadata.

    This allows lessons to include multiple assignments with specific ordering and timing.
    """

    __tablename__ = "lesson_assignments"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    assignment_template_id = Column(
        Integer, ForeignKey("assignment_templates.id"), nullable=False
    )

    # Ordering and timing within the lesson
    order_in_lesson = Column(
        Integer, default=0
    )  # Order of this assignment within the lesson
    planned_duration_minutes = Column(
        Integer
    )  # How long this assignment should take in this lesson context

    # Lesson-specific customizations
    custom_instructions = Column(
        Text
    )  # Lesson-specific instructions for this assignment
    is_required = Column(
        Boolean, default=True
    )  # Whether this assignment is required to complete the lesson
    custom_max_points = Column(
        Integer
    )  # Override the template's max points for this lesson

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    lesson = relationship("Lesson", back_populates="lesson_assignments")
    assignment_template = relationship(
        "AssignmentTemplate", back_populates="lesson_assignments"
    )