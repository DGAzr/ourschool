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
Examples of error tracking usage in OurSchool application.

This file demonstrates proper error handling patterns for the homeschool management system.
"""

from fastapi import HTTPException, Request
from app.core.error_tracking import (
    track_error,
    HomeschoolBusinessError,
    ValidationError,
    PermissionError,
    GradingError,
    AttendanceError
)
from app.core.logging import get_logger

logger = get_logger("error_examples")


def example_basic_error_tracking():
    """Basic error tracking in a try/catch block."""
    
    try:
        # Some operation that might fail
        result = perform_risky_operation()
    except Exception as e:
        # Track the error and get error ID
        error_id = track_error(e, context={
            "operation": "risky_operation",
            "user_id": "user_123"
        })
        
        # Log with error ID for correlation
        logger.error(f"Operation failed with error ID: {error_id}")
        
        # Return error to user with tracking ID
        raise HTTPException(
            status_code=500,
            detail=f"Operation failed. Error ID: {error_id}"
        )


async def example_request_context_tracking(request: Request):
    """Error tracking with full request context."""
    
    try:
        # Some operation
        result = process_user_request()
    except Exception as e:
        # Track with request context (automatically captured)
        error_id = track_error(
            e,
            request=request,  # Request context automatically extracted
            user_id="user_123",
            context={
                "operation": "user_request_processing",
                "additional_data": "some_value"
            }
        )
        
        raise HTTPException(
            status_code=500,
            detail=f"Request processing failed. Error ID: {error_id}"
        )


def example_homeschool_business_errors():
    """Examples of homeschool-specific business errors."""
    
    # Validation error example
    def validate_grade_input(grade: float, assignment_id: str):
        if grade < 0 or grade > 100:
            raise ValidationError(
                "Grade must be between 0 and 100",
                field="grade",
                value=grade
            )
    
    # Permission error example  
    def check_grading_permission(user_role: str, student_id: str):
        if user_role != "ADMIN" and user_role != "TEACHER":
            raise PermissionError(
                "Only teachers and administrators can grade assignments",
                required_permission="grade_assignments",
                user_role=user_role
            )
    
    # Grading system error
    def calculate_term_grade(assignment_ids: list, student_id: str):
        try:
            # Grade calculation logic
            pass
        except Exception as e:
            raise GradingError(
                "Failed to calculate term grade",
                assignment_id=",".join(assignment_ids),
                student_id=student_id
            ) from e
    
    # Attendance error
    def mark_attendance(student_id: str, date: str, status: str):
        if status not in ["present", "absent", "late"]:
            raise AttendanceError(
                f"Invalid attendance status: {status}",
                student_id=student_id,
                date=date
            )


async def example_endpoint_with_error_handling(request: Request):
    """Complete example of an API endpoint with proper error handling."""
    
    try:
        # Extract request data
        student_id = request.path_params.get("student_id")
        if not student_id:
            raise ValidationError("Student ID is required", field="student_id")
        
        # Business logic
        result = process_student_data(student_id)
        
        # Success response
        return {"status": "success", "data": result}
        
    except ValidationError as e:
        # Business validation errors (client error)
        error_id = track_error(e, request=request, context={
            "operation": "student_data_processing",
            "error_type": "validation"
        })
        
        raise HTTPException(
            status_code=400,
            detail={
                "message": e.message,
                "error_code": e.error_code,
                "context": e.context,
                "error_id": error_id
            }
        )
    
    except PermissionError as e:
        # Permission errors (client error)
        error_id = track_error(e, request=request, context={
            "operation": "student_data_processing", 
            "error_type": "permission"
        })
        
        raise HTTPException(
            status_code=403,
            detail={
                "message": e.message,
                "error_code": e.error_code,
                "error_id": error_id
            }
        )
    
    except (GradingError, AttendanceError) as e:
        # Business logic errors (server error)
        error_id = track_error(e, request=request, context={
            "operation": "student_data_processing",
            "error_type": "business_logic"
        })
        
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to process student data",
                "error_code": e.error_code,
                "error_id": error_id
            }
        )
    
    except Exception as e:
        # Unexpected errors (server error)
        error_id = track_error(e, request=request, context={
            "operation": "student_data_processing",
            "error_type": "unexpected"
        })
        
        raise HTTPException(
            status_code=500,
            detail={
                "message": "An unexpected error occurred",
                "error_id": error_id
            }
        )


def example_database_error_handling():
    """Example of database operation error handling."""
    
    try:
        # Database operation
        db.execute("INSERT INTO students ...")
        db.commit()
        
    except Exception as e:
        db.rollback()
        
        # Track database error with context
        error_id = track_error(e, context={
            "operation": "student_insertion",
            "table": "students",
            "error_type": "database"
        })
        
        logger.error(f"Database operation failed: {error_id}")
        
        raise HTTPException(
            status_code=500,
            detail=f"Database operation failed. Error ID: {error_id}"
        )


def example_batch_operation_error_handling():
    """Example of handling errors in batch operations."""
    
    successful_operations = []
    failed_operations = []
    
    for item in batch_items:
        try:
            result = process_item(item)
            successful_operations.append({"item": item, "result": result})
            
        except Exception as e:
            error_id = track_error(e, context={
                "operation": "batch_processing",
                "item_id": item.get("id"),
                "batch_size": len(batch_items)
            })
            
            failed_operations.append({
                "item": item,
                "error_id": error_id,
                "error_message": str(e)
            })
    
    # Return summary with both successes and failures
    return {
        "successful": len(successful_operations),
        "failed": len(failed_operations),
        "results": successful_operations,
        "errors": failed_operations
    }


# Placeholder functions for examples
def perform_risky_operation():
    raise Exception("Something went wrong")

def process_user_request():
    raise Exception("Request processing failed")

def process_student_data(student_id: str):
    return {"student_id": student_id, "data": "processed"}

def process_item(item):
    if item.get("should_fail"):
        raise Exception("Item processing failed")
    return "processed"

# Mock database object
class MockDB:
    def execute(self, query): pass
    def commit(self): pass  
    def rollback(self): pass

db = MockDB()
batch_items = [{"id": 1}, {"id": 2, "should_fail": True}]