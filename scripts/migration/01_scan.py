#!/usr/bin/env python3
# Source: Vault-Framework/scripts/migration/01_scan.py @ 04ab894
"""Scan all markdown files and emit migration/scan.jsonl."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow `python scripts/migration/01_scan.py` without installing a package.
_SCRIPTS = Path(__file__).resolve().parents[1]
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.common import (  # noqa: E402
    add_common_args,
    ensure_parent_dir,
    first_h1,
    git_first_commit_date,
    iter_markdown_files,
    json_safe,
    log,
    parse_frontmatter,
    rel_posix,
    resolve_repo_root,
)


def scan_file(repo_root: Path, abs_path: Path, verbose: bool) -> dict:
    """Extract scan metadata for one markdown file."""
    rel = rel_posix(repo_root, abs_path)
    try:
        text = abs_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"cannot read {rel}: {exc}") from exc

    try:
        fm, body_start, body = parse_frontmatter(text)
        has_fm = fm is not None
    except Exception as exc:  # noqa: BLE001 — capture broken FM as no-fm scan
        log(verbose, f"warn: broken front matter in {rel}: {exc}")
        fm = None
        has_fm = False
        body_start = 1
        body = text

    return {
        "path": rel,
        "has_frontmatter": has_fm,
        "existing_frontmatter": json_safe(fm),
        "body_start_line": body_start,
        "first_h1": first_h1(body),
        "first_commit_date": git_first_commit_date(repo_root, rel),
    }


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Scan markdown files for migration.")
    add_common_args(parser)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("migration/scan.jsonl"),
        help="Output JSONL path (default: migration/scan.jsonl)",
    )
    args = parser.parse_args(argv)

    try:
        repo_root = resolve_repo_root(args.repo_root)
        out = args.output if args.output.is_absolute() else repo_root / args.output
        ensure_parent_dir(out)

        count = 0
        with out.open("w", encoding="utf-8") as fh:
            for abs_path in iter_markdown_files(repo_root):
                row = scan_file(repo_root, abs_path, args.verbose)
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
                count += 1
                log(args.verbose, f"scanned {row['path']}")

        print(f"wrote {count} rows -> {out.as_posix()}", file=sys.stderr)
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
