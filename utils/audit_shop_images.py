#!/usr/bin/env python3
"""Read-only audit of legacy shop images. Uses the application's DB settings.

Run ``python -m utils.audit_shop_images`` from the repository root. Unsafe rows
are blocked by the image-serving route; re-upload affected catalog images.
This command never deletes or rewrites stored bytes.
"""

import json

from sqlalchemy.orm import Session

from app.core.database import get_engine
from app.core.image_storage import validate_stored_image
from app.models.shop import ShopImage


def main():
    unsafe = []
    checked = 0
    with Session(get_engine()) as db:
        for row in db.query(ShopImage).yield_per(100):
            checked += 1
            try:
                validate_stored_image(row.data, row.mime_type)
            except ValueError:
                unsafe.append(row.external_id)
    print(json.dumps({"checked": checked, "unsafe_image_ids": unsafe}))
    return 1 if unsafe else 0


if __name__ == "__main__":
    raise SystemExit(main())
