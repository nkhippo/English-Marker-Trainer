#!/usr/bin/env python3
# Source: Vault-Framework/scripts/validate/validate-markdown-refs.py @ 04ab894
"""CI validator for markdown ID / wikilink integrity (PR or full-scan mode)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parents[1]
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.common import add_common_args, resolve_repo_root  # noqa: E402
from lib.verify_core import build_context, run_all_checks  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Validate markdown refs (CI). PR mode or full-scan."
    )
    add_common_args(parser)
    parser.add_argument(
        "--changed-files",
        type=Path,
        default=None,
        help="Text file listing changed markdown paths (1 per line)",
    )
    parser.add_argument(
        "--broken-refs",
        type=Path,
        default=Path("migration/broken-refs.csv"),
        help="Broken-refs CSV whitelist (optional; missing = empty)",
    )
    parser.add_argument(
        "--index",
        type=Path,
        default=Path("migration/index.json"),
        help="Optional index.json; if missing, built from Front Matter",
    )
    parser.add_argument(
        "--full-scan",
        action="store_true",
        help="Scan all markdown files",
    )
    args = parser.parse_args(argv)

    try:
        repo_root = resolve_repo_root(args.repo_root)
        broken_path = (
            args.broken_refs
            if args.broken_refs.is_absolute()
            else repo_root / args.broken_refs
        )
        index_path = args.index if args.index.is_absolute() else repo_root / args.index
        if not index_path.is_file():
            index_path = None  # type: ignore[assignment]

        changed: list[str] | None = None
        pr_mode = False
        if args.changed_files is not None:
            cf = (
                args.changed_files
                if args.changed_files.is_absolute()
                else repo_root / args.changed_files
            )
            if not cf.is_file():
                print(f"error: changed-files not found: {cf}", file=sys.stderr)
                return 2
            changed = [
                ln.strip()
                for ln in cf.read_text(encoding="utf-8").splitlines()
                if ln.strip()
            ]
            pr_mode = True
        elif not args.full_scan:
            # Default: full-scan when no changed-files
            args.full_scan = True

        ctx = build_context(
            repo_root,
            index_path if isinstance(index_path, Path) else None,
            broken_path,
            changed_only=changed,
        )
        results = run_all_checks(ctx, pr_mode=pr_mode)

        failed = False
        for r in results:
            print(f"{r.check}: {r.status} (total={r.total}, failures={len(r.failures)})")
            if r.status == "FAIL":
                failed = True
                for f in r.failures:
                    print(
                        f"FAIL {r.check}: {f.get('file')}:{f.get('line')} {f.get('detail')}",
                        file=sys.stderr,
                    )

        return 1 if failed else 0
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
