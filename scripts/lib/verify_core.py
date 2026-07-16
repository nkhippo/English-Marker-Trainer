# Source: Vault-Framework/scripts/lib/verify_core.py @ 04ab894
"""Shared verification checks V1–V8 for migration and CI validate scripts."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from lib.common import (
    ID_RE,
    iter_markdown_files,
    offset_in_code,
    parse_frontmatter,
    rel_posix,
    split_fenced_regions,
)

MD_LINK_RE = re.compile(r"(?<!!)\[([^\]]*)\]\(([^)]+?\.md(?:#[^)]*)?)\)")
WIKILINK_ANY_RE = re.compile(r"\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]")
WIKILINK_PATH_RE = re.compile(
    r"\[\[([^\]|#]*\/[^\]|#]*)(#[^\]|]*)?(?:\|([^\]]*))?\]\]"
)
ID_FIELD_RE = re.compile(r".+_ids?$")


@dataclass
class CheckResult:
    """One verification check outcome."""

    check: str
    status: str  # PASS | FAIL
    total: int = 0
    failures: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class VerifyContext:
    """Loaded repo state for verification."""

    repo_root: Path
    index: dict[str, str]
    reverse: dict[str, str]
    broken: set[tuple[str, str]]  # (source_file, referenced_path)
    files: list[Path]


def load_broken_refs(path: Path | None) -> set[tuple[str, str]]:
    """Load whitelist pairs from broken-refs.csv (empty if missing)."""
    if path is None or not path.is_file():
        return set()
    pairs: set[tuple[str, str]] = set()
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            pairs.add((row.get("source_file", ""), row.get("referenced_path", "")))
    return pairs


def load_index(path: Path) -> dict[str, str]:
    """Load path→id index JSON."""
    return json.loads(path.read_text(encoding="utf-8"))


def build_context(
    repo_root: Path,
    index_path: Path | None,
    broken_path: Path | None,
    changed_only: list[str] | None = None,
) -> VerifyContext:
    """Build verification context.

    If ``changed_only`` is set, ``files`` is restricted to those paths
    (still absolute Paths under repo_root). Index is always full-repo when present.
    """
    if index_path and index_path.is_file():
        index = load_index(index_path)
    else:
        # Build index on the fly from front matter
        index = {}
        for abs_path in iter_markdown_files(repo_root):
            rel = rel_posix(repo_root, abs_path)
            try:
                fm, _, _ = parse_frontmatter(abs_path.read_text(encoding="utf-8"))
            except Exception:  # noqa: BLE001
                continue
            if fm and fm.get("id"):
                index[rel] = str(fm["id"])

    reverse = {v: k for k, v in index.items()}
    broken = load_broken_refs(broken_path)

    if changed_only is not None:
        files = []
        for rel in changed_only:
            p = repo_root / rel
            if p.is_file():
                files.append(p)
    else:
        files = list(iter_markdown_files(repo_root))

    return VerifyContext(
        repo_root=repo_root,
        index=index,
        reverse=reverse,
        broken=broken,
        files=files,
    )


def _read_fm(abs_path: Path) -> dict[str, Any] | None:
    try:
        fm, _, _ = parse_frontmatter(abs_path.read_text(encoding="utf-8"))
        return fm
    except Exception:  # noqa: BLE001
        return None


def check_v1(ctx: VerifyContext, scope_files: list[Path]) -> CheckResult:
    """V1: all markdown have valid id."""
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in scope_files:
        rel = rel_posix(ctx.repo_root, abs_path)
        total += 1
        fm = _read_fm(abs_path)
        doc_id = fm.get("id") if fm else None
        if not doc_id or not ID_RE.match(str(doc_id)):
            failures.append(
                {
                    "file": rel,
                    "line": 1,
                    "detail": f"missing or invalid id: {doc_id!r}",
                }
            )
    return CheckResult(
        "V1",
        "PASS" if not failures else "FAIL",
        total,
        failures,
    )


def check_v2(ctx: VerifyContext, scope_files: list[Path]) -> CheckResult:
    """V2: aliases[0] == id."""
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in scope_files:
        rel = rel_posix(ctx.repo_root, abs_path)
        fm = _read_fm(abs_path)
        if not fm or not fm.get("id"):
            continue
        total += 1
        aliases = fm.get("aliases")
        doc_id = str(fm["id"])
        if not isinstance(aliases, list) or not aliases or aliases[0] != doc_id:
            failures.append(
                {
                    "file": rel,
                    "line": 1,
                    "detail": f"aliases[0] != id ({aliases!r} vs {doc_id})",
                }
            )
    return CheckResult("V2", "PASS" if not failures else "FAIL", total, failures)


def check_v3(ctx: VerifyContext) -> CheckResult:
    """V3: all ids unique (full repo)."""
    seen: dict[str, str] = {}
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in iter_markdown_files(ctx.repo_root):
        rel = rel_posix(ctx.repo_root, abs_path)
        fm = _read_fm(abs_path)
        if not fm or not fm.get("id"):
            continue
        total += 1
        doc_id = str(fm["id"])
        if doc_id in seen:
            failures.append(
                {
                    "file": rel,
                    "line": 1,
                    "detail": f"duplicate id {doc_id} also in {seen[doc_id]}",
                }
            )
        else:
            seen[doc_id] = rel
    return CheckResult("V3", "PASS" if not failures else "FAIL", total, failures)


def check_v4(ctx: VerifyContext, scope_files: list[Path]) -> CheckResult:
    """V4: *_id / *_ids values match ID regex."""
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in scope_files:
        rel = rel_posix(ctx.repo_root, abs_path)
        fm = _read_fm(abs_path)
        if not fm:
            continue
        for key, val in fm.items():
            if not ID_FIELD_RE.match(str(key)) or key == "id":
                # note: `id` itself is not *_id suffix with underscore before id only
                # pattern `.+_ids?$` matches `foo_id` and `foo_ids`, not bare `id`
                pass
            if not re.search(r"_ids?$", str(key)):
                continue
            values = val if isinstance(val, list) else [val]
            for item in values:
                total += 1
                if not isinstance(item, str) or not ID_RE.match(item):
                    failures.append(
                        {
                            "file": rel,
                            "line": 1,
                            "detail": f"{key} invalid id value: {item!r}",
                        }
                    )
    return CheckResult("V4", "PASS" if not failures else "FAIL", total, failures)


def check_v5(ctx: VerifyContext) -> CheckResult:
    """V5: *_id / *_ids references exist in index (full repo)."""
    known = set(ctx.index.values())
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in iter_markdown_files(ctx.repo_root):
        rel = rel_posix(ctx.repo_root, abs_path)
        fm = _read_fm(abs_path)
        if not fm:
            continue
        for key, val in fm.items():
            if not re.search(r"_ids?$", str(key)):
                continue
            values = val if isinstance(val, list) else [val]
            for item in values:
                if not isinstance(item, str):
                    continue
                total += 1
                if item not in known:
                    failures.append(
                        {
                            "file": rel,
                            "line": 1,
                            "detail": f"{key} unknown id: {item}",
                        }
                    )
    return CheckResult("V5", "PASS" if not failures else "FAIL", total, failures)


def check_v6(ctx: VerifyContext) -> CheckResult:
    """V6: body wikilink ids resolve (full repo), excluding broken-refs."""
    known = set(ctx.index.values())
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in iter_markdown_files(ctx.repo_root):
        rel = rel_posix(ctx.repo_root, abs_path)
        try:
            text = abs_path.read_text(encoding="utf-8")
            _, _, body = parse_frontmatter(text)
        except Exception:  # noqa: BLE001
            continue
        regions = split_fenced_regions(body)
        for m in WIKILINK_ANY_RE.finditer(body):
            if offset_in_code(regions, m.start()):
                continue
            target = m.group(1)
            if "/" in target:
                continue  # path wikilink — V8
            # skip if whitelisted as broken (original path form unlikely here)
            total += 1
            if target not in known:
                # also skip if (rel, full match) in broken
                raw = m.group(0)
                if (rel, target) in ctx.broken or (rel, raw) in ctx.broken:
                    continue
                if not ID_RE.match(target):
                    # not an id-shaped wikilink; ignore for V6
                    total -= 1
                    continue
                line = body.count("\n", 0, m.start()) + 1
                failures.append(
                    {
                        "file": rel,
                        "line": line,
                        "detail": f"unknown id: {target}",
                    }
                )
    return CheckResult("V6", "PASS" if not failures else "FAIL", total, failures)


def check_v7(ctx: VerifyContext, scope_files: list[Path]) -> CheckResult:
    """V7: no leftover path markdown links."""
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in scope_files:
        rel = rel_posix(ctx.repo_root, abs_path)
        try:
            text = abs_path.read_text(encoding="utf-8")
            _, _, body = parse_frontmatter(text)
        except Exception:  # noqa: BLE001
            continue
        regions = split_fenced_regions(body)
        for m in MD_LINK_RE.finditer(body):
            if offset_in_code(regions, m.start()):
                continue
            raw = m.group(2)
            if raw.strip().startswith(("http://", "https://", "mailto:")):
                continue
            if (rel, raw) in ctx.broken:
                continue
            total += 1
            line = body.count("\n", 0, m.start()) + 1
            failures.append(
                {
                    "file": rel,
                    "line": line,
                    "detail": f"unrewritten path ref {raw!r}",
                }
            )
    return CheckResult("V7", "PASS" if not failures else "FAIL", total, failures)


def check_v8(ctx: VerifyContext, scope_files: list[Path]) -> CheckResult:
    """V8: no leftover path wikilinks (slash-containing)."""
    failures: list[dict[str, Any]] = []
    total = 0
    for abs_path in scope_files:
        rel = rel_posix(ctx.repo_root, abs_path)
        try:
            text = abs_path.read_text(encoding="utf-8")
            _, _, body = parse_frontmatter(text)
        except Exception:  # noqa: BLE001
            continue
        regions = split_fenced_regions(body)
        for m in WIKILINK_PATH_RE.finditer(body):
            if offset_in_code(regions, m.start()):
                continue
            path_part = m.group(1)
            if (rel, path_part) in ctx.broken:
                continue
            total += 1
            line = body.count("\n", 0, m.start()) + 1
            failures.append(
                {
                    "file": rel,
                    "line": line,
                    "detail": f"unrewritten path wikilink {path_part!r}",
                }
            )
    return CheckResult("V8", "PASS" if not failures else "FAIL", total, failures)


def run_all_checks(
    ctx: VerifyContext,
    *,
    pr_mode: bool = False,
) -> list[CheckResult]:
    """Run V1–V8 according to mode.

    PR mode: V1/V2/V4/V7/V8 on changed files; V3/V5/V6 full repo.
    Full-scan: all on full repo (scope_files = all markdown).
    """
    scope = ctx.files
    full = list(iter_markdown_files(ctx.repo_root)) if pr_mode else scope

    results = [
        check_v1(ctx, scope),
        check_v2(ctx, scope),
        check_v3(ctx),
        check_v4(ctx, scope),
        check_v5(ctx),
        check_v6(ctx),
        check_v7(ctx, scope if pr_mode else full),
        check_v8(ctx, scope if pr_mode else full),
    ]
    return results
