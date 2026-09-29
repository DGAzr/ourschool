"""Bounded per-process request metrics; never store SQL, parameters, or bodies."""

from collections import defaultdict, deque
from contextvars import ContextVar
from threading import Lock
from time import perf_counter
from math import ceil
import re

from sqlalchemy import event

current_metrics = ContextVar("request_metrics", default=None)
_samples = defaultdict(lambda: deque(maxlen=256))
_lock = Lock()


def record_rows(count):
    metrics = current_metrics.get()
    if metrics is not None:
        metrics["rows_returned"] = count


def record_acquire(elapsed):
    metrics = current_metrics.get()
    if metrics is not None:
        metrics["connection_acquire_ms"] += elapsed * 1000


def instrument_engine(engine):
    def before(_conn, _cursor, _statement, _parameters, context, _executemany):
        context.request_sql_started = perf_counter()

    def after(_conn, _cursor, _statement, _parameters, context, _executemany):
        metrics = current_metrics.get()
        if metrics is not None:
            metrics["sql_count"] += 1
            metrics["sql_ms"] += (perf_counter() - context.request_sql_started) * 1000

    event.listen(engine, "before_cursor_execute", before)
    event.listen(engine, "after_cursor_execute", after)


class RequestPerformanceMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        metrics = dict(
            sql_count=0,
            sql_ms=0.0,
            connection_acquire_ms=0.0,
            response_bytes=0,
            rows_returned=0,
        )
        token = current_metrics.set(metrics)
        started = perf_counter()

        async def measured_send(message):
            if message["type"] == "http.response.body":
                metrics["response_bytes"] += len(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, receive, measured_send)
        finally:
            metrics["duration_ms"] = (perf_counter() - started) * 1000
            route_object = scope.get("route")
            route = "unmatched"
            # Included APIRouters expose their original (unprefixed) route in
            # recent FastAPI. Reconstruct only the matched, static prefix.
            regex = getattr(route_object, "path_regex", None)
            if regex is not None:
                match = re.search(regex.pattern.removeprefix("^"), scope["path"])
                if match:
                    route = scope["path"][: match.start()] + route_object.path
            with _lock:
                _samples[f"{scope['method']} {route}"].append(metrics.copy())
            current_metrics.reset(token)


def request_performance_snapshot():
    with _lock:
        snapshot = {route: list(samples) for route, samples in _samples.items()}
    result = {}
    for route, samples in snapshot.items():
        fields = {}
        for field in samples[0]:
            values = sorted(sample[field] for sample in samples)
            fields[field] = {
                "p50": round(values[ceil(len(values) * 0.5) - 1], 3),
                "p95": round(values[ceil(len(values) * 0.95) - 1], 3),
                "max": round(values[-1], 3),
            }
        result[route] = dict(sample_count=len(samples), **fields)
    return result
