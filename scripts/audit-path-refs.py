#!/usr/bin/env python3
"""Audit path-based references in Markdown files."""
from __future__ import annotations

import csv
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(".").resolve()
EXCLUDE_DIRS = {"node_modules", ".git", "dist", "build", ".venv", "venv", "__pycache__"}
DATE = datetime.now(timezone.utc).strftime("%Y-%m-%d")
OUTPUT = Path(f"audit/path-refs-{DATE}.csv")

INLINE_LINK_RE = re.compile(r"(!?\[[^\]]*\]\()([^)]+)(\))")
WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
FM_KEY_RE = re.compile(
    r"^\s*(related|derived_from|source|link|ref|parent)\s*:\s*(.+)$",
    re.IGNORECASE,
)


def should_skip(rel: Path) -> bool:
    return any(part in EXCLUDE_DIRS for part in rel.parts)


def is_external(target: str) -> bool:
    t = target.strip()
    return t.startswith(("http://", "https://", "mailto:", "#"))


def extract_link_target(raw: str) -> str:
    t = raw.strip()
    if t.startswith("<") and ">" in t:
        t = t[1:t.index(">")]
    # strip optional title: path "title" or path 'title'
    m = re.match(r"^(\S+)(?:\s+[\"'].*[\"'])?$", t)
    return (m.group(1) if m else t).strip()


def looks_like_md_path(target: str) -> bool:
    t = target.split("#", 1)[0].strip()
    return t.lower().endswith(".md") or ".md" in t.lower()


def scan_file(abs_path: Path, rel: Path, rows: list[list[str]]) -> None:
    try:
        text = abs_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return
    lines = text.splitlines()
    rel_s = rel.as_posix()

    for i, line in enumerate(lines, 1):
        for m in INLINE_LINK_RE.finditer(line):
            if m.group(1).startswith("!["):
                continue  # image
            target = extract_link_target(m.group(2))
            if is_external(target) or not looks_like_md_path(target):
                continue
            rows.append([rel_s, str(i), target, "markdown_link"])

        for m in WIKILINK_RE.finditer(line):
            target = m.group(1).strip()
            if "/" not in target:
                continue
            rows.append([rel_s, str(i), target, "wikilink"])

    if lines and lines[0].strip() == "---":
        fm_end = None
        for i, line in enumerate(lines[1:20], 2):
            if line.strip() == "---":
                fm_end = i
                break
        end = (fm_end - 1) if fm_end else min(20, len(lines))
        for i, line in enumerate(lines[:end], 1):
            m = FM_KEY_RE.match(line)
            if not m:
                continue
            val = m.group(2).strip()
            if ".md" not in val.lower() or is_external(val):
                continue
            rows.append([rel_s, str(i), val, "frontmatter"])


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    rows: list[list[str]] = []
    for abs_path in sorted(ROOT.rglob("*.md")):
        try:
            rel = abs_path.relative_to(ROOT)
        except ValueError:
            continue
        if should_skip(rel):
            continue
        scan_file(abs_path, rel, rows)

    seen: set[tuple[str, str, str, str]] = set()
    unique: list[list[str]] = []
    for row in rows:
        key = (row[0], row[1], row[2], row[3])
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    with OUTPUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["source_file", "line_number", "referenced_path", "ref_type"])
        w.writerows(unique)

    print(f"Done. Detected {len(unique)} path references. See {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
