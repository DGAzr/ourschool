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

"""Term schemas."""
from datetime import date, datetime
from typing import List, Optional
import re

from pydantic import BaseModel, Field, validator

from app.enums import TermType


class TermBase(BaseModel):
    """Base schema for terms."""

    name: str = Field(..., description="Term name (e.g., 'Fall 2024', 'Q1')")
    description: Optional[str] = None
    start_date: date = Field(..., description="Term start date")
    end_date: date = Field(..., description="Term end date")
    academic_year: str = Field(..., description="Academic year (e.g., '2025' or '2025-2026')")
    term_type: TermType = Field(default=TermType.CUSTOM, description="Type of term")
    term_order: int = Field(default=0, description="Order within academic year")

    @validator('academic_year')
    def validate_academic_year(cls, v):
        """Validate academic year format."""
        if not v:
            raise ValueError('Academic year is required')
        
        # Pattern for single year (YYYY) or year range (YYYY-YYYY)
        single_year_pattern = r'^\d{4}$'
        year_range_pattern = r'^\d{4}-\d{4}$'
        
        if re.match(single_year_pattern, v):
            # Validate single year is reasonable (between 1900 and 2100)
            year = int(v)
            if year < 1900 or year > 2100:
                raise ValueError('Academic year must be between 1900 and 2100')
            return v
        elif re.match(year_range_pattern, v):
            # Validate year range
            start_year, end_year = map(int, v.split('-'))
            
            # Check years are reasonable
            if start_year < 1900 or start_year > 2100 or end_year < 1900 or end_year > 2100:
                raise ValueError('Academic years must be between 1900 and 2100')
            
            # Check end year is after start year
            if end_year <= start_year:
                raise ValueError('End year must be after start year in academic year range')
            
            # Check it's a reasonable range (typically 1-2 years)
            if end_year - start_year > 5:
                raise ValueError('Academic year range cannot exceed 5 years')
            
            return v
        else:
            raise ValueError('Academic year must be a single 4-digit year (e.g., "2025") or a year range (e.g., "2025-2026")')


class TermCreate(TermBase):
    """Schema for creating terms."""


class TermUpdate(BaseModel):
    """Schema for updating terms."""

    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    academic_year: Optional[str] = None
    term_type: Optional[TermType] = None
    term_order: Optional[int] = None
    is_active: Optional[bool] = None


class Term(TermBase):
    """Schema for terms."""

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: int
    is_current: bool

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# Simplified response for API (without computed properties that might cause issues)
class TermResponse(TermBase):
    """Schema for responding with terms."""

    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: int

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class TermSubjectBase(BaseModel):
    """Base schema for term subjects."""

    is_active: bool = Field(
        default=True, description="Whether this subject is taught this term"
    )
    weight: float = Field(default=1.0, description="Weight for GPA calculation")
    grading_scale: Optional[str] = Field(
        None, description="JSON string of custom grading scale"
    )
    learning_goals: Optional[str] = None
    teacher_notes: Optional[str] = None


class TermSubjectCreate(TermSubjectBase):
    """Schema for creating term subjects."""

    term_id: int
    subject_id: int


class TermSubjectUpdate(BaseModel):
    """Schema for updating term subjects."""

    is_active: Optional[bool] = None
    weight: Optional[float] = None
    grading_scale: Optional[str] = None
    learning_goals: Optional[str] = None
    teacher_notes: Optional[str] = None


class TermSubject(TermSubjectBase):
    """Schema for term subjects."""

    id: int
    term_id: int
    subject_id: int
    created_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class StudentTermGradeBase(BaseModel):
    """Base schema for student term grades."""

    current_points_earned: float = Field(default=0.0)
    current_points_possible: float = Field(default=0.0)
    current_percentage: Optional[float] = None
    current_letter_grade: Optional[str] = None
    assignments_completed: int = Field(default=0)
    assignments_total: int = Field(default=0)
    attendance_rate: Optional[float] = None
    progress_notes: Optional[str] = None
    student_reflection: Optional[str] = None
    parent_notes: Optional[str] = None
    learning_goals: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    strengths: Optional[str] = None


class StudentTermGradeCreate(StudentTermGradeBase):
    """Schema for creating student term grades."""

    student_id: int
    term_subject_id: int


class StudentTermGradeUpdate(BaseModel):
    """Schema for updating student term grades."""

    current_percentage: Optional[float] = None
    current_letter_grade: Optional[str] = None
    attendance_rate: Optional[float] = None
    progress_notes: Optional[str] = None
    student_reflection: Optional[str] = None
    parent_notes: Optional[str] = None
    learning_goals: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    strengths: Optional[str] = None


class StudentTermGrade(StudentTermGradeBase):
    """Schema for student term grades."""

    id: int
    student_id: int
    term_subject_id: int
    final_points_earned: Optional[float] = None
    final_points_possible: Optional[float] = None
    final_percentage: Optional[float] = None
    final_letter_grade: Optional[str] = None
    is_finalized: bool
    finalized_date: Optional[date] = None
    finalized_by: Optional[int] = None
    completion_rate: float
    created_at: datetime
    updated_at: datetime
    last_calculated: Optional[datetime] = None

    class Config:
        """Pydantic configuration."""

        from_attributes = True


class GradeHistoryBase(BaseModel):
    """Base schema for grade history."""

    field_name: str = Field(..., description="Name of the field that changed")
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None


class GradeHistoryCreate(GradeHistoryBase):
    """Schema for creating grade history."""

    student_term_grade_id: int
    assignment_id: Optional[int] = None


class GradeHistory(GradeHistoryBase):
    """Schema for grade history."""

    id: int
    student_term_grade_id: int
    assignment_id: Optional[int] = None
    changed_by: int
    changed_at: datetime

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# Composite schemas for API responses
class TermWithSubjects(Term):
    """Schema for terms with subjects."""

    term_subjects: List[TermSubject] = []


class StudentTermReport(BaseModel):
    """Complete term report for a student."""

    student_id: int
    term: Term
    subject_grades: List[StudentTermGrade] = []
    overall_gpa: Optional[float] = None
    total_assignments_completed: int = 0
    total_assignments: int = 0
    overall_completion_rate: float = 0.0


class SubjectTermSummary(BaseModel):
    """Summary of all students' performance in a subject for a term."""

    term_subject: TermSubject
    student_count: int
    average_grade: Optional[float] = None
    completion_rate: float = 0.0
    top_performers: List[dict] = []  # {student_id, name, grade}
    struggling_students: List[dict] = []  # {student_id, name, grade}