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

"""Error tracking infrastructure for OurSchool."""
import traceback
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import Request, HTTPException
from starlette.responses import JSONResponse

from app.core.logging import get_logger, log_error


logger = get_logger("error_tracking")


class ErrorTracker:
    """Centralized error tracking and handling."""
    
    def __init__(self):
        self.errors_cache = {}  # In-memory cache for recent errors
        self.max_cache_size = 1000
    
    def track_error(
        self,
        error: Exception,
        request: Optional[Request] = None,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Track an error and return error ID for reference."""
        error_id = str(uuid4())
        
        # Extract request context
        request_context = {}
        if request:
            request_context = {
                "method": request.method,
                "url": str(request.url),
                "headers": dict(request.headers),
                "query_params": dict(request.query_params),
                "path_params": getattr(request, 'path_params', {}),
                "request_id": getattr(request.state, 'request_id', 'unknown'),
                "user_agent": request.headers.get("user-agent", "unknown")
            }
        
        # Create comprehensive error record
        error_record = {
            "error_id": error_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exception(type(error), error, error.__traceback__),
            "user_id": user_id,
            "request_context": request_context,
            "additional_context": context or {},
            "severity": self._determine_severity(error)
        }
        
        # Store in cache (for immediate access)
        self._store_in_cache(error_id, error_record)
        
        # Log the error using structured logging
        log_error(error, context={
            "error_id": error_id,
            "user_id": user_id,
            "request_context": request_context,
            "additional_context": context or {}
        })
        
        return error_id
    
    def _determine_severity(self, error: Exception) -> str:
        """Determine error severity based on error type."""
        if isinstance(error, HTTPException):
            if error.status_code >= 500:
                return "high"
            elif error.status_code >= 400:
                return "medium"
            else:
                return "low"
        
        # Database errors are typically high severity
        if "database" in str(error).lower() or "sql" in str(error).lower():
            return "high"
        
        # Authentication errors are medium severity
        if any(keyword in str(error).lower() for keyword in ["auth", "permission", "credential"]):
            return "medium"
        
        # Default to medium for unhandled exceptions
        return "medium"
    
    def _store_in_cache(self, error_id: str, error_record: Dict[str, Any]):
        """Store error in memory cache with size management."""
        if len(self.errors_cache) >= self.max_cache_size:
            # Remove oldest entries (simple FIFO)
            oldest_key = next(iter(self.errors_cache))
            del self.errors_cache[oldest_key]
        
        self.errors_cache[error_id] = error_record
    
    def get_error(self, error_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve error details by ID."""
        return self.errors_cache.get(error_id)
    
    def get_recent_errors(self, limit: int = 50) -> list:
        """Get recent errors for debugging/monitoring."""
        recent = list(self.errors_cache.values())[-limit:]
        return sorted(recent, key=lambda x: x["timestamp"], reverse=True)


# Global error tracker instance
error_tracker = ErrorTracker()


def track_error(
    error: Exception,
    request: Optional[Request] = None,
    user_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """Convenience function to track errors."""
    return error_tracker.track_error(error, request, user_id, context)


class ErrorHandler:
    """Custom error handlers for different error types."""
    
    @staticmethod
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Handle HTTP exceptions with error tracking."""
        user_id = getattr(request.state, 'user_id', None)
        
        # Only track server errors (5xx) and authentication errors
        if exc.status_code >= 500 or exc.status_code == 401:
            error_id = track_error(
                exc,
                request=request,
                user_id=user_id,
                context={"status_code": exc.status_code}
            )
            
            # Include error ID in response for 5xx errors
            if exc.status_code >= 500:
                return JSONResponse(
                    status_code=exc.status_code,
                    content={
                        "detail": exc.detail,
                        "error_id": error_id,
                        "message": "An error occurred. Please contact support with the error ID if the problem persists."
                    },
                    headers=exc.headers
                )
        
        # Standard response for other HTTP exceptions
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers
        )
    
    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected exceptions with error tracking."""
        user_id = getattr(request.state, 'user_id', None)
        
        error_id = track_error(
            exc,
            request=request,
            user_id=user_id,
            context={"unexpected": True}
        )
        
        logger.error(f"Unhandled exception occurred", extra={
            "error_id": error_id,
            "error_type": type(exc).__name__,
            "request_url": str(request.url),
            "user_id": user_id
        })
        
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error_id": error_id,
                "message": "An unexpected error occurred. Please contact support with the error ID."
            }
        )


class HomeschoolBusinessError(Exception):
    """Custom exception for homeschool business logic errors."""
    
    def __init__(self, message: str, error_code: str = None, context: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code or "BUSINESS_ERROR"
        self.context = context or {}
        super().__init__(self.message)


class ValidationError(HomeschoolBusinessError):
    """Exception for validation errors in homeschool operations."""
    
    def __init__(self, message: str, field: str = None, value: Any = None):
        context = {"field": field, "value": value} if field else {}
        super().__init__(message, "VALIDATION_ERROR", context)


class PermissionError(HomeschoolBusinessError):
    """Exception for permission/authorization errors."""
    
    def __init__(self, message: str, required_permission: str = None, user_role: str = None):
        context = {"required_permission": required_permission, "user_role": user_role}
        super().__init__(message, "PERMISSION_ERROR", context)


class GradingError(HomeschoolBusinessError):
    """Exception for grading system errors."""
    
    def __init__(self, message: str, assignment_id: str = None, student_id: str = None):
        context = {"assignment_id": assignment_id, "student_id": student_id}
        super().__init__(message, "GRADING_ERROR", context)


class AttendanceError(HomeschoolBusinessError):
    """Exception for attendance tracking errors."""
    
    def __init__(self, message: str, student_id: str = None, date: str = None):
        context = {"student_id": student_id, "date": date}
        super().__init__(message, "ATTENDANCE_ERROR", context)