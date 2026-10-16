"""Reproduce hash-pinned, licensed HDR+ derivatives. No photographs enter git."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.request
os.environ['OMP_NUM_THREADS'] = '1'
import rawpy
import numpy
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache' / 'embedding-burst'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def acquire(manifest):
    if (rawpy.__version__, numpy.__version__, pillow_version) != ('0.25.1', '2.2.6', '11.3.0'):
        raise RuntimeError('Use the exact developer renderer requirements')
    CACHE.mkdir(parents=True, exist_ok=True)
    for item in manifest['images']:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', item['id']):
            raise ValueError('Invalid fixture ID')
        source = item['source']
        if not re.fullmatch(r'https://storage.googleapis.com/hdrplusdata/20171106_subset/bursts/[0-9_]+/payload_N[0-9]+\.dng', source['url']):
            raise ValueError('Unexpected fixture origin')
        size = int(source['size'])
        if not 0 < size <= 20000000 or not re.fullmatch(r'[0-9]+', source['generation']):
            raise ValueError('Invalid source size or generation')
        raw_path = CACHE / (item['id'] + '.dng')
        if raw_path.exists():
            data = raw_path.read_bytes()
        else:
            url = source['url'] + '?generation=' + source['generation']
            with urllib.request.urlopen(url, timeout=120) as response:
                data = response.read(size + 1)
        if len(data) != size or digest(data) != source['sha256']:
            raise ValueError('Raw fixture bytes changed: ' + item['id'])
        if base64.b64encode(hashlib.md5(data).digest()).decode() != source['md5Hash']:
            raise ValueError('Source MD5 mismatch')
        if not raw_path.exists():
            raw_path.write_bytes(data)
        with rawpy.imread(str(raw_path)) as raw:
            rgb = raw.postprocess(half_size=True, use_camera_wb=True,
                no_auto_bright=True, output_bps=8, output_color=rawpy.ColorSpace.sRGB,
                gamma=(2.222, 4.5))
        image = Image.fromarray(rgb)
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        from io import BytesIO
        output = BytesIO()
        image.save(output, format='PNG', compress_level=6, optimize=False)
        rendered = output.getvalue()
        if len(rendered) != item['bytes'] or digest(rendered) != item['sha256']:
            raise ValueError('Rendered fixture bytes changed; do not re-pin to hide drift: ' + item['id'])
        if image.size != (item['width'], item['height']):
            raise ValueError('Rendered dimensions changed')
        (CACHE / (item['id'] + '.png')).write_bytes(rendered)
        print('Verified', item['id'], len(rendered), flush=True)

if __name__ == '__main__':
    acquire(json.loads((Path(__file__).parent / 'burst-holdout.json').read_text()))
