"""Verify legacy identity preservation on a disposable migrated database.

Run against an EMPTY database named paperless_migration_* using DATABASE_URL.
This seeds synthetic data only; it never resets or drops an existing database.
"""

import os
import json
import uuid
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def main():
    url = os.environ["DATABASE_URL"]
    if not (make_url(url).database or "").startswith("paperless_migration_"):
        raise SystemExit("Use an empty disposable paperless_migration_* database")
    engine = create_engine(url)
    config = Config("alembic.ini")
    with engine.connect() as db:
        if db.execute(text("SELECT to_regclass('public.users')")).scalar():
            raise SystemExit("Database already contains application tables")
    command.upgrade(config, "d9e0f1a2b3c4")
    with engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO paperless_connection(id,url,token_encrypted,auto_import,index_ocr,mapped_only,document_count,tag_count,doctype_count) VALUES(7,'http://legacy.fake','encrypted-test',true,true,false,1,1,1)"
            )
        )
        db.execute(
            text(
                "INSERT INTO paperless_documents(id,external_id,paperless_id,title,material_kind,tag_ids,keywords,present,synced_at) VALUES(41,'preserved-external-id',1,'Legacy metadata','reading','[1]','cm 3',true,now())"
            )
        )
        db.execute(
            text(
                "INSERT INTO paperless_tag_subject_map(paperless_tag_id,paperless_tag_name,auto_matched) VALUES(1,'Manual map',false)"
            )
        )
        db.execute(
            text(
                "INSERT INTO lessons(id,external_id,title,date,status,position,created_at,updated_at) VALUES(42,'preserved-lesson','Migration lesson','2026-10-03','planned',0,now(),now())"
            )
        )
        db.execute(
            text(
                "INSERT INTO lesson_paperless_materials(lesson_id,document_id,title,material_kind,created_at) VALUES(42,41,'Preserved snapshot','reading',now())"
            )
        )
    for action in ("upgrade", "downgrade", "upgrade"):
        getattr(command, action)(
            config, "head" if action == "upgrade" else "d9e0f1a2b3c4"
        )
        with engine.connect() as db:
            assert db.execute(
                text(
                    "SELECT document_id,title FROM lesson_paperless_materials WHERE lesson_id=42"
                )
            ).one() == (41, "Preserved snapshot")
            assert (
                db.execute(
                    text("SELECT external_id FROM paperless_documents WHERE id=41")
                ).scalar()
                == "preserved-external-id"
            )
            if action == "upgrade":
                legacy = db.execute(
                    text("SELECT library_id FROM paperless_documents WHERE id=41")
                ).scalar()
                assert legacy != "00000000-0000-0000-0000-000000000001"
                assert db.execute(
                    text("SELECT id,library_id FROM paperless_connection")
                ).one() == (1, legacy)
    second_library = str(uuid.uuid4())
    with engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO paperless_libraries(id,url,created_at) VALUES(:id,'http://second.fake',now())"
            ),
            {"id": second_library},
        )
        db.execute(
            text(
                "INSERT INTO paperless_documents(external_id,library_id,paperless_id,title,material_kind,tag_ids,present,synced_at) VALUES('second-document',:library,1,'Colliding upstream ID','reading','[1]',true,now())"
            ),
            {"library": second_library},
        )
    try:
        command.downgrade(config, "d9e0f1a2b3c4")
    except RuntimeError as error:
        assert "multiple populated Paperless libraries" in str(error)
    else:
        raise AssertionError("Unsafe multi-library downgrade was allowed")
    with engine.connect() as db:
        assert (
            db.execute(text("SELECT version_num FROM alembic_version")).scalar()
            == "e0f1a2b3c4d5"
        )
        assert (
            db.execute(
                text("SELECT count(*) FROM paperless_documents WHERE paperless_id=1")
            ).scalar()
            == 2
        )
    print(
        json.dumps(
            {
                "upgrade_downgrade_reupgrade": "passed",
                "document_identity_and_attachment_snapshot": "preserved",
                "multi_library_downgrade": "safely refused without data loss",
            }
        )
    )
    engine.dispose()


if __name__ == "__main__":
    main()
