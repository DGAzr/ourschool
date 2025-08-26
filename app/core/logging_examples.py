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
Examples of how to use the structured logging system throughout OurSchool.

This file demonstrates the proper usage patterns for logging in the application.
Copy these patterns to your own modules.
"""

from app.core.logging import (
    get_logger,
    log_authentication_event,
    log_business_event, 
    log_database_operation,
    log_error
)

# Get a logger for your module
logger = get_logger("examples")  # This creates app.examples logger


def example_authentication_logging():
    """Examples of authentication event logging."""
    
    # Successful login
    log_authentication_event(
        "login", 
        user_id="123", 
        username="john_doe", 
        success=True
    )
    
    # Failed login attempt
    log_authentication_event(
        "login",
        username="invalid_user", 
        success=False,
        reason="invalid_credentials"
    )
    
    # Session extension
    log_authentication_event(
        "session_extend",
        user_id="123",
        username="john_doe", 
        success=True
    )


def example_business_logging():
    """Examples of homeschool-specific business event logging."""
    
    # Student assignment completion
    log_business_event(
        "assignment_completed",
        user_id="teacher_123",
        student_id="student_456", 
        assignment_id="assign_789",
        subject="Mathematics",
        grade=85
    )
    
    # Lesson creation
    log_business_event(
        "lesson_created",
        user_id="teacher_123",
        lesson_id="lesson_999",
        subject="Science",
        grade_level=5
    )
    
    # Attendance record
    log_business_event(
        "attendance_marked",
        user_id="teacher_123",
        student_id="student_456",
        status="present",
        date="2025-08-16"
    )


def example_database_logging():
    """Examples of database operation logging."""
    
    # Record creation
    log_database_operation(
        "create",
        table="assignments", 
        record_id="assign_789",
        user_id="teacher_123",
        duration_ms=45.2
    )
    
    # Record update
    log_database_operation(
        "update",
        table="students",
        record_id="student_456", 
        user_id="teacher_123",
        duration_ms=23.1
    )
    
    # Bulk operation
    log_database_operation(
        "bulk_create",
        table="attendance_records",
        user_id="teacher_123",
        duration_ms=156.7,
        record_count=25
    )


def example_error_logging():
    """Examples of error logging with context."""
    
    try:
        # Some operation that might fail
        result = 1 / 0
    except Exception as e:
        log_error(e, context={
            "operation": "grade_calculation",
            "student_id": "student_456",
            "assignment_id": "assign_789",
            "user_id": "teacher_123"
        })


def example_general_logging():
    """Examples of general application logging."""
    
    # Use the logger directly for module-specific events
    logger.info("Processing grade report", extra={
        "student_id": "student_456",
        "term_id": "term_2024_fall",
        "user_id": "teacher_123",
        "event": "grade_report_generation"
    })
    
    logger.warning("Low disk space detected", extra={
        "available_gb": 2.5,
        "threshold_gb": 5.0,
        "event": "system_warning"
    })
    
    logger.error("Failed to send email notification", extra={
        "recipient": "parent@example.com",
        "notification_type": "assignment_due",
        "error_code": "SMTP_TIMEOUT",
        "event": "notification_failure"
    })


def example_performance_logging():
    """Examples of performance-related logging."""
    
    # Time-sensitive operations
    logger.info("Report generation started", extra={
        "report_type": "term_grades",
        "student_count": 25,
        "event": "report_start"
    })
    
    # After completion
    logger.info("Report generation completed", extra={
        "report_type": "term_grades", 
        "student_count": 25,
        "duration_ms": 2456.7,
        "file_size_mb": 1.2,
        "event": "report_complete"
    })


# Example of how to structure logging in a router endpoint
async def example_endpoint_logging():
    """Example showing proper logging flow in an API endpoint."""
    
    # Log start of operation
    logger.info("Starting student enrollment", extra={
        "operation": "student_enrollment",
        "event": "operation_start"
    })
    
    try:
        # Business logic here...
        
        # Log business event
        log_business_event(
            "student_enrolled",
            user_id="admin_123",
            student_id="new_student_789",
            grade_level=6
        )
        
        # Log database operation
        log_database_operation(
            "create",
            table="students",
            record_id="new_student_789",
            user_id="admin_123",
            duration_ms=42.3
        )
        
        # Log successful completion
        logger.info("Student enrollment completed", extra={
            "student_id": "new_student_789",
            "event": "operation_success"
        })
        
    except Exception as e:
        # Log error with context
        log_error(e, context={
            "operation": "student_enrollment",
            "user_id": "admin_123",
            "student_data": "sanitized_data_here"
        })
        raise