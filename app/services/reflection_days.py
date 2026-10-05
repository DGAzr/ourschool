"""Evidence-based reflection days; teacher notes and unrecorded breaks are excluded."""

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import func
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.journal import JournalEntry
from app.models.user import User


def school_day_bounds(zone_name="UTC", now=None):
    """UTC bounds for a local school day, including daylight-saving changes."""
    zone = ZoneInfo(zone_name)
    local_day = (now or datetime.now(timezone.utc)).astimezone(zone).date()
    start = datetime.combine(local_day, time.min, zone)
    end = datetime.combine(local_day + timedelta(days=1), time.min, zone)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def reflection_streak(db, student_id, zone_name="UTC", today=None):
    student = db.get(User, student_id)
    if student is None or not student.show_effort_signals:
        return 0
    today = today or datetime.now(ZoneInfo(zone_name)).date()
    entry_day = func.date(func.timezone(zone_name, JournalEntry.entry_date))
    dates = {
        row[0]
        for row in db.query(entry_day)
        .filter(
            JournalEntry.student_id == student_id,
            JournalEntry.author_id == student_id,
            entry_day <= today,
        )
        .distinct()
        .all()
    }
    if not dates:
        return 0
    school_dates = {
        row[0]
        for row in db.query(AttendanceRecord.date)
        .filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.status.in_(
                [AttendanceStatus.PRESENT, AttendanceStatus.LATE]
            ),
            AttendanceRecord.date >= min(dates),
            AttendanceRecord.date <= today,
        )
        .all()
    }
    streak = 0
    for day in sorted(dates | school_dates, reverse=True):
        if day not in dates:
            break
        streak += 1
    return streak
