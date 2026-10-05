"""Normalize the explicitly permitted school logo for JSON-backed settings."""

import io
import re
from pathlib import PurePosixPath

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError


def prepare_school_logo(data: bytes, filename: str):
    """Decode a raster logo, orient it, strip metadata and bound its dimensions."""
    name = (
        re.sub(r"[\x00-\x1f\x7f]", "", PurePosixPath(filename.replace("\\", "/")).name)[
            :160
        ]
        or "logo"
    )
    try:
        with Image.open(io.BytesIO(data)) as picture:
            if picture.width * picture.height > 20_000_000:
                raise HTTPException(413, "Use an image under 20 megapixels")
            picture.load()
            picture = ImageOps.exif_transpose(picture)
            picture.thumbnail((512, 512))
            output = io.BytesIO()
            normalized = picture.convert("RGBA")
            normalized.info.clear()
            normalized.save(output, format="PNG")
            return output.getvalue(), name.rsplit(".", 1)[0] + ".png", "image/png"
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        Image.DecompressionBombError,
        ValueError,
    ) as exc:
        raise HTTPException(415, "Choose a PNG, JPEG or WebP logo") from exc
