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

"""Report schemas."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class TermGrade(BaseModel):
    """Schema for term grades."""

    term_id: int
    term_name: str
    subject_id: int
    subject_name: str
    subject_color: str
    total_points: float
    earned_points: float
    percentage: float
    letter_grade: str
    assignments_count: int
    completed_count: int

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class TrendDataPoint(BaseModel):
    """Schema for trend data point."""
    
    date: str  # ISO date string
    average_grade: float
    assignments_count: int
    
    class Config:
        """Pydantic configuration."""
        
        orm_mode = True


class SubjectPerformance(BaseModel):
    """Schema for subject performance."""

    subject_id: int
    subject_name: str
    average_percentage: float
    total_assignments: int
    completed_assignments: int
    points_earned: Optional[float] = None
    points_possible: Optional[float] = None
    terms: List[TermGrade]
    trend_data: List[TrendDataPoint] = []

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class StudentProgress(BaseModel):
    """Schema for student progress."""

    student_id: int
    student_name: str
    first_name: str
    last_name: str
    email: str
    grade_level: Optional[int] = None
    current_term_percentage: float
    current_term_letter_grade: str
    overall_grade: float
    total_assignments: int
    completed_assignments: int
    pending_assignments: int
    overdue_assignments: int
    average_grade: float
    completion_rate: float
    attendance_rate: Optional[float] = None
    last_activity_date: Optional[str] = None
    subjects: List[SubjectPerformance] = []
    subject_grades: List[SubjectPerformance] = []  # Alias for subjects

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class StudentReport(BaseModel):
    """Schema for student reports."""

    total_assignments: int
    completed_assignments: int
    in_progress_assignments: int
    pending_grades: int
    average_grade: float
    current_term_grade: float

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class AdminReport(BaseModel):
    """Schema for admin reports."""

    total_students: int
    active_assignments: int
    pending_grades: int
    average_grade: float
    total_assignments: int
    completed_assignments: int

    class Config:
        """Pydantic configuration."""

        orm_mode = True


# Attendance Report Schemas
class AttendanceReportSummary(BaseModel):
    """Schema for attendance report summaries."""

    student_id: int
    student_name: str
    student_first_name: str
    student_last_name: str
    grade_level: Optional[int] = None
    total_school_days: int
    total_possible_days: int  # Alias for total_school_days
    required_days_of_instruction: int  # Required instructional days for calculation
    present_days: int
    absent_days: int
    late_days: int
    excused_days: int
    attendance_rate: float
    attendance_percentage: float  # Alias for attendance_rate
    start_date: date
    end_date: date
    first_absence_date: Optional[str] = None
    recent_activity_summary: Optional[str] = None


class AttendanceReportDetail(BaseModel):
    """Schema for attendance report details."""

    date: date
    status: str
    notes: Optional[str] = None


class StudentAttendanceReport(BaseModel):
    """Schema for student attendance reports."""

    student_id: int
    student_name: str
    grade_level: Optional[int] = None
    academic_year: Optional[str] = None
    summary: AttendanceReportSummary
    daily_records: List[AttendanceReportDetail]
    daily_attendance: List[AttendanceReportDetail]  # Alias for daily_records


class BulkAttendanceReportOverallStats(BaseModel):
    """Schema for bulk attendance report overall statistics."""
    
    total_students: int
    average_attendance_rate: float
    total_present: int
    total_absent: int
    total_late: int
    total_excused: int


class BulkAttendanceReport(BaseModel):
    """Schema for bulk attendance reports."""

    academic_year: Optional[str] = None
    start_date: date
    end_date: date
    total_school_days: int
    students: List[AttendanceReportSummary]
    student_attendance: List[AttendanceReportSummary]  # Alias for students
    overall_stats: BulkAttendanceReportOverallStats


class AcademicYear(BaseModel):
    """Schema for academic years."""

    academic_year: str
    start_date: date
    end_date: date
    terms_count: int


# Assignment Report Schemas
class AssignmentReportItem(BaseModel):
    """Schema for assignment report items."""

    assignment_id: int
    template_id: int
    assignment_name: str
    assignment_type: str
    student_id: int
    student_name: str
    subject_id: int
    subject_name: str
    subject_color: str
    term_id: Optional[int] = None
    term_name: Optional[str] = None
    assigned_date: date
    due_date: Optional[date] = None
    status: str
    points_earned: Optional[float] = None
    max_points: int
    percentage_grade: Optional[float] = None
    letter_grade: Optional[str] = None
    is_graded: bool
    graded_date: Optional[date] = None
    teacher_feedback: Optional[str] = None
    time_spent_minutes: int
    assigned_by_name: str


class AssignmentReportSummary(BaseModel):
    """Schema for assignment report summaries."""

    total_assignments: int
    graded_assignments: int
    pending_assignments: int
    overdue_assignments: int
    average_grade: Optional[float] = None
    subjects_count: int
    students_count: int


class AssignmentReport(BaseModel):
    """Schema for assignment reports."""

    summary: AssignmentReportSummary
    assignments: List[AssignmentReportItem]
    available_subjects: List[dict]
    available_students: List[dict]
    available_terms: List[dict]


# Report Card Schemas
class ReportCardSubjectGrade(BaseModel):
    """Schema for report card subject grades."""

    subject_id: int
    subject_name: str
    subject_color: str
    assignments_completed: int
    assignments_total: int
    points_earned: float
    points_possible: float
    percentage_grade: float
    letter_grade: str
    comments: Optional[str] = None


class ReportCardSummary(BaseModel):
    """Schema for report card summaries."""

    overall_percentage: float
    overall_letter_grade: str
    total_assignments: int
    completed_assignments: int
    subjects_count: int
    attendance_rate: Optional[float] = None
    days_present: Optional[int] = None
    days_absent: Optional[int] = None
    days_late: Optional[int] = None


class ReportCard(BaseModel):
    """Schema for report cards."""

    student_id: int
    student_name: str
    student_grade_level: Optional[int] = None
    term_id: int
    term_name: str
    academic_year: str
    term_start_date: date
    term_end_date: date
    generated_date: date
    summary: ReportCardSummary
    subject_grades: List[ReportCardSubjectGrade]
    teacher_comments: Optional[str] = None
    parent_signature_line: bool = True
    next_term_info: Optional[str] = None