#!/usr/bin/env python3
# Source: Vault-Framework/scripts/migration/02_assign_ids.py @ 04ab894
"""Assign IDs and update Front Matter for scanned markdown files."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

_SCRIPTS = Path(__file__).resolve().parents[1]
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from lib.common import (  # noqa: E402
    ID_RE,
    add_common_args,
    dump_frontmatter,
    ensure_parent_dir,
    extract_repo_name,
    infer_prefix,
    is_vault_repo_name,
    log,
    parse_frontmatter,
    resolve_repo_root,
    to_jst_date,
    today_jst,
)


def generate_id(
    repo_name: str,
    path: str,
    date: str,
    prefix: str,
    id_set: set[str],
) -> str:
    """Generate a deterministic unique ID."""
    base = f"{repo_name}:{path}:{date}"
    hex4 = hashlib.sha256(base.encode()).hexdigest()[:4]
    new_id = f"{prefix}-{date}-{hex4}"
    if new_id not in id_set:
        return new_id
    for salt in range(1, 1000):
        hex4 = hashlib.sha256(f"{base}:salt-{salt}".encode()).hexdigest()[:4]
        new_id = f"{prefix}-{date}-{hex4}"
        if new_id not in id_set:
            return new_id
    raise RuntimeError(f"could not resolve ID collision for {path}")


def build_new_content(
    text: str,
    new_id: str,
    first_h1: str | None,
    created_date: str,
    path: str,
) -> tuple[str, str]:
    """Return (new_text, action) for one file.

    action: added_fm | updated_fm | skipped
    """
    try:
        fm, _body_start, body = parse_frontmatter(text)
    except Exception as exc:  # noqa: BLE001
        print(f"warn: skip broken FM {path}: {exc}", file=sys.stderr)
        return text, "skipped"

    if fm is None:
        title = first_h1 or Path(path).stem
        fm = {
            "id": new_id,
            "aliases": [new_id],
            "title": title,
            "created": created_date,
        }
        return dump_frontmatter(fm) + body.lstrip("\n"), "added_fm"

    existing = fm.get("id")
    if existing and isinstance(existing, str) and ID_RE.match(existing):
        print(f"warn: scheme id already present, skip {path}", file=sys.stderr)
        return text, "skipped"

    fm = dict(fm)
    aliases = fm.get("aliases")
    if not isinstance(aliases, list):
        aliases = []
    else:
        aliases = list(aliases)

    # Legacy non-scheme id (e.g. adr-0002) → keep as alias, assign scheme id
    if existing and isinstance(existing, str) and not ID_RE.match(existing):
        print(
            f"warn: replacing legacy id {existing!r} with scheme id on {path}",
            file=sys.stderr,
        )
        if existing not in aliases:
            aliases.append(existing)

    fm["id"] = new_id
    if new_id not in aliases:
        aliases.insert(0, new_id)
    else:
        # ensure scheme id is aliases[0]
        aliases = [new_id] + [a for a in aliases if a != new_id]
    fm["aliases"] = aliases
    new_text = dump_frontmatter(fm)
    if body:
        new_text += body if body.startswith("\n") else "\n" + body
    return new_text, "updated_fm"


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Assign IDs to markdown front matter.")
    add_common_args(parser)
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("migration/scan.jsonl"),
        help="Input scan JSONL (default: migration/scan.jsonl)",
    )
    parser.add_argument(
        "--repo-name",
        type=str,
        default=None,
        help="Repository name for ID hashing",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print diffs without writing files",
    )
    args = parser.parse_args(argv)

    try:
        repo_root = resolve_repo_root(args.repo_root)
        inp = args.input if args.input.is_absolute() else repo_root / args.input
        if not inp.is_file():
            print(f"error: input not found: {inp}", file=sys.stderr)
            return 2

        repo_name = extract_repo_name(repo_root, args.repo_name)
        vault = is_vault_repo_name(repo_name)
        migration_day = today_jst()
        id_set: set[str] = set()
        assignments: list[dict[str, Any]] = []

        with inp.open(encoding="utf-8") as fh:
            rows = [json.loads(line) for line in fh if line.strip()]

        for row in rows:
            path = row["path"]
            abs_path = repo_root / path
            if not abs_path.is_file():
                print(f"warn: missing file {path}", file=sys.stderr)
                continue

            prefix = infer_prefix(path, vault)
            date = to_jst_date(row.get("first_commit_date"), migration_day)
            new_id = generate_id(repo_name, path, date, prefix, id_set)
            id_set.add(new_id)

            text = abs_path.read_text(encoding="utf-8")
            new_text, action = build_new_content(
                text,
                new_id,
                row.get("first_h1"),
                date,
                path,
            )

            assignments.append({"path": path, "id": new_id, "action": action})
            log(args.verbose, f"{action} {path} -> {new_id}")

            if action == "skipped":
                continue

            if args.dry_run:
                print(f"--- {path}")
                print(f"+++ {path} ({action} {new_id})")
                if text != new_text:
                    # lightweight diff: show new FM head
                    print(new_text.split("---\n", 2)[0:2] if False else "")
                    old_lines = text.splitlines()
                    new_lines = new_text.splitlines()
                    for i, (a, b) in enumerate(zip(old_lines, new_lines)):
                        if a != b:
                            print(f"- {a}")
                            print(f"+ {b}")
                    if len(new_lines) > len(old_lines):
                        for b in new_lines[len(old_lines) :]:
                            print(f"+ {b}")
                    elif len(old_lines) > len(new_lines):
                        for a in old_lines[len(new_lines) :]:
                            print(f"- {a}")
                continue

            abs_path.write_text(new_text, encoding="utf-8")

        if args.dry_run:
            out = repo_root / "migration" / "dry-run-02-assignments.jsonl"
            ensure_parent_dir(out)
            with out.open("w", encoding="utf-8") as fh:
                for row in assignments:
                    fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(
                f"dry-run: wrote {len(assignments)} planned assignments -> {out.as_posix()}",
                file=sys.stderr,
            )
        else:
            out = repo_root / "migration" / "id-assignments.jsonl"
            ensure_parent_dir(out)
            with out.open("w", encoding="utf-8") as fh:
                for row in assignments:
                    fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"wrote {len(assignments)} assignments -> {out.as_posix()}", file=sys.stderr)

        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
