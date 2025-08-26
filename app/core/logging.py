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

"""Centralized logging configuration for OurSchool."""
import logging
import logging.config
import logging.handlers
import sys
from datetime import datetime
from typing import Any, Dict

from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        import json
        
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "lineno", "funcName", "created",
                "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "getMessage", "exc_info",
                "exc_text", "stack_info"
            }:
                log_data[key] = value
        
        return json.dumps(log_data, default=str)


class RequestContextFilter(logging.Filter):
    """Add request context to log records."""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Add request ID and user info to log record."""
        # These will be set by middleware
        record.request_id = getattr(record, 'request_id', 'unknown')
        record.user_id = getattr(record, 'user_id', 'anonymous')
        record.endpoint = getattr(record, 'endpoint', 'unknown')
        return True


def setup_logging() -> None:
    """Configure application logging."""
    
    # Use configuration from settings
    log_level = settings.log_level.upper()
    use_json = settings.log_format.lower() == "json"
    
    console_formatter = JSONFormatter() if use_json else logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Build handlers list
    handlers = ["console"]
    
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "console": {
                "()": JSONFormatter if use_json else logging.Formatter,
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s" if not use_json else None,
                "datefmt": "%Y-%m-%d %H:%M:%S" if not use_json else None,
            },
        },
        "filters": {
            "request_context": {
                "()": RequestContextFilter,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "formatter": "console",
                "filters": ["request_context"],
            },
        },
    }
    
    # Add file handler if configured
    if settings.log_file:
        logging_config["formatters"]["file"] = {
            "()": JSONFormatter if use_json else logging.Formatter,
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s" if not use_json else None,
            "datefmt": "%Y-%m-%d %H:%M:%S" if not use_json else None,
        }
        logging_config["handlers"]["file"] = {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": settings.log_file,
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "file",
            "filters": ["request_context"],
        }
        handlers.append("file")
    
    logging_config.update({
        "loggers": {
            # Application loggers
            "app": {
                "level": log_level,
                "handlers": handlers,
                "propagate": False,
            },
            # Third-party loggers with different levels
            "uvicorn": {
                "level": "INFO",
                "handlers": handlers,
                "propagate": False,
            },
            "uvicorn.access": {
                "level": "WARNING",  # Reduce noise from access logs
                "handlers": handlers, 
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",  # Only log SQL warnings/errors
                "handlers": handlers,
                "propagate": False,
            },
            "fastapi": {
                "level": "INFO",
                "handlers": handlers,
                "propagate": False,
            },
        },
        "root": {
            "level": "WARNING",
            "handlers": handlers,
        },
    })
    
    logging.config.dictConfig(logging_config)
    
    # Log startup message
    logger = logging.getLogger("app.startup")
    logger.info("Logging configured", extra={
        "log_level": log_level,
        "structured": use_json,
        "log_file": settings.log_file,
        "application": "ourschool",
        "version": "1.0.0-alpha"
    })


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the given name."""
    return logging.getLogger(f"app.{name}")


def log_request_start(request_id: str, method: str, path: str, user_id: str = "anonymous") -> None:
    """Log the start of a request."""
    logger = get_logger("requests")
    logger.info("Request started", extra={
        "request_id": request_id,
        "method": method,
        "path": path,
        "user_id": user_id,
        "event": "request_start"
    })


def log_request_end(request_id: str, status_code: int, duration_ms: float) -> None:
    """Log the end of a request."""
    logger = get_logger("requests")
    logger.info("Request completed", extra={
        "request_id": request_id,
        "status_code": status_code,
        "duration_ms": duration_ms,
        "event": "request_end"
    })


def log_authentication_event(event: str, user_id: str = None, username: str = None, 
                            success: bool = True, reason: str = None) -> None:
    """Log authentication events."""
    logger = get_logger("auth")
    level = logging.INFO if success else logging.WARNING
    
    logger.log(level, f"Authentication {event}", extra={
        "event": f"auth_{event}",
        "user_id": user_id,
        "username": username,
        "success": success,
        "reason": reason
    })


def log_database_operation(operation: str, table: str, record_id: str = None, 
                         user_id: str = None, duration_ms: float = None) -> None:
    """Log database operations."""
    logger = get_logger("database")
    logger.info(f"Database {operation}", extra={
        "event": f"db_{operation}",
        "table": table,
        "record_id": record_id,
        "user_id": user_id,
        "duration_ms": duration_ms
    })


def log_business_event(event: str, user_id: str = None, student_id: str = None,
                      lesson_id: str = None, assignment_id: str = None, **kwargs) -> None:
    """Log business logic events specific to homeschool operations."""
    logger = get_logger("business")
    logger.info(f"Business event: {event}", extra={
        "event": event,
        "user_id": user_id,
        "student_id": student_id,
        "lesson_id": lesson_id,
        "assignment_id": assignment_id,
        **kwargs
    })


def log_error(error: Exception, context: Dict[str, Any] = None) -> None:
    """Log errors with context."""
    logger = get_logger("errors")
    logger.error(f"Error occurred: {str(error)}", exc_info=True, extra={
        "error_type": type(error).__name__,
        "error_message": str(error),
        "context": context or {},
        "event": "error"
    })