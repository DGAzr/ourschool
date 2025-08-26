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
Term Grading Service.

Handles automatic subject-term linking and grade calculations based on assignment
completion dates.
"""

from datetime import datetime
from typing import Dict, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.assignment import AssignmentTemplate, StudentAssignment
from app.models.lesson import Subject
from app.models.term import StudentTermGrade, Term, TermSubject
from app.models.user import User, UserRole


class TermGradingService:
    """A service for managing term grading."""

    @staticmethod
    def auto_link_subjects_to_terms(
        db: Session, term_id: Optional[int] = None
    ) -> Dict[str, int]:
        """
        Automatically link subjects to terms based on assignment completion dates.

        If term_id is provided, only process that term. Otherwise, process all terms.

        Returns: Dict with counts of subjects linked
        """
        terms_query = db.query(Term)
        if term_id:
            terms_query = terms_query.filter(Term.id == term_id)

        terms = terms_query.all()
        results = {"subjects_linked": 0, "term_subjects_created": 0}

        for term in terms:
            # Find all completed assignments during this term period
            completed_assignments = (
                db.query(StudentAssignment)
                .join(
                    AssignmentTemplate,
                    StudentAssignment.template_id == AssignmentTemplate.id,
                )
                .filter(
                    and_(
                        StudentAssignment.completed_date.isnot(None),
                        StudentAssignment.completed_date >= term.start_date,
                        StudentAssignment.completed_date <= term.end_date,
                    )
                )
                .all()
            )

            # Get unique subject IDs from these assignments
            subject_ids = set()
            for assignment in completed_assignments:
                if assignment.template and assignment.template.subject_id:
                    subject_ids.add(assignment.template.subject_id)

            # Link subjects to term if not already linked
            for subject_id in subject_ids:
                existing_link = (
                    db.query(TermSubject)
                    .filter(
                        TermSubject.term_id == term.id,
                        TermSubject.subject_id == subject_id,
                    )
                    .first()
                )

                if not existing_link:
                    term_subject = TermSubject(
                        term_id=term.id,
                        subject_id=subject_id,
                        is_active=True,
                        weight=1.0,
                        learning_goals=(
                            "Automatically linked based on completed assignments in "
                            f"{term.name}"
                        ),
                    )
                    db.add(term_subject)
                    results["term_subjects_created"] += 1

            results["subjects_linked"] += len(subject_ids)

        db.commit()
        return results

    @staticmethod
    def calculate_student_term_grades(
        db: Session, term_id: int, student_id: Optional[int] = None
    ) -> Dict[str, int]:
        """
        Calculate grades for students in a specific term based on completed assignments.

        If student_id is provided, only calculate for that student.

        Returns: Dict with counts of grades calculated
        """
        # First ensure subjects are linked to the term
        TermGradingService.auto_link_subjects_to_terms(db, term_id)

        term = db.query(Term).filter(Term.id == term_id).first()
        if not term:
            return {"error": "Term not found"}

        # Get all term subjects for this term
        term_subjects = (
            db.query(TermSubject).filter(TermSubject.term_id == term_id).all()
        )

        students_query = db.query(User).filter(User.role == UserRole.STUDENT)
        if student_id:
            students_query = students_query.filter(User.id == student_id)

        students = students_query.all()
        results = {"grades_calculated": 0, "students_processed": 0}

        for student in students:
            results["students_processed"] += 1

            for term_subject in term_subjects:
                # Find all graded assignments for this student, subject, and term period
                graded_assignments = (
                    db.query(StudentAssignment)
                    .join(
                        AssignmentTemplate,
                        StudentAssignment.template_id == AssignmentTemplate.id,
                    )
                    .filter(
                        and_(
                            StudentAssignment.student_id == student.id,
                            AssignmentTemplate.subject_id == term_subject.subject_id,
                            StudentAssignment.is_graded,
                            StudentAssignment.completed_date.isnot(None),
                            StudentAssignment.completed_date >= term.start_date,
                            StudentAssignment.completed_date <= term.end_date,
                        )
                    )
                    .all()
                )

                if not graded_assignments:
                    continue

                # Calculate totals
                total_points_earned = sum(
                    a.points_earned or 0 for a in graded_assignments
                )
                total_points_possible = sum(a.max_points for a in graded_assignments)
                total_assignments = len(graded_assignments)

                # Calculate percentage
                current_percentage = None
                if total_points_possible > 0:
                    current_percentage = (
                        total_points_earned / total_points_possible
                    ) * 100

                # Determine letter grade
                letter_grade = TermGradingService._calculate_letter_grade(
                    current_percentage
                )

                # Find or create StudentTermGrade record
                student_term_grade = (
                    db.query(StudentTermGrade)
                    .filter(
                        StudentTermGrade.student_id == student.id,
                        StudentTermGrade.term_subject_id == term_subject.id,
                    )
                    .first()
                )

                if not student_term_grade:
                    student_term_grade = StudentTermGrade(
                        student_id=student.id, term_subject_id=term_subject.id
                    )
                    db.add(student_term_grade)

                # Update grade information
                student_term_grade.current_points_earned = total_points_earned
                student_term_grade.current_points_possible = total_points_possible
                student_term_grade.current_percentage = current_percentage
                student_term_grade.current_letter_grade = letter_grade
                student_term_grade.assignments_completed = total_assignments
                student_term_grade.assignments_total = (
                    total_assignments  # For now, same as completed
                )
                student_term_grade.last_calculated = datetime.utcnow()

                results["grades_calculated"] += 1

        db.commit()
        return results

    @staticmethod
    def _calculate_letter_grade(percentage: Optional[float]) -> Optional[str]:
        """Convert percentage to letter grade using standard scale."""
        if percentage is None:
            return None

        if percentage >= 97:
            return "A+"
        if percentage >= 93:
            return "A"
        if percentage >= 90:
            return "A-"
        if percentage >= 87:
            return "B+"
        if percentage >= 83:
            return "B"
        if percentage >= 80:
            return "B-"
        if percentage >= 77:
            return "C+"
        if percentage >= 73:
            return "C"
        if percentage >= 70:
            return "C-"
        if percentage >= 67:
            return "D+"
        if percentage >= 63:
            return "D"
        if percentage >= 60:
            return "D-"
        return "F"

    @staticmethod
    def get_term_grade_report(db: Session, term_id: int) -> Dict:
        """Generate a comprehensive grade report for a term."""
        term = db.query(Term).filter(Term.id == term_id).first()
        if not term:
            return {"error": "Term not found"}

        # Get all students with grades in this term
        student_grades = (
            db.query(StudentTermGrade)
            .join(TermSubject, StudentTermGrade.term_subject_id == TermSubject.id)
            .join(User, StudentTermGrade.student_id == User.id)
            .join(Subject, TermSubject.subject_id == Subject.id)
            .filter(TermSubject.term_id == term_id)
            .all()
        )

        # Organize data by student
        students_data = {}
        for grade in student_grades:
            student_id = grade.student_id
            if student_id not in students_data:
                students_data[student_id] = {
                    "student": grade.student,
                    "subjects": [],
                    "overall_percentage": 0,
                    "total_points_earned": 0,
                    "total_points_possible": 0,
                }

            subject_data = {
                "subject": grade.term_subject.subject,
                "grade": grade,
                "percentage": grade.current_percentage,
                "letter_grade": grade.current_letter_grade,
                "points_earned": grade.current_points_earned,
                "points_possible": grade.current_points_possible,
            }

            students_data[student_id]["subjects"].append(subject_data)
            students_data[student_id]["total_points_earned"] += (
                grade.current_points_earned or 0
            )
            students_data[student_id]["total_points_possible"] += (
                grade.current_points_possible or 0
            )

        # Calculate overall percentages
        for student_data in students_data.values():
            if student_data["total_points_possible"] > 0:
                student_data["overall_percentage"] = (
                    student_data["total_points_earned"]
                    / student_data["total_points_possible"]
                ) * 100
                student_data["overall_letter_grade"] = (
                    TermGradingService._calculate_letter_grade(
                        student_data["overall_percentage"]
                    )
                )

        return {
            "term": term,
            "students": list(students_data.values()),
            "total_students": len(students_data),
            "total_subjects": {g.term_subject.subject_id for g in student_grades},
        }

    @staticmethod
    def get_student_term_report(db: Session, term_id: int, student_id: int) -> Dict:
        """Generate a detailed report for a specific student in a term."""
        term = db.query(Term).filter(Term.id == term_id).first()
        student = db.query(User).filter(User.id == student_id).first()

        if not term or not student:
            return {"error": "Term or student not found"}

        # Get all grades for this student in this term
        student_grades = (
            db.query(StudentTermGrade)
            .join(TermSubject, StudentTermGrade.term_subject_id == TermSubject.id)
            .join(Subject, TermSubject.subject_id == Subject.id)
            .filter(
                TermSubject.term_id == term_id,
                StudentTermGrade.student_id == student_id,
            )
            .all()
        )

        # Get detailed assignment information
        subjects_detail = []
        total_points_earned = 0
        total_points_possible = 0

        for grade in student_grades:
            # Get assignments for this subject during the term
            assignments = (
                db.query(StudentAssignment)
                .join(
                    AssignmentTemplate,
                    StudentAssignment.template_id == AssignmentTemplate.id,
                )
                .filter(
                    and_(
                        StudentAssignment.student_id == student_id,
                        AssignmentTemplate.subject_id == grade.term_subject.subject_id,
                        StudentAssignment.completed_date.isnot(None),
                        StudentAssignment.completed_date >= term.start_date,
                        StudentAssignment.completed_date <= term.end_date,
                    )
                )
                .all()
            )

            subjects_detail.append(
                {
                    "subject": grade.term_subject.subject,
                    "grade": grade,
                    "assignments": assignments,
                    "assignment_count": len(assignments),
                }
            )

            total_points_earned += grade.current_points_earned or 0
            total_points_possible += grade.current_points_possible or 0

        overall_percentage = None
        overall_letter_grade = None
        if total_points_possible > 0:
            overall_percentage = (total_points_earned / total_points_possible) * 100
            overall_letter_grade = TermGradingService._calculate_letter_grade(
                overall_percentage
            )

        return {
            "term": term,
            "student": student,
            "subjects": subjects_detail,
            "overall_percentage": overall_percentage,
            "overall_letter_grade": overall_letter_grade,
            "total_points_earned": total_points_earned,
            "total_points_possible": total_points_possible,
        }