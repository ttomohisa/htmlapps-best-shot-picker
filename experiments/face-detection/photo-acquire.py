#!/usr/bin/env python3
"""Explicit, pinned London photo acquisition for development and CI file-only parity. Never used by product builds or runtime."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import stat
import sys
import urllib.parse
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = ROOT / '.cache' / 'face-detection-photos' / 'london'
MANIFEST = HERE / 'photo-sample.json'
ALLOWED_ARCHIVES = {
    'neutral_front.zip': (8541961, 33860607, '236c1c94defbb34a79074b195841cfd6', '9fe8aa6f722008edfdec2dd956572316a107590573b1239c080ae0a89d2fa001'),
    'neutral_left_3quarter.zip': (8545675, 24176189, '1b9168282a6497eb3380b68017bbf2be', 'bd9868d810672cf099217fa9da6df58c3b94ef7584aa5443cd3c18ed7ec49503'),
    'neutral_left_profile.zip': (8545678, 25457035, '4b41c3b02ee08c659898d6db3cf11c53', '227b62a37ea4be7f2f42181f7ed5b8390ea2a605d02c84ec9540dc4f950b7b8a'),
}
EXPECTED_SAMPLE_HASH = 'db0aac83623a858a30402f0b6d61a81dc1be4417ec5c4db69116bf06c94d5625'


def digest(data, algorithm='sha256'):
    return hashlib.new(algorithm, data).hexdigest()


def safe_relative(name):
    """Accept only normalized relative POSIX names, never archive-controlled paths."""
    if not isinstance(name, str) or not name or '\\' in name or ':' in name or any(ord(c) < 32 or ord(c) == 127 for c in name):
        raise ValueError('Unsafe member path')
    parts = name.split('/')
    if name.startswith('/') or any(p in ('', '.', '..') for p in parts):
        raise ValueError('Unsafe member path: ' + name)
    return PurePosixPath(name)


def read_manifest():
    document = json.loads(MANIFEST.read_text(encoding='utf-8'))
    images = document['selection']['images']
    # This ASCII-only array uses the same two-space serialization as the original JS run.
    serialized = json.dumps(images, indent=2, ensure_ascii=False).encode()
    if digest(serialized) != EXPECTED_SAMPLE_HASH or len(images) != 24:
        raise ValueError('Frozen 24-image selection changed')
    if len({image['file'] for image in images}) != 24:
        raise ValueError('Duplicate selected photograph')
    for image in images:
        relative = safe_relative(image['file'])
        if relative.suffix != '.jpg' or relative.parts[0] + '.zip' not in ALLOWED_ARCHIVES:
            raise ValueError('Unexpected selected image')
    archives = document['archives']
    if len(archives) != 3 or len({a['name'] for a in archives}) != 3:
        raise ValueError('Expected only the three frozen image archives')
    for archive in archives:
        expected = ALLOWED_ARCHIVES.get(archive['name'])
        if expected is None:
            raise ValueError('Unexpected archive')
        file_id, size, md5, sha256 = expected
        if (archive['url'], archive['bytes'], archive['md5'], archive['sha256']) != (
            f'https://ndownloader.figshare.com/files/{file_id}', size, md5, sha256
        ):
            raise ValueError('Frozen archive pin changed: ' + archive['name'])
    return document


def verify_archive(data, record):
    if len(data) != record['bytes']:
        raise ValueError('Archive size mismatch: ' + record['name'])
    if digest(data, 'md5') != record['md5'] or digest(data) != record['sha256']:
        raise ValueError('Archive hash mismatch: ' + record['name'])
    return data


class HttpsRedirectsOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.username or parsed.password:
            raise ValueError('Refusing a non-HTTPS or credential-bearing redirect')
        return super().redirect_request(request, fp, code, message, headers, newurl)


def download_archive(record):
    """Public fixed Figshare URLs only. Limit bytes before accepting the body."""
    request = urllib.request.Request(record['url'], headers={'User-Agent': 'BestShotPicker-LocalResearch/1.0'})
    opener = urllib.request.build_opener(HttpsRedirectsOnly())
    body = io.BytesIO()
    with opener.open(request, timeout=120) as response:
        if response.status != 200:
            raise ValueError('Download failed: HTTP ' + str(response.status))
        if urllib.parse.urlsplit(response.geturl()).scheme != 'https':
            raise ValueError('Final download URL is not HTTPS')
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            if body.tell() + len(chunk) > record['bytes']:
                raise ValueError('Oversized archive: ' + record['name'])
            body.write(chunk)
    return verify_archive(body.getvalue(), record)


def selected_jpegs(data, wanted):
    """Return only verified selected JPEG bytes. Never use ZipFile.extract()."""
    result = {}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = {}
        for info in archive.infolist():
            if info.filename in wanted:
                if info.filename in entries:
                    raise ValueError('Duplicate selected ZIP member')
                safe_relative(info.filename)
                kind = stat.S_IFMT(info.external_attr >> 16)
                if info.is_dir() or kind not in (0, stat.S_IFREG) or info.flag_bits & 1:
                    raise ValueError('Selected ZIP entry is not an ordinary unencrypted file')
                if info.file_size <= 0 or info.file_size > 8 * 1024 * 1024:
                    raise ValueError('Unexpected selected JPEG size')
                entries[info.filename] = info
        if set(entries) != set(wanted):
            raise ValueError('Selected JPEG missing from archive')
        for name, expected_hash in wanted.items():
            image = archive.read(entries[name])
            if digest(image) != expected_hash:
                raise ValueError('Photograph SHA-256 mismatch: ' + name)
            if not image.startswith(b'\xff\xd8'):
                raise ValueError('Selected image is not a JPEG')
            result[name] = image
    return result


def save_verified(file, data):
    """Fail on changed files/symlinks rather than silently replacing evidence."""
    if not file.resolve().is_relative_to(CACHE.resolve()):
        raise ValueError('Output escaped the ignored photo cache')
    file.parent.mkdir(parents=True, exist_ok=True)
    if file.is_symlink():
        raise ValueError('Refusing a symlink output')
    if not file.resolve().is_relative_to(CACHE.resolve()):
        raise ValueError('Output escaped the ignored photo cache')
    if file.exists():
        if file.read_bytes() != data:
            raise ValueError('Existing cached bytes differ: ' + str(file))
        return
    with file.open('xb') as stream:
        stream.write(data)


def acquire(document, offline=False):
    # The only write route is invoked after the explicit --acquire flag.
    report = {'scope': 'Optional local research acquisition; no inference or publication', 'archives': [], 'images': []}
    for record in document['archives']:
        file = CACHE / 'archives' / record['name']
        if file.is_symlink() or not file.resolve().is_relative_to(CACHE.resolve()):
            raise ValueError('Refusing an unsafe archive cache path')
        if file.exists():
            data = verify_archive(file.read_bytes(), record)
        elif offline:
            raise ValueError('Missing cached archive in offline mode: ' + record['name'])
        else:
            data = download_archive(record)
        wanted = {image['file']: image['sha256'] for image in document['selection']['images'] if image['file'].split('/')[0] == Path(record['name']).stem}
        extracted = selected_jpegs(data, wanted)
        save_verified(file, data)
        report['archives'].append({'name': record['name'], 'bytes': len(data), 'md5': digest(data, 'md5'), 'sha256': digest(data)})
        for name, image in extracted.items():
            target = CACHE.joinpath(*safe_relative(name).parts)
            save_verified(target, image)
            report['images'].append({'file': name, 'bytes': len(image), 'sha256': digest(image)})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--dry-run', action='store_true', help='Validate manifest and print plan; no network, writes or image reads')
    mode.add_argument('--acquire', action='store_true', help='Explicitly download/reuse the three pinned archives and extract only 24 selected JPEGs')
    parser.add_argument('--offline', action='store_true', help='With --acquire, require already cached archives; never download')
    args = parser.parse_args()
    if args.offline and not args.acquire:
        parser.error('--offline requires --acquire')
    document = read_manifest()
    if args.dry_run:
        result = {'status': 'dry-run-only', 'network': False, 'writes': False, 'inference': False, 'cache': '.cache/face-detection-photos/london', 'archives': document['archives'], 'selectedPhotographs': len(document['selection']['images'])}
    else:
        result = acquire(document, args.offline)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
