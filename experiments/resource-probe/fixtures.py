"""Generate bounded synthetic geometry, never acquire or use personal photos."""
import argparse, hashlib, json, os, platform
from pathlib import Path
from PIL import Image, ImageDraw, __version__, features
PROFILE = 'synthetic-geometric-12mp-v1'
p = argparse.ArgumentParser()
p.add_argument('--count', type=int, choices=[4, 100], default=4)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args()
a.output.mkdir(parents=True, exist_ok=True)
files = []
for i in range(a.count):
    width, height = (4000, 3000) if i % 2 == 0 else (3000, 4000)
    fmt, ext = [('JPEG', 'jpg'), ('PNG', 'png'), ('WEBP', 'webp')][i % 3]
    name = f'synthetic-{i+1:03d}.{ext}'
    # Coarse geometric tiles deliberately compress well. This measures full 12MP
    # decode dimensions, not photographic entropy or real-photo codec throughput.
    with Image.new('RGB', (width, height)) as image:
        draw = ImageDraw.Draw(image)
        for y in range(0, height, 100):
            for x in range(0, width, 100):
                color = ((x//100*31+i*17)%256, (y//100*43+i*29)%256, ((x+y)//100*19+i*37)%256)
                draw.rectangle((x,y,x+99,y+99), fill=color)
        opts = {'quality':85} if fmt in ['JPEG','WEBP'] else {'compress_level':6}
        image.save(a.output/name, format=fmt, **opts)
    file = a.output/name
    size = file.stat().st_size
    if size > 8*1024*1024: raise RuntimeError('Fixture exceeds 8 MiB encoded budget')
    with Image.open(file) as image:
        assert image.size == (width,height) and image.format == fmt
        image.verify()
    os.utime(file, (1700000000,1700000000))
    files.append(dict(name=name, format=fmt, width=width, height=height, bytes=size, sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
    if sum(f['bytes'] for f in files) > 256*1024*1024: raise RuntimeError('Fixture corpus exceeds 256 MiB budget')
manifest = dict(profile=PROFILE, count=a.count, python=platform.python_version(), pillow=__version__, codecs={name:features.version(name) for name in ['jpg','zlib','webp']}, files=files)
(a.output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n', encoding='utf-8')
print(f'Generated {a.count} synthetic 12MP images, {sum(f["bytes"] for f in files)} encoded bytes')
