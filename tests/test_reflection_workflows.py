"""Reflection privacy, school-day evidence, print identity and backup recovery."""

import io
from datetime import datetime, date, timezone
from PIL import Image
from app.models.journal import JournalEntry
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.user import User
from app.services.reflection_days import reflection_streak, school_day_bounds


def test_reflection_days_group_evening_entries_in_the_local_school_day(
    student_factory, db_session
):
    student, _ = student_factory()
    sid = student["id"]
    for stamp in ["2026-10-03T23:00:00+00:00", "2026-10-04T01:00:00+00:00"]:
        db_session.add(
            JournalEntry(
                student_id=sid,
                author_id=sid,
                title="Evening reflection",
                content="A local school day.",
                entry_date=datetime.fromisoformat(stamp),
            )
        )
    db_session.commit()
    assert (
        reflection_streak(db_session, sid, "America/New_York", date(2026, 10, 4)) == 1
    )
    assert reflection_streak(db_session, sid, "UTC", date(2026, 10, 4)) == 2
    start, end = school_day_bounds(
        "America/New_York", datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
    )
    assert (end - start).total_seconds() == 25 * 3600


def test_journal_points_use_the_same_local_day_as_the_composer(
    client, student_factory, db_session, monkeypatch
):
    from app.routers import journal

    student, headers = student_factory()
    sid = student["id"]
    start = datetime(2026, 10, 4, 4, tzinfo=timezone.utc)
    end = datetime(2026, 10, 5, 4, tzinfo=timezone.utc)
    monkeypatch.setattr(journal, "school_day_bounds", lambda zone: (start, end))
    db_session.add(
        JournalEntry(
            student_id=sid,
            author_id=sid,
            title="Earlier tonight",
            content="First reflection",
            created_at=datetime(2026, 10, 4, 23, tzinfo=timezone.utc),
            points_awarded=5,
        )
    )
    db_session.commit()
    response = client.post(
        "/api/journal/entries?timezone=America%2FNew_York",
        json={"title": "After UTC midnight", "content": "Same local evening"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["points_awarded"] is None
    composer = client.get(
        "/api/journal/composer-data?timezone=America%2FNew_York", headers=headers
    )
    assert composer.status_code == 200, composer.text
    assert composer.json()["points_today"] == 5


def test_unknown_journal_timezone_rejected_before_creating_an_entry(
    client, student_factory, db_session
):
    _, headers = student_factory()
    before = db_session.query(JournalEntry).count()
    response = client.post(
        "/api/journal/entries?timezone=Unknown%2FZone",
        json={"title": "Never saved", "content": "Invalid timezone"},
        headers=headers,
    )
    assert response.status_code == 422
    assert db_session.query(JournalEntry).count() == before


def test_text_and_mood_reflection_is_owned_and_json_restorable(
    client, admin_headers, student_factory, db_session
):
    student, headers = student_factory()
    _, other_headers = student_factory()
    payload = {
        "title": "My reflection",
        "content": "I found a frog.",
        "mood": "curious",
    }
    response = client.post("/api/journal/entries", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    entry = response.json()
    assert "photos" not in entry
    url = f"/api/journal/entries/{entry['id']}"
    assert client.get(url, headers=other_headers).status_code == 403
    assert client.get(url, headers=admin_headers).status_code == 200
    backup = client.get("/api/backup/export", headers=admin_headers).json()
    archived = next(
        e
        for e in backup["journal_entries"]
        if e["title"] == payload["title"] and e["student_email"] == student["email"]
    )
    assert archived["content"] == payload["content"]
    assert archived["mood"] == payload["mood"]
    assert "photos" not in archived
    db_session.delete(db_session.get(JournalEntry, entry["id"]))
    db_session.commit()
    imported = client.post(
        "/api/backup/import", json={"backup_data": backup}, headers=admin_headers
    )
    assert imported.status_code == 200 and imported.json()["success"], imported.text
    restored = next(
        e
        for e in client.get("/api/journal/entries", headers=headers).json()
        if e["title"] == payload["title"]
    )
    assert restored["content"] == payload["content"]
    assert restored["mood"] == payload["mood"]
    assert "photos" not in restored


def test_reflection_days_skip_breaks_and_teacher_notes(
    student_factory, admin_headers, db_session
):
    student, _ = student_factory()
    sid = student["id"]
    admin = db_session.query(User).filter(User.role == "admin").first()
    for day, author in [
        ("2026-09-24", sid),
        ("2026-09-28", sid),
        ("2026-09-29", admin.id),
    ]:
        db_session.add(
            JournalEntry(
                student_id=sid,
                author_id=author,
                title="Reflection",
                content="Work",
                entry_date=datetime.fromisoformat(day).replace(tzinfo=timezone.utc),
            )
        )
    db_session.commit()
    assert reflection_streak(db_session, sid) == 2
    # A recorded school day without a student reflection defines a real gap.
    db_session.add(
        AttendanceRecord(
            student_id=sid, date=date(2026, 9, 29), status=AttendanceStatus.PRESENT
        )
    )
    db_session.commit()
    assert reflection_streak(db_session, sid) == 0
    row = db_session.get(User, sid)
    row.show_effort_signals = False
    db_session.commit()
    assert reflection_streak(db_session, sid) == 0


def test_school_identity_and_setup_are_role_scoped(
    client, admin_headers, student_factory
):
    _, headers = student_factory()
    assert (
        client.put(
            "/api/settings/school/identity",
            json={"name": "Our family school"},
            headers=headers,
        ).status_code
        == 403
    )
    saved = client.put(
        "/api/settings/school/identity",
        json={"name": "  River School  "},
        headers=admin_headers,
    )
    assert saved.status_code == 200, saved.text
    assert (
        client.get("/api/settings/school/identity", headers=headers).json()["name"]
        == "River School"
    )
    assert (
        client.put(
            "/api/settings/school/identity", json={"name": "  "}, headers=admin_headers
        ).status_code
        == 422
    )
    assert (
        client.get("/api/settings/setup/checklist", headers=headers).status_code == 403
    )
    state = client.post(
        "/api/settings/setup/attendance-reviewed", json={}, headers=admin_headers
    )
    assert state.status_code == 200, state.text
    assert state.json()["attendance"] is True


def test_school_logo_larger_than_a_small_setting_is_saved_and_readable(
    client, admin_headers, student_factory, db_session
):
    import base64
    from app.schemas.points import SystemSetting

    _, student_headers = student_factory()
    image = Image.new("RGB", (640, 480))
    image.putdata(
        [(x % 256, y % 256, (x * y) % 256) for y in range(480) for x in range(640)]
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    response = client.post(
        "/api/settings/school/logo",
        files={"file": ("school.png", buffer.getvalue(), "image/png")},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    logo = response.json()["logo"]
    assert len(logo) > 500
    assert logo.startswith("data:image/png;base64,")
    normalized = Image.open(io.BytesIO(base64.b64decode(logo.split(",", 1)[1])))
    assert max(normalized.size) <= 512
    assert (
        client.get("/api/settings/school/identity", headers=student_headers).json()[
            "logo"
        ]
        == logo
    )
    # Shared setting response models must not retain the small input limit.
    assert (
        SystemSetting(
            id=1,
            setting_key="school.logo",
            setting_value=logo,
            setting_type="string",
            description="School logo",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        ).setting_value
        == logo
    )
    # The approved image exception must still recover from the ordinary JSON backup.
    from app.models.points import SystemSettings

    backup = client.get("/api/backup/export", headers=admin_headers).json()
    db_session.query(SystemSettings).filter_by(setting_key="school.logo").delete()
    db_session.commit()
    restored = client.post(
        "/api/backup/import", json={"backup_data": backup}, headers=admin_headers
    )
    assert restored.status_code == 200 and restored.json()["success"], restored.text
    assert (
        client.get("/api/settings/school/identity", headers=student_headers).json()[
            "logo"
        ]
        == logo
    )
