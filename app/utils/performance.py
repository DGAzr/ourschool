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

"""Performance monitoring utilities."""
import time
import functools
from typing import Any, Callable, Dict, Optional
from contextlib import contextmanager
import threading

from app.core.logging import get_logger

logger = get_logger("performance")

# Global query performance tracker with thread safety
query_stats: Dict[str, Dict[str, Any]] = {}
_stats_lock = threading.Lock()


def track_query_performance(func_name: str):
    """Decorator to track database query performance without SQLAlchemy events."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                # Store performance stats in a thread-safe manner
                with _stats_lock:
                    if func_name not in query_stats:
                        query_stats[func_name] = {
                            "call_count": 0,
                            "total_time": 0,
                            "avg_time": 0,
                            "min_time": float('inf'),
                            "max_time": 0,
                        }
                    
                    stats = query_stats[func_name]
                    stats["call_count"] += 1
                    stats["total_time"] += execution_time
                    stats["avg_time"] = stats["total_time"] / stats["call_count"]
                    stats["min_time"] = min(stats["min_time"], execution_time)
                    stats["max_time"] = max(stats["max_time"], execution_time)
                
                # Log performance info
                if execution_time > 1.0:  # 1 second threshold
                    logger.warning(
                        f"Slow function {func_name}: {execution_time:.3f}s"
                    )
                elif execution_time > 0.5:  # 500ms info threshold
                    logger.info(
                        f"Function {func_name}: {execution_time:.3f}s"
                    )
                else:
                    logger.debug(
                        f"Function {func_name}: {execution_time:.3f}s"
                    )
                
                return result
                
            except Exception as e:
                execution_time = time.time() - start_time
                logger.error(f"Function {func_name} failed after {execution_time:.3f}s: {e}")
                raise
        
        return wrapper
    return decorator


@contextmanager
def query_monitor(operation_name: str):
    """Context manager to monitor execution time of operations."""
    start_time = time.time()
    
    try:
        yield
    finally:
        execution_time = time.time() - start_time
        logger.info(f"Operation {operation_name}: {execution_time:.3f}s")


def get_performance_stats() -> Dict[str, Dict[str, Any]]:
    """Get current performance statistics."""
    with _stats_lock:
        return query_stats.copy()


def reset_performance_stats():
    """Reset all performance statistics."""
    with _stats_lock:
        query_stats.clear()


def log_performance_summary():
    """Log a summary of all tracked performance statistics."""
    with _stats_lock:
        if not query_stats:
            logger.info("No performance statistics available")
            return
        
        logger.info("=== Performance Summary ===")
        for func_name, stats in query_stats.items():
            logger.info(
                f"{func_name}: {stats['call_count']} calls, "
                f"avg {stats['avg_time']:.3f}s, "
                f"min {stats['min_time']:.3f}s, "
                f"max {stats['max_time']:.3f}s"
            )


def find_slow_operations(min_avg_time: float = 0.5) -> Dict[str, Dict[str, Any]]:
    """Find operations that are slower than the threshold."""
    with _stats_lock:
        return {
            name: stats 
            for name, stats in query_stats.items() 
            if stats.get("avg_time", 0) >= min_avg_time
        }


def find_query_heavy_operations(min_avg_time: float = 0.1) -> Dict[str, Dict[str, Any]]:
    """Find operations that are slower than threshold (renamed for consistency)."""
    with _stats_lock:
        return {
            name: stats 
            for name, stats in query_stats.items() 
            if stats.get("avg_time", 0) >= min_avg_time
        }