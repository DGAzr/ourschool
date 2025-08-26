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

"""Main application file."""
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging, log_request_start, log_request_end, get_logger
from app.core.error_tracking import ErrorHandler
from app.core.config import settings
from app.routers import activity, api_keys, assignments, attendance, auth, backup, integrations, journal, lessons, performance, points, reports, terms, users
from app.routers import settings as settings_router

# Temporarily disabled students router - functionality moved to users router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    setup_logging()
    logger = get_logger("startup")
    logger.info("OurSchool API starting up", extra={
        "application": "ourschool",
        "version": "1.0.0-alpha",
        "event": "startup"
    })
    
    yield
    
    # Shutdown
    logger = get_logger("shutdown")
    logger.info("OurSchool API shutting down", extra={
        "event": "shutdown"
    })


app = FastAPI(
    title="OurSchool - Homeschool Tracking System",
    description="A comprehensive homeschool management platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Add error handlers
app.add_exception_handler(HTTPException, ErrorHandler.http_exception_handler)
app.add_exception_handler(Exception, ErrorHandler.general_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log all HTTP requests with timing and context."""
    # Generate unique request ID
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Try to extract user info from authorization header
    user_id = 'anonymous'
    try:
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            # We'll set this properly after auth, but initialize for error tracking
            request.state.user_id = user_id
    except Exception:
        pass
    
    # Log request start
    start_time = time.time()
    log_request_start(request_id, request.method, str(request.url.path), user_id)
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000
    
    # Log request completion
    log_request_end(request_id, response.status_code, duration_ms)
    
    # Add request ID to response headers for debugging
    response.headers["X-Request-ID"] = request_id
    
    return response

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
# app.include_router(
#     students.router, prefix="/api/students", tags=["students"]
# )  # Disabled - unified with users
app.include_router(activity.router, prefix="/api/activity", tags=["activity"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(lessons.router, prefix="/api/lessons", tags=["lessons"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])
app.include_router(terms.router, prefix="/api/terms", tags=["terms"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(journal.router, prefix="/api/journal", tags=["journal"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])
app.include_router(points.router, prefix="/api", tags=["points"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])
app.include_router(performance.router, prefix="/api/performance", tags=["performance"])
app.include_router(api_keys.router, prefix="/api", tags=["api-keys"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Welcome to OurSchool API"}


@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy"}


@app.get("/health/db")
async def database_health_check():
    """Database health check endpoint."""
    from app.core.database import get_db
    from sqlalchemy import text
    
    try:
        # Get database session
        db = next(get_db())
        
        # Test basic connectivity with a simple query
        result = db.execute(text("SELECT 1 as health_check"))
        row = result.fetchone()
        
        # Verify we got expected result
        if row and row[0] == 1:
            # Test migration status
            try:
                migration_result = db.execute(text("SELECT version_num FROM alembic_version"))
                current_version = migration_result.fetchone()
                
                db.close()
                return {
                    "status": "healthy",
                    "database": "connected",
                    "migration_version": current_version[0] if current_version else "unknown"
                }
            except Exception:
                # Migration table might not exist, but DB is still healthy
                db.close()
                return {
                    "status": "healthy", 
                    "database": "connected",
                    "migration_version": "not_initialized"
                }
        else:
            db.close()
            return {"status": "unhealthy", "database": "query_failed"}
            
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "connection_failed", 
            "error": str(e)
        }


@app.get("/errors/recent")
async def get_recent_errors(limit: int = 20):
    """Get recent errors for debugging (admin only in production)."""
    from app.core.error_tracking import error_tracker
    
    # In production, add authentication check here
    # current_user: User = Depends(get_current_admin_user)
    
    recent_errors = error_tracker.get_recent_errors(limit)
    
    # Sanitize sensitive information
    sanitized_errors = []
    for error in recent_errors:
        sanitized = {
            "error_id": error["error_id"],
            "timestamp": error["timestamp"],
            "error_type": error["error_type"],
            "error_message": error["error_message"],
            "severity": error["severity"],
            "user_id": error.get("user_id", "anonymous"),
            "request_method": error.get("request_context", {}).get("method"),
            "request_path": error.get("request_context", {}).get("url"),
            "status_code": error.get("additional_context", {}).get("status_code")
        }
        sanitized_errors.append(sanitized)
    
    return {"errors": sanitized_errors, "total": len(sanitized_errors)}


@app.get("/errors/{error_id}")
async def get_error_details(error_id: str):
    """Get detailed error information by ID (admin only in production)."""
    from app.core.error_tracking import error_tracker
    
    # In production, add authentication check here
    # current_user: User = Depends(get_current_admin_user)
    
    error_details = error_tracker.get_error(error_id)
    if not error_details:
        raise HTTPException(status_code=404, detail="Error not found")
    
    return error_details