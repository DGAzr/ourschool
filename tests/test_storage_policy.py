"""Guard the approved storage boundary and the public JSON-only work contract."""

from sqlalchemy import LargeBinary

from app.core.database import Base
from app.schemas.assignment import StudentAssignmentResponse
from app.schemas.backup import JournalEntryBackup, StudentAssignmentBackup
from app.schemas.journal import JournalEntryResponse
import app.models  # noqa: F401


def test_binary_storage_is_limited_to_shop_images_and_existing_derived_cache():
    binary_columns = {
        (table.name, column.name)
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, LargeBinary)
    }
    assert binary_columns == {("shop_images", "data"), ("paperless_thumbnails", "data")}
    assert "assignment_attachments" not in Base.metadata.tables
    assert "journal_photos" not in Base.metadata.tables


def test_school_work_contracts_do_not_export_or_serve_file_metadata(client):
    assert "attachments" not in StudentAssignmentResponse.model_fields
    assert "work_attachments" not in StudentAssignmentBackup.model_fields
    assert "photos" not in JournalEntryResponse.model_fields
    assert "photos" not in JournalEntryBackup.model_fields
    # Inspect the contract even when the public documentation endpoint is disabled.
    routes = set(client.app.openapi()["paths"])
    assert (
        "/api/assignments/student-assignments/{assignment_id}/attachments" not in routes
    )
    assert "/api/journal/entries/{entry_id}/photos" not in routes
