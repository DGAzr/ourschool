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

"""Lesson planning models.

A ``Lesson`` is a single planned instructional block on a specific date. It may
link a ``Subject`` (for coloring) and an ``AssignmentTemplate`` (which drives
creation of StudentAssignments on save — see ``app.services.lesson_assignments``).
Materials and resources are ordered child lists owned by the lesson.

All FKs to subjects/templates/users use ``ondelete="SET NULL"`` so that deleting
a subject/template (or the backup wipe-and-restore, which drops
``assignment_templates``) leaves lessons intact but un-linked.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.enums import LessonStatus

# Many-to-many between lessons and the students they are planned for.
# Both sides CASCADE: removing a lesson or a student drops the pairing row.
lesson_students = Table(
    "lesson_students",
    Base.metadata,
    Column(
        "lesson_id",
        Integer,
        ForeignKey("lessons.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "student_id",
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Lesson(Base):
    """A planned instructional block for a single date."""

    __tablename__ = "lessons"

    __table_args__ = (Index("idx_lessons_date", "date"),)

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )

    # ``NULL`` means the lesson is parked in the Lesson Drawer.  The most
    # recent scheduled date is retained separately so the drawer can explain
    # where an automatically rolled-over lesson came from.
    date = Column(Date, nullable=True)
    last_scheduled_date = Column(Date, nullable=True)
    title = Column(String, nullable=False)
    objective = Column(Text)
    duration_minutes = Column(Integer)
    notes = Column(Text)

    # 0-based rank of this lesson within its ``date`` (drives board ordering).
    # Mirrors LessonMaterial/LessonResource.position.
    position = Column(Integer, default=0, nullable=False)

    status = Column(
        Enum(LessonStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=LessonStatus.PLANNED,
        nullable=False,
    )

    # SET NULL: a deleted subject/user must not delete the lesson.
    subject_id = Column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True
    )
    created_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships (selectin avoids N+1 when serializing lesson lists)
    subject = relationship("Subject", lazy="selectin")
    creator = relationship("User", foreign_keys=[created_by])
    students = relationship("User", secondary=lesson_students, lazy="selectin")
    # A lesson can link several assignment templates, each individually
    # customizable (see LessonTemplate). Replaces the old single template_id FK.
    templates = relationship(
        "LessonTemplate",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonTemplate.id",
        lazy="selectin",
    )
    materials = relationship(
        "LessonMaterial",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonMaterial.position",
        lazy="selectin",
    )
    resources = relationship(
        "LessonResource",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonResource.position",
        lazy="selectin",
    )
    # Paperless-NGX documents attached to this lesson (distinct from the
    # physical ``materials`` gather-checklist above).
    paperless_materials = relationship(
        "LessonPaperlessMaterial",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonPaperlessMaterial.id",
        lazy="selectin",
    )


class LessonTemplate(Base):
    """A linked assignment template on a lesson, with per-link overrides.

    Modeled on ``TermSubject``: a full junction model (own PK + unique
    constraint) so each lesson↔template link can carry customization that the
    sync service copies onto the StudentAssignments it creates.

    ``template_id`` is SET NULL on template delete (matching the lesson↔subject
    contract) so removing a template unlinks rather than deleting the lesson.
    """

    __tablename__ = "lessons_templates"

    __table_args__ = (
        UniqueConstraint("lesson_id", "template_id", name="uq_lesson_template"),
        Index("idx_lessons_templates_lesson_id", "lesson_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(
        Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    template_id = Column(
        Integer,
        ForeignKey("assignment_templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Per-link overrides applied to the StudentAssignments this link produces.
    # A custom_due_date is a fixed override: it does not follow the lesson date
    # when the lesson is rescheduled (the sync service enforces this).
    custom_due_date = Column(Date)
    custom_max_points = Column(Integer)
    custom_instructions = Column(Text)

    lesson = relationship("Lesson", back_populates="templates")
    template = relationship("AssignmentTemplate", lazy="selectin")


class LessonMaterial(Base):
    """A physical/printable item to gather before teaching a lesson."""

    __tablename__ = "lesson_materials"

    __table_args__ = (Index("idx_lesson_materials_lesson_id", "lesson_id"),)

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(
        Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    label = Column(String, nullable=False)
    is_gathered = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)

    lesson = relationship("Lesson", back_populates="materials")


class LessonResource(Base):
    """A reference link attached to a lesson (opened during Teach mode)."""

    __tablename__ = "lesson_resources"

    __table_args__ = (Index("idx_lesson_resources_lesson_id", "lesson_id"),)

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(
        Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    label = Column(String, nullable=False)
    url = Column(String)
    position = Column(Integer, default=0, nullable=False)

    lesson = relationship("Lesson", back_populates="resources")
