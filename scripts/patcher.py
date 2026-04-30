from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PatchReport:
    rewritten_files: int
    dropped_files: int
    appended_css_files: int
    hits: list[str]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_glob_many(root: Path, globs: list[str]) -> list[Path]:
    out: list[Path] = []
    for g in globs:
        out.extend(sorted(root.glob(g)))
    uniq: list[Path] = []
    seen: set[Path] = set()
    for p in out:
        if p in seen:
            continue
        seen.add(p)
        uniq.append(p)
    return uniq


def apply_rules(unpacked_root: Path, ad_rules_path: Path, ui_rules_path: Path) -> PatchReport:
    ad = load_json(ad_rules_path)
    ui = load_json(ui_rules_path)

    rewritten_files = 0
    dropped_files = 0
    appended_css_files = 0
    hits: list[str] = []

    file_targets = iter_glob_many(unpacked_root, ad.get("file_globs", []))
    regex_rewrites = ad.get("regex_rewrites", [])
    blocklist = [str(s).lower() for s in ad.get("string_blocklist", [])]

    for p in file_targets:
        if not p.exists() or not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        original = text
        lowered = text.lower()
        for s in blocklist:
            if s and s in lowered:
                hits.append(f"blocklist:{s}:{p.as_posix()}")

        for rr in regex_rewrites:
            pat = rr.get("pattern")
            rep = rr.get("replace", "")
            name = rr.get("name", "rewrite")
            if not pat:
                continue
            new_text, n = re.subn(str(pat), str(rep), text)
            if n:
                hits.append(f"rewrite:{name}:{p.as_posix()}:{n}")
                text = new_text

        if text != original:
            p.write_text(text, encoding="utf-8")
            rewritten_files += 1

    for g in ad.get("resource_drop_globs", []):
        for p in sorted(unpacked_root.glob(str(g))):
            if p.exists() and p.is_file():
                p.unlink()
                dropped_files += 1

    for item in ui.get("css_append", []):
        glob_pat = item.get("glob")
        append = item.get("append", "")
        if not glob_pat or not append:
            continue
        for p in sorted(unpacked_root.glob(str(glob_pat))):
            if not p.exists() or not p.is_file():
                continue
            try:
                p.write_text(p.read_text(encoding="utf-8", errors="ignore") + str(append), encoding="utf-8")
                appended_css_files += 1
                hits.append(f"css_append:{p.as_posix()}")
            except Exception:
                continue

    return PatchReport(
        rewritten_files=rewritten_files,
        dropped_files=dropped_files,
        appended_css_files=appended_css_files,
        hits=hits,
    )

