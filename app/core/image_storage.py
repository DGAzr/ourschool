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

"""Thin storage seam for Points Shop images.

Images are stored as bytea rows in ``shop_images`` so they ride along in DB
backups and each deployment stays DB-only. Routes call only the four functions
below — ``process_upload``, ``store_image``, ``get_image``, ``delete_image`` —
so an S3-backed implementation could replace this module without touching the
routers or the frontend (the ``db`` param would simply be ignored).
"""

import io
from typing import Optional, Tuple

from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.models.shop import ShopImage

# Reject anything larger than this raw upload size before decoding.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
# Longest edge after downscale.
MAX_EDGE = 1200
JPEG_QUALITY = 85


def process_upload(raw: bytes) -> Tuple[bytes, str]:
    """Validate, normalize, downscale and re-encode an uploaded image.

    Returns ``(data, mime_type)``. Raises ``ValueError`` for non-images or
    oversize uploads. Images with an alpha channel are saved as PNG; everything
    else is flattened and saved as JPEG (q85).

    The client-declared MIME type is deliberately ignored — the output type is
    derived from the actual decoded pixels (Pillow), which is both more robust
    and safer than trusting the upload header.
    """
    if not raw:
        raise ValueError("Empty upload")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValueError(
            f"Image too large ({len(raw)} bytes); max is {MAX_UPLOAD_BYTES}"
        )

    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()  # detect truncated/garbage data
    except Exception as exc:  # noqa: BLE001 - normalize any decode failure
        raise ValueError("Uploaded file is not a valid image") from exc

    # verify() leaves the image unusable; reopen for actual processing.
    image = Image.open(io.BytesIO(raw))
    # Honor EXIF orientation, then drop the metadata.
    image = ImageOps.exif_transpose(image)

    # Downscale so the longest edge is <= MAX_EDGE (never upscale).
    if max(image.size) > MAX_EDGE:
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )

    out = io.BytesIO()
    if has_alpha:
        image = image.convert("RGBA")
        image.save(out, format="PNG", optimize=True)
        mime = "image/png"
    else:
        image = image.convert("RGB")
        image.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        mime = "image/jpeg"

    return out.getvalue(), mime


def store_image(db: Session, data: bytes, mime: str) -> str:
    """Persist image bytes and return the new ``external_id``.

    Flushes (so the row + external_id are available) but does not commit; the
    caller controls the transaction boundary.
    """
    image = ShopImage(mime_type=mime, size_bytes=len(data), data=data)
    db.add(image)
    db.flush()
    db.refresh(image)
    return image.external_id


def get_image(db: Session, external_id: str) -> Optional[Tuple[bytes, str]]:
    """Return ``(data, mime_type)`` for the image, or None if not found."""
    image = db.query(ShopImage).filter(ShopImage.external_id == external_id).first()
    if image is None:
        return None
    return image.data, image.mime_type


def delete_image(db: Session, external_id: str) -> bool:
    """Delete an image by external_id. Returns True if a row was removed.

    Does not commit; the caller controls the transaction boundary.
    """
    image = db.query(ShopImage).filter(ShopImage.external_id == external_id).first()
    if image is None:
        return False
    db.delete(image)
    return True
