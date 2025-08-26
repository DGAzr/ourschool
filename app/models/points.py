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
Points system models for tracking student point balances and transactions.

This module handles the gamification system where students earn points through:
- Completed assignments (points equal to grade score)
- Manual admin awards/deductions

Points are separate from academic grades and can be used for external rewards.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class StudentPoints(Base):
    """
    Current point balance for each student.
    
    This table maintains the running total of points for quick balance lookups.
    The actual transaction history is stored in PointTransaction.
    """
    __tablename__ = "student_points"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    current_balance = Column(Integer, default=0, nullable=False)
    total_earned = Column(Integer, default=0, nullable=False)  # Lifetime points earned
    total_spent = Column(Integer, default=0, nullable=False)   # Lifetime points spent/deducted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    student = relationship("User", back_populates="student_points")


class PointTransaction(Base):
    """
    Individual point transactions (awards, deductions, spending).
    
    This provides a complete audit trail of all point changes with context
    about what caused each transaction.
    """
    __tablename__ = "point_transactions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # Positive for awards, negative for deductions/spending
    transaction_type = Column(String(50), nullable=False, index=True)  # 'assignment', 'admin_award', 'admin_deduction', 'spending'
    source_id = Column(Integer, nullable=True)  # ID of assignment if transaction_type is 'assignment'
    source_description = Column(String(255), nullable=True)  # Brief description of the source
    notes = Column(Text, nullable=True)  # Detailed notes, especially for manual adjustments
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who made manual adjustment
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    student = relationship("User", foreign_keys=[student_id], back_populates="point_transactions")
    admin = relationship("User", foreign_keys=[admin_id])


class SystemSettings(Base):
    """
    System-wide configuration settings.
    
    Initially used for enabling/disabling the points system, but can be expanded
    for other global settings in the future.
    """
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, nullable=False, index=True)
    setting_value = Column(String(500), nullable=False)
    setting_type = Column(String(50), nullable=False)  # 'boolean', 'string', 'integer', 'json'
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())