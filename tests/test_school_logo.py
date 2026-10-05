"""School logos retain orientation and transparency within bounded JSON settings."""

import io
from PIL import Image
from app.services.school_logo import prepare_school_logo


def test_logo_orientation_and_metadata_removal():
    image = Image.new("RGB", (10, 20), "blue")
    exif = Image.Exif()
    exif[274] = 6
    exif[315] = "Private device owner"
    output = io.BytesIO()
    image.save(output, format="JPEG", exif=exif)
    data, filename, media = prepare_school_logo(output.getvalue(), "../camera.jpg")
    with Image.open(io.BytesIO(data)) as normalized:
        assert normalized.size == (20, 10)
        assert not normalized.getexif()
    assert filename == "camera.png" and media == "image/png"


def test_printable_logo_keeps_transparency_and_is_bounded():
    output = io.BytesIO()
    Image.new("RGBA", (1024, 512), (0, 0, 0, 0)).save(output, format="PNG")
    data, filename, media = prepare_school_logo(output.getvalue(), "logo.png")
    with Image.open(io.BytesIO(data)) as normalized:
        assert normalized.size == (512, 256)
        assert normalized.getpixel((0, 0))[3] == 0
    assert filename == "logo.png" and media == "image/png"
