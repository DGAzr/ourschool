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

"""Validation utilities for lessons module."""
from typing import Optional, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.assignment import AssignmentTemplate
from app.models.lesson import Lesson, LessonAssignment, Subject

T = TypeVar('T')


def get_or_404(db_object: Optional[T], not_found_message: str) -> T:
    """Get database object or raise 404 if not found.
    
    Args:
        db_object: The database object or None
        not_found_message: Message to show in 404 error
        
    Returns:
        The database object if found
        
    Raises:
        HTTPException: 404 if object not found
    """
    if not db_object:
        raise HTTPException(status_code=404, detail=not_found_message)
    return db_object


def get_subject_or_404(db: Session, subject_id: int) -> Subject:
    """Get subject by ID or raise 404.
    
    Args:
        db: Database session
        subject_id: Subject ID to look up
        
    Returns:
        The subject if found
        
    Raises:
        HTTPException: 404 if subject not found
    """
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    return get_or_404(subject, "Subject not found")


def get_lesson_or_404(db: Session, lesson_id: int) -> Lesson:
    """Get lesson by ID or raise 404.
    
    Args:
        db: Database session
        lesson_id: Lesson ID to look up
        
    Returns:
        The lesson if found
        
    Raises:
        HTTPException: 404 if lesson not found
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    return get_or_404(lesson, "Lesson not found")


def get_assignment_template_or_404(db: Session, template_id: int) -> AssignmentTemplate:
    """Get assignment template by ID or raise 404.
    
    Args:
        db: Database session
        template_id: Template ID to look up
        
    Returns:
        The assignment template if found
        
    Raises:
        HTTPException: 404 if template not found
    """
    template = db.query(AssignmentTemplate).filter(AssignmentTemplate.id == template_id).first()
    return get_or_404(template, "Assignment template not found")


def get_lesson_assignment_or_404(db: Session, assignment_id: int) -> LessonAssignment:
    """Get lesson assignment by ID or raise 404.
    
    Args:
        db: Database session
        assignment_id: Assignment ID to look up
        
    Returns:
        The lesson assignment if found
        
    Raises:
        HTTPException: 404 if lesson assignment not found
    """
    lesson_assignment = db.query(LessonAssignment).filter(LessonAssignment.id == assignment_id).first()
    return get_or_404(lesson_assignment, "Lesson assignment not found")