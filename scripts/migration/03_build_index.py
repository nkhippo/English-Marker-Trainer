#!/usr/bin/env python3
# Source: Vault-Framework/scripts/migration/03_build_index.py @ 04ab894
"""Build path↔id index JSON files from Front Matter."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[1]
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.common import (  # noqa: E402
    add_common_args,
    ensure_parent_dir,
    iter_markdown_files,
    log,
    parse_frontmatter,
    rel_posix,
    resolve_repo_root,
)


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Build path↔id migration index.")
    add_common_args(parser)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("migration"),
        help="Output directory (default: migration/)",
    )
    args = parser.parse_args(argv)

    try:
        repo_root = resolve_repo_root(args.repo_root)
        out_dir = (
            args.output_dir
            if args.output_dir.is_absolute()
            else repo_root / args.output_dir
        )
        out_dir.mkdir(parents=True, exist_ok=True)

        index: dict[str, str] = {}
        reverse: dict[str, str] = {}
        missing: list[str] = []

        for abs_path in iter_markdown_files(repo_root):
            rel = rel_posix(repo_root, abs_path)
            try:
                text = abs_path.read_text(encoding="utf-8")
                fm, _, _ = parse_frontmatter(text)
            except Exception as exc:  # noqa: BLE001
                print(f"error: cannot parse {rel}: {exc}", file=sys.stderr)
                missing.append(rel)
                continue

            if not fm or not fm.get("id"):
                missing.append(rel)
                continue

            doc_id = str(fm["id"])
            if doc_id in reverse:
                print(
                    f"error: duplicate id {doc_id}: {reverse[doc_id]} and {rel}",
                    file=sys.stderr,
                )
                return 1
            index[rel] = doc_id
            reverse[doc_id] = rel
            log(args.verbose, f"index {rel} -> {doc_id}")

        if missing:
            print("error: markdown files missing id:", file=sys.stderr)
            for p in missing:
                print(f"  {p}", file=sys.stderr)
            return 1

        index_path = out_dir / "index.json"
        reverse_path = out_dir / "index-reverse.json"
        ensure_parent_dir(index_path)
        index_path.write_text(
            json.dumps(index, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        reverse_path.write_text(
            json.dumps(reverse, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(
            f"wrote {len(index)} entries -> {index_path.as_posix()}",
            file=sys.stderr,
        )
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
