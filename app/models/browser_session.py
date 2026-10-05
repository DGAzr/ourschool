"""Transient, revocable browser authentication state (never backup data)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.core.database import Base


class BrowserSession(Base):
    __tablename__ = "browser_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    effective_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    original_role = Column(String(20), nullable=False)
    generation = Column(Integer, nullable=False, default=0)
    started_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    pin_hash = Column(String, nullable=True)
    pin_failures = Column(Integer, nullable=False, default=0)
    pin_blocked_until = Column(DateTime(timezone=True), nullable=True)

    @property
    def is_guided(self):
        return self.original_user_id != self.effective_user_id
