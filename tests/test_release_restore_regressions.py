"""Release regressions: atomic previews and complete canonical backup restores."""

import base64
import copy
import uuid
from datetime import date, datetime, timezone

import pytest


def export(client, headers):
    response = client.get("/api/backup/export", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def restore(client, headers, backup, **options):
    response = client.post(
        "/api/backup/import",
        headers=headers,
        json={
            "backup_data": backup,
            "import_options": options,
            "wipe_confirmation": "WIPE ALL DATA",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def canonical(backup):
    """Ignore export timing, local IDs, and unordered lesson membership."""
    data = copy.deepcopy(backup)
    for key in ("backup_timestamp", "created_by", "system_info"):
        data.pop(key)
    for user in data["users"]:
        user.pop("parent_id")
    # Student membership has no defined order; materials/resources do.
    for lesson in data["lessons"]:
        lesson["students"].sort(key=lambda student: str(sorted(student.items())))
    for value in data.values():
        if isinstance(value, list):
            value.sort(key=lambda row: str(sorted(row.items())))
    return data


@pytest.mark.parametrize("order", [(2, 0, 1), (1, 2, 0), (2, 1, 0)])
def test_canonical_ignores_lesson_student_order_without_mutating_backup(order):
    students = [
        {"student_external_id": f"student-{i}", "student_email": f"s{i}@test.local"}
        for i in range(3)
    ]
    before = {
        "backup_timestamp": "2026-10-07T00:00:00Z",
        "created_by": "admin",
        "system_info": {},
        "users": [],
        "lessons": [{"external_id": "lesson", "students": students}],
    }
    after = copy.deepcopy(before)
    after["lessons"][0]["students"] = [students[i] for i in order]
    original = copy.deepcopy(after)

    assert canonical(after) == canonical(before)
    assert after == original


@pytest.mark.parametrize("change", ["missing", "duplicate", "email", "materials"])
def test_canonical_preserves_lesson_membership_and_ordered_content(change):
    before = {
        "backup_timestamp": "2026-10-07T00:00:00Z",
        "created_by": "admin",
        "system_info": {},
        "users": [],
        "lessons": [
            {
                "external_id": "lesson",
                "students": [
                    {"student_external_id": "student", "student_email": "s@test.local"}
                ],
                "materials": [{"text": "First"}, {"text": "Second"}],
            }
        ],
    }
    after = copy.deepcopy(before)
    lesson = after["lessons"][0]
    if change == "missing":
        lesson["students"].clear()
    elif change == "duplicate":
        lesson["students"].append(copy.deepcopy(lesson["students"][0]))
    elif change == "email":
        lesson["students"][0]["student_email"] = "changed@test.local"
    else:
        lesson["materials"].reverse()

    assert canonical(after) != canonical(before)


@pytest.mark.parametrize("wipe", [False, True])
@pytest.mark.parametrize("fail_late", [False, True])
def test_custom_type_preview_and_failed_import_are_atomic(
    client, admin_headers, classroom, student_factory, assign, wipe, fail_late
):
    student, _ = student_factory()
    assign(classroom["template"]["id"], student["id"])
    before = export(client, admin_headers)
    backup = copy.deepcopy(before)
    new_template = copy.deepcopy(backup["assignment_templates"][0])
    new_template.update(
        external_id=str(uuid.uuid4()),
        name="Preview " + str(uuid.uuid4()),
        assignment_type="missing_" + uuid.uuid4().hex[:12],
    )
    backup["assignment_templates"].append(new_template)
    # Invalid image fails after all academic records have been imported.
    if fail_late:
        backup["shop_images"].append(
            dict(
                external_id=str(uuid.uuid4()),
                mime_type="text/html",
                size_bytes=1,
                data_b64=base64.b64encode(b"<html>unsafe</html>").decode(),
                created_at="2026-10-07T00:00:00Z",
            )
        )
    result = restore(
        client, admin_headers, backup, dry_run=not fail_late, wipe_before_import=wipe
    )
    assert result["success"] is (not fail_late), result
    assert canonical(export(client, admin_headers)) == canonical(before)
    # A failing preview must also roll back, and leave its browser session usable.
    if fail_late:
        result = restore(
            client, admin_headers, backup, dry_run=True, wipe_before_import=wipe
        )
        assert not result["success"]
        assert canonical(export(client, admin_headers)) == canonical(before)


def test_full_restore_preserves_duplicate_work_audit_and_points(
    client, admin_headers, db_session, classroom, student_factory, reauthenticate
):
    from app.enums import AssignmentStatus
    from app.models.assignment import (
        AssignmentTemplate,
        AssignmentTimeEntry,
        StudentAssignment,
    )
    from app.models.assignment_type import AssignmentTypeConfig
    from app.models.journal import JournalEntry, JournalReply
    from app.models.lesson import Lesson, LessonTemplate
    from app.models.points import PointTransaction, StudentPoints
    from app.models.shop import ShopCategory, ShopItem, ShopRedemption
    from app.models.term import GradeHistory, StudentTermGrade, TermSubject
    from app.models.user import User

    student_data, _ = student_factory()
    student = db_session.get(User, student_data["id"])
    admin = db_session.query(User).filter_by(username="admin").one()
    student.parent_id = admin.id
    stamp = datetime(2026, 3, 10, 1, 30, tzinfo=timezone.utc)
    key = "release_" + uuid.uuid4().hex[:10]
    db_session.add(
        AssignmentTypeConfig(
            key=key,
            name="Weighted test",
            color="#123456",
            icon="Book",
            weight=80,
            display_order=3,
        )
    )
    lesson = Lesson(
        title="Restore ownership",
        date=date(2026, 3, 9),
        subject_id=classroom["subject"]["id"],
        created_by=admin.id,
        students=[student],
        templates=[LessonTemplate(template_id=classroom["template"]["id"])],
    )
    db_session.add(
        AssignmentTemplate(
            name="Archived " + key,
            subject_id=classroom["subject"]["id"],
            assignment_type=key,
            is_archived=True,
            export_data='{"legacy": "keep"}',
        )
    )
    db_session.query(AssignmentTypeConfig).filter_by(key="homework").one().weight = 20
    db_session.add(lesson)
    db_session.flush()
    assignments = [
        StudentAssignment(
            template_id=classroom["template"]["id"],
            student_id=student.id,
            lesson_id=lesson.id if i == 0 else None,
            assigned_by=admin.id,
            due_date=date(2026, 3, 9),
            assigned_date=date(2026, 3, 8),
            status=AssignmentStatus.GRADED if i == 0 else AssignmentStatus.SUBMITTED,
            points_earned=80 if i == 0 else None,
            is_graded=i == 0,
            percentage_grade=80 if i == 0 else None,
            graded_by=admin.id if i == 0 else None,
            graded_date=date(2026, 3, 12) if i == 0 else None,
            started_date=date(2026, 3, 8),
            submitted_date=date(2026, 3, 10),
            completed_date=date(2026, 3, 10),
            student_notes=f"Work {i}",
            time_spent_minutes=12 if i == 0 else 18,
            created_at=stamp,
            updated_at=stamp,
        )
        for i in range(2)
    ]
    db_session.add_all(assignments)
    db_session.flush()
    for assignment in assignments:
        # Identical sessions are legitimate distinct records, not duplicates.
        for _ in range(2):
            db_session.add(
                AssignmentTimeEntry(
                    assignment_id=assignment.id,
                    logged_by=student.id,
                    work_date=date(2026, 3, 9),
                    minutes=assignment.time_spent_minutes // 2,
                    note="Work",
                    created_at=stamp,
                    updated_at=stamp,
                )
            )
    ts = (
        db_session.query(TermSubject)
        .filter_by(
            term_id=classroom["term"]["id"], subject_id=classroom["subject"]["id"]
        )
        .first()
    )
    if ts is None:
        ts = TermSubject(
            term_id=classroom["term"]["id"], subject_id=classroom["subject"]["id"]
        )
        db_session.add(ts)
        db_session.flush()
    ts.learning_goals = "Preserve the goal"
    ts.teacher_notes = "Preserve the note"
    grade = StudentTermGrade(
        student_id=student.id,
        term_subject_id=ts.id,
        current_points_earned=80,
        current_points_possible=100,
        current_percentage=80,
        is_finalized=True,
        finalized_date=date(2026, 3, 12),
        finalized_by=admin.id,
        student_reflection="Keep trying",
        parent_notes="Good work",
        strengths="Persistence",
    )
    journal = JournalEntry(
        student_id=student.id,
        author_id=student.id,
        title="Late reflection",
        content="Do not change the local day",
        entry_date=stamp,
        replies=[
            JournalReply(author_id=admin.id, text="Teacher response", created_at=stamp)
        ],
    )
    db_session.add_all([grade, journal])
    db_session.flush()
    from app.models.paperless import (
        PaperlessLibrary,
        PaperlessDocument,
        StudentAssignmentPaperlessMaterial,
    )

    library = PaperlessLibrary(id=str(uuid.uuid4()), url="https://restore.invalid")
    db_session.add(library)
    db_session.flush()
    document = PaperlessDocument(
        library_id=library.id,
        paperless_id=501,
        title="Second work material",
        material_kind="worksheet",
        tag_ids=[],
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(
        StudentAssignmentPaperlessMaterial(
            student_assignment_id=assignments[1].id,
            document_id=document.id,
            title=document.title,
            material_kind="worksheet",
            created_at=stamp,
        )
    )
    db_session.add(
        GradeHistory(
            student_term_grade_id=grade.id,
            assignment_id=assignments[0].id,
            changed_by=admin.id,
            field_name="current_percentage",
            old_value="70",
            new_value="80",
            change_reason="Recheck",
            changed_at=stamp,
        )
    )
    tx = PointTransaction(
        student_id=student.id,
        amount=80,
        transaction_type="assignment",
        source_id=assignments[0].id,
        admin_id=admin.id,
        actor_name="Teacher",
        created_at=stamp,
    )
    jtx = PointTransaction(
        student_id=student.id,
        amount=2,
        transaction_type="journal_submission",
        source_id=journal.id,
        created_at=stamp,
    )
    spend = PointTransaction(
        student_id=student.id, amount=-10, transaction_type="spending"
    )
    refund = PointTransaction(
        student_id=student.id, amount=10, transaction_type="refund"
    )
    db_session.add_all([tx, jtx, spend, refund])
    category = ShopCategory(name="Restore rewards")
    db_session.add(category)
    db_session.flush()
    item = ShopItem(
        category_id=category.id,
        name="Restore reward",
        cost_points=10,
        fulfillment_type="request",
        quantity_available=1,
    )
    db_session.add(item)
    db_session.flush()
    db_session.add(
        ShopRedemption(
            student_id=student.id,
            item_id=item.id,
            item_name=item.name,
            cost_points=10,
            fulfillment_type="request",
            status="declined",
            points_refunded=True,
            point_transaction_id=spend.id,
            refund_transaction_id=refund.id,
            decided_by=admin.id,
            decided_at=stamp,
        )
    )
    db_session.add(
        StudentPoints(
            student_id=student.id,
            current_balance=82,
            total_earned=82,
            total_spent=0,
            goal_item_id=item.id,
        )
    )
    db_session.commit()
    assignment_ids = [a.external_id for a in assignments]
    before = export(client, admin_headers)
    assert before["format_version"] == "2.6"
    # Simulate restore into an installation with a different local admin UUID.
    admin.external_id = str(uuid.uuid4())
    db_session.commit()
    reauthenticate(admin_headers)
    result = restore(
        client, admin_headers, before, wipe_before_import=True, allow_admin_import=True
    )
    assert result["success"], result
    reauthenticate(admin_headers)
    after = export(client, admin_headers)
    for section, rows in canonical(before).items():
        assert canonical(after)[section] == rows, section
    from app.crud.settings import get_assignment_type_weights
    from app.utils.grading import compute_weighted_grade

    db_session.expire_all()
    assert compute_weighted_grade(
        [(100, 100, "homework"), (50, 100, key)],
        get_assignment_type_weights(db_session),
    )[2] == pytest.approx(60)
    result = restore(client, admin_headers, before)
    assert result["success"], result
    reauthenticate(admin_headers)
    assert canonical(export(client, admin_headers)) == canonical(before)
    db_session.expire_all()
    restored = (
        db_session.query(StudentAssignment)
        .filter_by(external_id=assignment_ids[0])
        .one()
    )
    restored_student_id = restored.student_id
    response = client.post(
        f"/api/assignments/student-assignments/{restored.id}/grade",
        headers=admin_headers,
        json={"points_earned": 80},
    )
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert (
        db_session.query(StudentPoints)
        .filter_by(student_id=restored_student_id)
        .one()
        .current_balance
        == 82
    )
    response = client.post(
        f"/api/assignments/student-assignments/{restored.id}/grade",
        headers=admin_headers,
        json={"points_earned": 90},
    )
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert (
        db_session.query(StudentPoints)
        .filter_by(student_id=restored_student_id)
        .one()
        .current_balance
        == 92
    )
    response = client.put(
        f"/api/lessons/{restored.lesson_id}",
        headers=admin_headers,
        json={"title": "Restored lesson edited"},
    )
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert (
        db_session.query(StudentAssignment)
        .filter(
            StudentAssignment.student_id == restored_student_id,
            StudentAssignment.template_id == restored.template_id,
        )
        .count()
        == 2
    )


@pytest.mark.parametrize("payload", [b"<html>active content</html>", b"not an image"])
def test_invalid_legacy_shop_images_cannot_be_served(
    client, db_session, payload, monkeypatch
):
    from app.models.shop import ShopImage

    image = ShopImage(data=payload, mime_type="text/html", size_bytes=len(payload))
    db_session.add(image)
    db_session.commit()
    response = client.get(f"/api/shop/images/{image.external_id}")
    assert response.status_code == 404
    response = client.get(
        f"/api/shop/images/{image.external_id}",
        headers={"If-None-Match": f'"{image.external_id}"'},
    )
    assert response.status_code == 404
    from utils import audit_shop_images

    monkeypatch.setattr(audit_shop_images, "get_engine", lambda: db_session.bind)
    assert audit_shop_images.main() == 1
    db_session.expire_all()
    assert image.data == payload
    db_session.delete(image)
    db_session.commit()


@pytest.mark.parametrize("version", ["1.0", "2.0", "2.1", "2.2", "2.3", "2.4", "2.5"])
def test_legacy_backup_preserves_repeated_assignments(
    version, client, admin_headers, student_factory, classroom, assign, reauthenticate
):
    student, _ = student_factory()
    assign(classroom["template"]["id"], student["id"], due_date="2026-03-09")
    source = export(client, admin_headers)
    first = next(
        row
        for row in source["student_assignments"]
        if row["student_email"] == student["email"]
    )
    for key in (
        "external_id",
        "lesson_external_id",
        "assigned_by_external_id",
        "assigned_by_email",
        "graded_by_external_id",
        "graded_by_email",
        "is_graded",
        "graded_date",
        "percentage_grade",
    ):
        first.pop(key)
    second = copy.deepcopy(first)
    first["student_notes"], second["student_notes"] = "First work", "Second work"
    backup = {
        key: source[key]
        for key in (
            "backup_timestamp",
            "created_by",
            "users",
            "subjects",
            "terms",
            "assignment_templates",
        )
    }
    backup.update(format_version=version, student_assignments=[first, second])
    result = restore(client, admin_headers, backup, wipe_before_import=True)
    assert result["success"], result
    reauthenticate(admin_headers)
    restored = export(client, admin_headers)
    work = [
        row
        for row in restored["student_assignments"]
        if row["student_email"] == student["email"]
    ]
    assert sorted(row["student_notes"] for row in work) == ["First work", "Second work"]
    result = restore(client, admin_headers, backup)
    assert result["success"], result
    assert result["imported_counts"]["student_assignments"] == 0
    reauthenticate(admin_headers)
    assert len(export(client, admin_headers)["student_assignments"]) == 2


def test_import_image_ignores_declared_mime_and_size(
    client, admin_headers, classroom, reauthenticate
):
    import io
    from PIL import Image

    raw = io.BytesIO()
    Image.new("RGBA", (10, 10), (10, 20, 30, 128)).save(raw, format="PNG")
    backup = export(client, admin_headers)
    image_id = str(uuid.uuid4())
    backup["shop_images"] = [
        dict(
            external_id=image_id,
            mime_type="text/html",
            size_bytes=1,
            data_b64=base64.b64encode(raw.getvalue()).decode(),
            created_at="2026-10-07T00:00:00Z",
        )
    ]
    result = restore(client, admin_headers, backup)
    assert result["success"], result
    reauthenticate(admin_headers)
    stored = next(
        row
        for row in export(client, admin_headers)["shop_images"]
        if row["external_id"] == image_id
    )
    assert stored["mime_type"] == "image/png"
    assert stored["size_bytes"] == len(base64.b64decode(stored["data_b64"]))
    response = client.get(f"/api/shop/images/{image_id}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize("kind", ["invalid-base64", "oversized-valid-image"])
def test_import_rejects_invalid_or_oversized_image_encoding(
    client, admin_headers, kind, monkeypatch
):
    import io
    from PIL import Image
    from app.core import image_storage

    raw = io.BytesIO()
    Image.new("RGBA", (32, 32), (10, 20, 30, 128)).save(
        raw, format="PNG", compress_level=0
    )
    encoded = base64.b64encode(raw.getvalue()).decode()
    if kind == "invalid-base64":
        # A lenient decoder would silently ignore this character and accept it.
        encoded = "!" + encoded
    else:
        # Exercise the real limit with valid pixels, without a huge allocation.
        monkeypatch.setattr(image_storage, "MAX_UPLOAD_BYTES", 1024)
        assert len(raw.getvalue()) > image_storage.MAX_UPLOAD_BYTES
    backup = export(client, admin_headers)
    before = canonical(backup)
    backup["shop_images"] = [
        dict(
            external_id=str(uuid.uuid4()),
            mime_type="image/png",
            size_bytes=1,
            data_b64=encoded,
            created_at="2026-10-07T00:00:00Z",
        )
    ]
    result = restore(
        client, admin_headers, backup, dry_run=True, wipe_before_import=True
    )
    assert not result["success"]
    assert canonical(export(client, admin_headers)) == before


def test_jpeg_restore_is_lossless_and_repeatable(client, admin_headers, reauthenticate):
    import io
    from PIL import Image

    source = Image.new("RGB", (80, 80))
    source.putdata(
        [(x * 3, y * 3, (x * y) % 256) for y in range(80) for x in range(80)]
    )
    raw = io.BytesIO()
    source.save(raw, format="JPEG", quality=85)
    decoded = Image.open(io.BytesIO(raw.getvalue())).convert("RGB").tobytes()
    backup = export(client, admin_headers)
    image_id = str(uuid.uuid4())
    backup["shop_images"] = [
        dict(
            external_id=image_id,
            mime_type="image/jpeg",
            size_bytes=len(raw.getvalue()),
            data_b64=base64.b64encode(raw.getvalue()).decode(),
            created_at="2026-10-07T00:00:00Z",
        )
    ]
    assert restore(client, admin_headers, backup, wipe_before_import=True)["success"]
    reauthenticate(admin_headers)
    response = client.get(f"/api/shop/images/{image_id}")
    assert response.status_code == 200
    assert Image.open(io.BytesIO(response.content)).convert("RGB").tobytes() == decoded
    second_backup = export(client, admin_headers)
    assert restore(client, admin_headers, second_backup, wipe_before_import=True)[
        "success"
    ]
    reauthenticate(admin_headers)
    assert client.get(f"/api/shop/images/{image_id}").content == response.content
