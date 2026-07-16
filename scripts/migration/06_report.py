#!/usr/bin/env python3
# Source: Vault-Framework/scripts/migration/06_report.py @ 04ab894
"""Generate a human-readable migration report markdown."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[1]
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.common import (  # noqa: E402
    add_common_args,
    ensure_parent_dir,
    extract_repo_name,
    iso_jst,
    resolve_repo_root,
    today_jst,
)


def load_jsonl(path: Path) -> list[dict]:
    """Load JSONL file; empty list if missing."""
    if not path.is_file():
        return []
    rows = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Generate migration report markdown.")
    add_common_args(parser)
    parser.add_argument(
        "--assignments",
        type=Path,
        default=Path("migration/id-assignments.jsonl"),
    )
    parser.add_argument(
        "--broken-refs",
        type=Path,
        default=Path("migration/broken-refs.csv"),
    )
    parser.add_argument(
        "--verify-report",
        type=Path,
        default=Path("migration/verify-report.jsonl"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output markdown (default: migration/report-YYYY-MM-DD.md)",
    )
    args = parser.parse_args(argv)

    try:
        repo_root = resolve_repo_root(args.repo_root)
        repo_name = extract_repo_name(repo_root, None)
        day = today_jst()

        assignments_path = (
            args.assignments
            if args.assignments.is_absolute()
            else repo_root / args.assignments
        )
        broken_path = (
            args.broken_refs
            if args.broken_refs.is_absolute()
            else repo_root / args.broken_refs
        )
        verify_path = (
            args.verify_report
            if args.verify_report.is_absolute()
            else repo_root / args.verify_report
        )
        out = args.output
        if out is None:
            out = repo_root / "migration" / f"report-{day}.md"
        elif not out.is_absolute():
            out = repo_root / out

        assignments = load_jsonl(assignments_path)
        verify_rows = load_jsonl(verify_path)

        action_counts = Counter(r.get("action", "") for r in assignments)
        broken_rows: list[dict] = []
        if broken_path.is_file():
            with broken_path.open(encoding="utf-8", newline="") as fh:
                broken_rows = list(csv.DictReader(fh))
        reason_counts = Counter(r.get("reason", "") for r in broken_rows)
        pattern_counts = Counter(r.get("pattern_type", "") for r in broken_rows)

        verify_map = {r.get("check"): r for r in verify_rows}

        def vstat(check: str) -> str:
            row = verify_map.get(check)
            return row.get("status", "N/A") if row else "N/A"

        issue_lines: list[str] = []
        for row in verify_rows:
            for fail in row.get("failures") or []:
                issue_lines.append(
                    f"- `{fail.get('file')}:{fail.get('line')}` "
                    f"[{row.get('check')}] {fail.get('detail')}"
                )
        extra = 0
        if len(issue_lines) > 20:
            extra = len(issue_lines) - 20
            issue_lines = issue_lines[:20]
            issue_lines.append(f"- ... and {extra} more")

        md = f"""---
title: Migration Report - {repo_name} - {day}
created: {iso_jst()}
status: draft
tags: [migration, id-scheme, phase-0.5]
---

# Migration Report - {repo_name} - {day}

## Summary

- Total markdown files: {len(assignments)}
- IDs assigned: {len(assignments)} (added_fm: {action_counts.get('added_fm', 0)}, updated_fm: {action_counts.get('updated_fm', 0)}, skipped: {action_counts.get('skipped', 0)})
- Refs rewritten: N/A (see broken-refs pattern counts below for unresolved)
- Broken refs (not rewritten): {len(broken_rows)}
  - markdown_link: {pattern_counts.get('markdown_link', 0)}, wikilink: {pattern_counts.get('wikilink', 0)}, frontmatter: {pattern_counts.get('frontmatter', 0)}

## Verification

- V1 all IDs present: {vstat('V1')}
- V2 aliases sync: {vstat('V2')}
- V3 id uniqueness: {vstat('V3')}
- V4 `_id`/`_ids` format: {vstat('V4')}
- V5 `_id`/`_ids` reference exists: {vstat('V5')}
- V6 body wikilink resolves: {vstat('V6')}
- V7 no leftover path markdown links: {vstat('V7')}
- V8 no leftover path wikilinks: {vstat('V8')}

## Broken refs breakdown

| reason | count |
|---|---|
| target_not_found | {reason_counts.get('target_not_found', 0)} |
| outside_repo | {reason_counts.get('outside_repo', 0)} |
| ambiguous_target | {reason_counts.get('ambiguous_target', 0)} |

## Files with issues

{chr(10).join(issue_lines) if issue_lines else "(none)"}
"""
        ensure_parent_dir(out)
        out.write_text(md, encoding="utf-8")
        print(f"wrote report -> {out.as_posix()}", file=sys.stderr)
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
