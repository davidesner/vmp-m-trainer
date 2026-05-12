#!/usr/bin/env python3
"""Backfill missing meta.json files for explanation HTMLs.

For each .html in explanations/ that lacks a sibling .meta.json,
extract source URLs from the HTML, then write a meta file with:
  - qid           (from filename)
  - generated_at  (file mtime, ISO 8601 Z)
  - sources       (http/https URLs found in HTML, excluding SVG namespace)
  - model         (passed in via --opus or --sonnet, or per-id mapping)
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

URL_RE = re.compile(r'https?://[^"\'\s<>]+')
EXCLUDE_HOSTS = {"www.w3.org"}

# qids whose orphan HTML predates the Opus->Sonnet switch (commit 3c293e8 on 2026-05-06 19:10).
OPUS_QIDS = {19, 183, 184}


def model_for(qid: int) -> str:
    return "claude-opus-4-7" if qid in OPUS_QIDS else "claude-sonnet-4-6"


def extract_sources(html: str) -> list[str]:
    seen = []
    for url in URL_RE.findall(html):
        url = url.rstrip(').,;')
        host = url.split('/', 3)[2] if '://' in url else ''
        if host in EXCLUDE_HOSTS:
            continue
        if url not in seen:
            seen.append(url)
    return seen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir', default='explanations')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    root = Path(args.dir)
    written = 0
    for html_path in sorted(root.glob('q-*.html')):
        qid_str = html_path.stem.removeprefix('q-')
        meta_path = root / f'q-{qid_str}.meta.json'
        if meta_path.exists():
            continue
        try:
            qid = int(qid_str)
        except ValueError:
            print(f'skip: cannot parse qid from {html_path.name}', file=sys.stderr)
            continue

        html = html_path.read_text(encoding='utf-8')
        sources = extract_sources(html)
        mtime = datetime.fromtimestamp(html_path.stat().st_mtime, tz=timezone.utc)
        generated_at = mtime.strftime('%Y-%m-%dT%H:%M:%SZ')

        meta = {
            'qid': qid,
            'generated_at': generated_at,
            'sources': sources,
            'model': model_for(qid),
        }

        if args.dry_run:
            print(f'[dry] {meta_path.name}: {json.dumps(meta, ensure_ascii=False)}')
        else:
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f'wrote {meta_path.name} (sources: {len(sources)}, model: {meta["model"]})')
        written += 1

    print(f'\n{"would write" if args.dry_run else "wrote"} {written} meta files')


if __name__ == '__main__':
    main()
