"""PostgreSQL-backed Paperless scheduler. One worker thread per backend process.

All workers coordinate using row locks and expiring fenced leases. No network
request is made while a database transaction is open.
"""

import logging
import threading
import uuid
import time
from datetime import timedelta

from sqlalchemy import or_, and_
from sqlalchemy.dialects.postgresql import insert

from app.core import crypto, database
from app.models.paperless import (
    PaperlessConnection,
    PaperlessSyncJob,
    PaperlessSyncStage,
)
from app.services import paperless_client, paperless_sync

logger = logging.getLogger(__name__)
ACTIVE = ("queued", "running")
MAX_ATTEMPTS = 3


def active_job(db, library_id):
    return (
        db.query(PaperlessSyncJob)
        .filter(
            PaperlessSyncJob.library_id == library_id,
            PaperlessSyncJob.state.in_(ACTIVE),
        )
        .first()
    )


def cancel_jobs(db, library_id):
    ids = [
        job_id
        for (job_id,) in db.query(PaperlessSyncJob.id).filter(
            PaperlessSyncJob.library_id == library_id,
            PaperlessSyncJob.state.in_(ACTIVE),
        )
    ]
    db.query(PaperlessSyncJob).filter(
        PaperlessSyncJob.library_id == library_id, PaperlessSyncJob.state.in_(ACTIVE)
    ).update(
        dict(
            state="cancelled", phase="cancelled", finished_at=paperless_sync._utcnow()
        ),
        synchronize_session=False,
    )
    if ids:
        db.query(PaperlessSyncStage).filter(PaperlessSyncStage.job_id.in_(ids)).delete(
            synchronize_session=False
        )


def enqueue(db, conn):
    existing = active_job(db, conn.library_id)
    if existing:
        return existing
    now = paperless_sync._utcnow()
    statement = insert(PaperlessSyncJob).values(
        id=str(uuid.uuid4()),
        library_id=conn.library_id,
        revision=conn.revision,
        state="queued",
        phase="queued",
        processed=0,
        counts={},
        attempt=0,
        available_at=now,
        created_at=now,
    )
    db.execute(
        statement.on_conflict_do_nothing(
            index_elements=["library_id"],
            index_where=PaperlessSyncJob.state.in_(ACTIVE),
        )
    )
    db.flush()
    return active_job(db, conn.library_id)


def claim(db, job_id=None):
    now = paperless_sync._utcnow()
    conn = db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    # Clear jobs for superseded connections even if the process died before cleanup.
    query = db.query(PaperlessSyncJob).filter(
        or_(
            and_(
                PaperlessSyncJob.state == "queued", PaperlessSyncJob.available_at <= now
            ),
            and_(
                PaperlessSyncJob.state == "running", PaperlessSyncJob.lease_until < now
            ),
        )
    )
    if job_id:
        query = query.filter(PaperlessSyncJob.id == job_id)
    job = (
        query.order_by(PaperlessSyncJob.created_at)
        .with_for_update(skip_locked=True)
        .first()
    )
    if job is None:
        db.commit()
        return None
    if (
        conn is None
        or conn.library_id != job.library_id
        or conn.revision != job.revision
    ):
        job.state, job.phase, job.finished_at = "cancelled", "cancelled", now
        db.commit()
        return None
    if job.attempt >= MAX_ATTEMPTS:
        job.state, job.phase, job.finished_at, job.error = (
            "error",
            "error",
            now,
            "Sync interrupted repeatedly; retry manually.",
        )
        conn.last_sync_status, conn.last_sync_error = "error", job.error
        conn.next_sync_at = (
            now + timedelta(minutes=conn.sync_interval_minutes)
            if conn.auto_import
            else None
        )
        db.commit()
        return None
    job.state, job.phase, job.owner = "running", "starting", str(uuid.uuid4())
    job.attempt += 1
    job.started_at = now
    job.lease_until = now + timedelta(seconds=paperless_sync.LEASE_SECONDS)
    db.query(PaperlessSyncStage).filter_by(job_id=job.id).delete(
        synchronize_session=False
    )
    conn.last_sync_at = now
    result = (job.id, job.owner)
    db.commit()
    return result


