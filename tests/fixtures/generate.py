"""Generate public synthetic test images. Requires Pillow only when regenerating."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent


def scene(shift=0):
    image = Image.new("RGB", (320, 240), "#b5deed")
    draw = ImageDraw.Draw(image)
    draw.ellipse((236, 20, 280, 64), fill="#ffdc7f")
    draw.polygon([(0, 190), (115, 72 + shift), (245, 190)], fill="#39796b")
    draw.polygon([(95, 190), (245, 100), (320, 190)], fill="#73a68d")
    draw.rectangle((0, 185, 320, 240), fill="#e8d9b2")
    draw.rectangle((30 + shift, 115, 40 + shift, 205), fill="#6f533e")
    draw.ellipse((0 + shift, 75, 70 + shift, 155), fill="#245c46")
    return image


scene().save(ROOT / "landscape.jpg", quality=88)
scene(8).save(ROOT / "landscape-2.jpg", quality=88)
exif = Image.Exif()
exif[274] = 6
scene().save(ROOT / "portrait-exif-6.jpg", quality=88, exif=exif)
transparent = Image.new("RGBA", (100, 80), (0, 0, 0, 0))
ImageDraw.Draw(transparent).ellipse((10, 5, 90, 75), fill=(22, 98, 79, 180))
transparent.save(ROOT / "transparent.png")
scene().save(ROOT / "static.webp", quality=85)
transparent.save(ROOT / "lossless.webp", lossless=True)
scene().save(ROOT / "animated.webp", save_all=True,
             append_images=[scene(8)], duration=150, loop=0)
(ROOT / "broken.jpg").write_bytes(b"\xff\xd8\xff\xe1\x00\x01broken")
(ROOT / "empty.jpg").write_bytes(b"")
