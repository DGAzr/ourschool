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

"""Journal models."""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class JournalEntry(Base):
    """Journal entry model."""

    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    entry_date = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Rich fields
    mood = Column(String(20), nullable=True)
    icon = Column(String(50), nullable=True)  # Optional lucide icon name
    tags = Column(JSON, nullable=True, default=list)
    win = Column(Text, nullable=True)
    goals = Column(JSON, nullable=True, default=list)
    reactions = Column(JSON, nullable=True, default=list)
    needs_response = Column(Boolean, nullable=False, default=True)
    points_awarded = Column(Integer, nullable=True)

    # Relationships
    student = relationship(
        "User",
        back_populates="journal_entries",
        foreign_keys=[student_id],
    )
    author = relationship(
        "User",
        foreign_keys=[author_id],
    )
    replies = relationship(
        "JournalReply",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="JournalReply.created_at",
    )


class JournalReply(Base):
    """Reply to a journal entry (admin → student feedback)."""

    __tablename__ = "journal_replies"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(
        Integer,
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    text = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    entry = relationship("JournalEntry", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id])