def run_job(db, job_id=None):
    claimed = claim(db, job_id)
    if claimed is None:
        return
    job_id, owner = claimed
    try:
        conn = paperless_sync.get_connection(db)
        client = paperless_sync.client_for(conn)

        def heartbeat():
            paperless_sync._guard(db, job_id, owner)
            db.commit()

        client.before_request = heartbeat
        client.deadline = time.monotonic() + 30 * 60
        with client:
            paperless_sync.sync_all(db, conn, client, job_id, owner)
    except paperless_sync.SyncCancelled:
        db.rollback()
    except Exception as exc:
        db.rollback()
        conn = db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
        job = db.query(PaperlessSyncJob).filter_by(id=job_id).with_for_update().first()
        if job is None or job.owner != owner or job.state != "running":
            db.rollback()
            return
        now = paperless_sync._utcnow()
        if (
            conn is None
            or conn.library_id != job.library_id
            or conn.revision != job.revision
        ):
            job.state, job.phase, job.finished_at = "cancelled", "cancelled", now
        else:
            reconnect = isinstance(exc, crypto.SecretDecryptError) or (
                isinstance(exc, paperless_client.PaperlessError) and exc.status == 400
            )
            message = (
                str(exc)
                if isinstance(exc, paperless_client.PaperlessError)
                else (
                    "Stored token cannot be decrypted; reconnect required."
                    if reconnect
                    else "Sync failed unexpectedly; retry or check backend logs."
                )
            )
            job.error = message
            conn.last_sync_status, conn.last_sync_error, conn.needs_reconnect = (
                "error",
                message,
                reconnect,
            )
            retry = (
                isinstance(exc, paperless_client.PaperlessError)
                and not reconnect
                and job.attempt < MAX_ATTEMPTS
            )
            job.state, job.phase = (
                ("queued", "retrying") if retry else ("error", "error")
            )
            job.available_at = now + timedelta(seconds=60 * job.attempt)
            job.finished_at = None if retry else now
            conn.next_sync_at = (
                None
                if reconnect or not conn.auto_import
                else now + timedelta(minutes=conn.sync_interval_minutes)
            )
        db.query(PaperlessSyncStage).filter_by(job_id=job_id).delete(
            synchronize_session=False
        )
        db.commit()
        # Avoid exception text/traceback which may carry credentials or content.
        logger.warning(
            "Paperless sync failed",
            extra={"job_id": job_id, "error_type": type(exc).__name__},
        )


def tick(db):
    now = paperless_sync._utcnow()
    conn = db.query(PaperlessConnection).filter_by(id=1).with_for_update().first()
    if (
        conn
        and conn.auto_import
        and not conn.needs_reconnect
        and (
            conn.next_sync_at is None
            or paperless_sync._as_utc(conn.next_sync_at) <= now
        )
    ):
        enqueue(db, conn)
        conn.next_sync_at = now + timedelta(minutes=conn.sync_interval_minutes)
    # Bounded job history and staging cleanup through FK cascade.
    db.query(PaperlessSyncJob).filter(
        ~PaperlessSyncJob.state.in_(ACTIVE),
        PaperlessSyncJob.created_at < now - timedelta(days=30),
    ).delete(synchronize_session=False)
    db.commit()
    run_job(db)


class PaperlessWorker:
    def __init__(self):
        self.stop_event = threading.Event()
        self.thread = threading.Thread(
            target=self._run, name="paperless-sync", daemon=True
        )

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        self.thread.join(timeout=2)

    def _run(self):
        while not self.stop_event.wait(10):
            try:
                database.init_db()
                with database.SessionLocal() as db:
                    tick(db)
            except Exception:
                logger.warning("Paperless worker unavailable; will retry")
