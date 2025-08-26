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
Points system Pydantic schemas for API requests and responses.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class PointTransactionBase(BaseModel):
    """Base schema for point transactions."""
    amount: int = Field(..., description="Points amount (positive for awards, negative for deductions)")
    transaction_type: str = Field(..., description="Type of transaction: 'assignment', 'admin_award', 'admin_deduction', 'spending'")
    source_id: Optional[int] = Field(None, description="Source ID (e.g., assignment ID)")
    source_description: Optional[str] = Field(None, description="Brief description of the source")
    notes: Optional[str] = Field(None, description="Detailed notes about the transaction")


class PointTransactionCreate(PointTransactionBase):
    """Schema for creating a point transaction."""
    student_id: int = Field(..., description="ID of the student receiving/losing points")


class AdminPointAdjustment(BaseModel):
    """Schema for admin manual point adjustments."""
    student_id: int = Field(..., description="ID of the student")
    amount: int = Field(..., description="Points to add (positive) or subtract (negative)")
    notes: str = Field(..., min_length=1, max_length=500, description="Reason for the adjustment")


class PointTransaction(PointTransactionBase):
    """Schema for point transaction responses."""
    id: int
    student_id: int
    admin_id: Optional[int] = None
    created_at: datetime
    
    # Related data
    student_name: Optional[str] = None
    admin_name: Optional[str] = None

    class Config:
        from_attributes = True


class StudentPointsBase(BaseModel):
    """Base schema for student points."""
    current_balance: int = Field(default=0, description="Current point balance")
    total_earned: int = Field(default=0, description="Total points earned lifetime")
    total_spent: int = Field(default=0, description="Total points spent/deducted lifetime")


class StudentPointsCreate(StudentPointsBase):
    """Schema for creating student points record."""
    student_id: int


class StudentPoints(StudentPointsBase):
    """Schema for student points responses."""
    id: int
    student_id: int
    created_at: datetime
    updated_at: datetime
    
    # Related data
    student_name: Optional[str] = None

    class Config:
        from_attributes = True


class StudentPointsWithTransactions(StudentPoints):
    """Schema for student points with recent transactions."""
    recent_transactions: List[PointTransaction] = Field(default_factory=list, description="Recent point transactions")


class PointsLedger(BaseModel):
    """Schema for student points ledger view."""
    student_points: StudentPoints
    transactions: List[PointTransaction]
    total_pages: int = Field(..., description="Total pages for pagination")
    current_page: int = Field(..., description="Current page number")


class AdminPointsOverview(BaseModel):
    """Schema for admin overview of all student points."""
    total_students_with_points: int
    total_students: int
    total_points_awarded: int
    total_points_spent: int
    student_points: List[StudentPoints]


class SystemSettingBase(BaseModel):
    """Base schema for system settings."""
    setting_key: str = Field(..., max_length=100)
    setting_value: str = Field(..., max_length=500)
    setting_type: str = Field(..., max_length=50)  # 'boolean', 'string', 'integer', 'json'
    description: Optional[str] = None
    is_active: bool = True


class SystemSettingCreate(SystemSettingBase):
    """Schema for creating system settings."""
    pass


class SystemSetting(SystemSettingBase):
    """Schema for system setting responses."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PointsSystemStatus(BaseModel):
    """Schema for points system enable/disable status."""
    enabled: bool = Field(..., description="Whether the points system is enabled")
    can_toggle: bool = Field(True, description="Whether the current user can toggle this setting")