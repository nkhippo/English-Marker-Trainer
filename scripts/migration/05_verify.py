#!/usr/bin/env python3
# Source: Vault-Framework/scripts/migration/05_verify.py @ 04ab894
"""Run post-migration verification checks V1–V8."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[1]
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.common import add_common_args, ensure_parent_dir, resolve_repo_root  # noqa: E402
from lib.verify_core import build_context, run_all_checks  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Verify migration results (V1–V8).")
    add_common_args(parser)
    parser.add_argument(
        "--index",
        type=Path,
        default=Path("migration/index.json"),
        help="Index JSON path",
    )
    parser.add_argument(
        "--broken-refs",
        type=Path,
        default=Path("migration/broken-refs.csv"),
        help="Broken refs CSV (whitelist)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("migration/verify-report.jsonl"),
        help="Verify report JSONL output",
    )
    args = parser.parse_args(argv)

    try:
        repo_root = resolve_repo_root(args.repo_root)
        index_path = args.index if args.index.is_absolute() else repo_root / args.index
        broken_path = (
            args.broken_refs
            if args.broken_refs.is_absolute()
            else repo_root / args.broken_refs
        )
        out = args.output if args.output.is_absolute() else repo_root / args.output

        if not index_path.is_file():
            print(f"error: index not found: {index_path}", file=sys.stderr)
            return 2

        ctx = build_context(repo_root, index_path, broken_path, changed_only=None)
        results = run_all_checks(ctx, pr_mode=False)

        ensure_parent_dir(out)
        with out.open("w", encoding="utf-8") as fh:
            for r in results:
                fh.write(json.dumps(asdict(r), ensure_ascii=False) + "\n")
                status_line = f"{r.check} {r.status} (total={r.total}, failures={len(r.failures)})"
                print(status_line, file=sys.stderr)
                if args.verbose and r.failures:
                    for f in r.failures[:10]:
                        print(f"  {f}", file=sys.stderr)

        failed = any(r.status == "FAIL" for r in results)
        print(f"wrote verify report -> {out.as_posix()}", file=sys.stderr)
        return 1 if failed else 0
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
