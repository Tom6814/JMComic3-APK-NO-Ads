# JMComic 去广/美化无人值守自动化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 定时检查上游 JMComic APK 新版本，自动下载→解包→去广告/小美化→校验→重打包对齐签名→发布 GitHub Release，并将解包后的修改文件提交回仓库。

**Architecture:** 以 Python 标准库实现的单入口流水线 `scripts/pipeline.py`，通过“规则驱动补丁 + 自检”适配上游版本变动；签名工具链由脚本自动下载并缓存（Android build-tools），尽量减少宿主机依赖。

**Tech Stack:** Python 3（标准库：urllib/json/re/zipfile/hashlib/subprocess/tempfile/pathlib）；Java（keytool）；Git；GitHub REST API（Releases/Assets）。

---

## Repository Structure（将被创建/修改）

**Create:**
- `scripts/pipeline.py`：流水线入口（检测新版本→处理→发布）
- `scripts/upstream.py`：查询上游版本与下载 asset
- `scripts/apk_io.py`：解包/打包 + zipalign/apksigner 工具安装与调用
- `scripts/patcher.py`：规则驱动补丁引擎（对解包目录做文本/资源补丁）
- `scripts/validate.py`：静态校验（防白屏、关键资源、广告残留扫描）
- `scripts/github_release.py`：Release 创建/更新与 asset 上传（REST API）
- `rules/ad_patterns.json`：广告识别/替换规则（regex + replace/noop）
- `rules/ui_tweaks.json`：小美化规则（CSS/资源替换等）
- `state/upstream.json`：上游处理状态（已处理版本、asset 信息）
- `artifacts/.gitkeep`：日志/产物目录占位
- `tests/test_patcher.py`：补丁引擎单测（基于最小化夹具）
- `tests/test_validate.py`：校验器单测（基于最小化夹具）

**Modify:**
- [README.md](file:///workspace/README.md)：补充自动化使用说明、产物命名规范与排错方式

---

## Assumptions & Non-Goals

- 使用“新签名”即可安装；流水线会生成并复用同一个 keystore（不入库），确保纯净版可覆盖升级纯净版。
- 不保证可覆盖安装官方签名包（除非后续改为原签名）。
- “去广告”以禁用/移除广告入口与资源为主，不做复杂的深度反编译/重新编译 Java/Kotlin 逻辑（尽量降低破坏风险）。
- 校验以静态校验为主（无人值守环境无法可靠进行真机 UI 自动化）；若需要真机/模拟器回归，将作为后续扩展。

---

### Task 1: 基础目录与状态文件

**Files:**
- Create: `state/upstream.json`
- Create: `rules/ad_patterns.json`
- Create: `rules/ui_tweaks.json`
- Create: `artifacts/.gitkeep`

- [ ] **Step 1: 创建目录结构**

Run:
```bash
mkdir -p state rules scripts artifacts tests
```

- [ ] **Step 2: 写入初始状态文件**

`state/upstream.json`:
```json
{
  "upstream_repo": "hect0x7/JMComic-APK",
  "last_processed_tag": null,
  "last_processed_published_at": null,
  "last_asset_name": null,
  "last_asset_sha256": null
}
```

- [ ] **Step 3: 写入广告规则**

`rules/ad_patterns.json`（示例，后续可扩展）:
```json
{
  "file_globs": [
    "assets/public/static/js/*.js",
    "assets/public/static/css/*.css",
    "assets/public/index.html",
    "AndroidManifest.xml"
  ],
  "string_blocklist": [
    "admob",
    "doubleclick.net",
    "gdt",
    "pangle",
    "bytedance",
    "穿山甲",
    "广告",
    "reward",
    "interstitial"
  ],
  "regex_rewrites": [
    {
      "name": "disable_ad_init_common",
      "pattern": "(?s)\\b(initAd|initAds|loadAd|loadAds)\\s*\\(",
      "replace": "/*adfree*/(function(){return;})("
    }
  ],
  "resource_drop_globs": [
    "assets/public/images/*ad*.*",
    "assets/public/images/custom_ad.*"
  ]
}
```

- [ ] **Step 4: 写入美化规则**

`rules/ui_tweaks.json`（示例）:
```json
{
  "css_append": [
    {
      "glob": "assets/public/static/css/*.css",
      "append": "\\n/*adfree-ui*/\\n:root{--adfree-accent:#8b5cf6;}\\n"
    }
  ]
}
```

- [ ] **Step 5: 写入 artifacts 占位**

`artifacts/.gitkeep`（空文件即可）

- [ ] **Step 6: 提交**

Run:
```bash
git add state rules artifacts
git commit -m "chore: add automation scaffolding (state/rules/artifacts)"
```

---

### Task 2: 上游 Release 查询与 APK 下载（GitHub API）

**Files:**
- Create: `scripts/upstream.py`
- Test: `tests/test_upstream.py`

- [ ] **Step 1: 写入 `scripts/upstream.py`**

```python
from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


GITHUB_API = "https://api.github.com"


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _github_token() -> str | None:
    if os.environ.get("GITHUB_TOKEN"):
        return os.environ["GITHUB_TOKEN"].strip()
    return None


def _request(url: str) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "jmcomic-adfree-bot",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = _github_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


@dataclass(frozen=True)
class UpstreamRelease:
    tag_name: str
    published_at: str | None
    apk_name: str
    apk_url: str


def get_latest_release(repo: str) -> UpstreamRelease:
    data = _request(f"{GITHUB_API}/repos/{repo}/releases/latest")
    tag = str(data["tag_name"])
    published_at = data.get("published_at")
    assets = data.get("assets") or []
    apk_assets = [a for a in assets if str(a.get("name", "")).lower().endswith(".apk")]
    if not apk_assets:
        raise RuntimeError(f"no apk asset found in latest release for {repo} ({tag})")
    apk = apk_assets[0]
    return UpstreamRelease(
        tag_name=tag,
        published_at=str(published_at) if published_at is not None else None,
        apk_name=str(apk["name"]),
        apk_url=str(apk["browser_download_url"]),
    )


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "jmcomic-adfree-bot"}, method="GET")
    with urllib.request.urlopen(req, timeout=300) as resp, dst.open("wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)


def should_process(state_path: Path, rel: UpstreamRelease) -> bool:
    state = _load_json(state_path)
    last_tag = state.get("last_processed_tag")
    last_published = state.get("last_processed_published_at")
    if last_tag == rel.tag_name and (last_published == rel.published_at or rel.published_at is None):
        return False
    return True


def mark_processed(state_path: Path, rel: UpstreamRelease, apk_path: Path) -> None:
    state = _load_json(state_path)
    state["last_processed_tag"] = rel.tag_name
    state["last_processed_published_at"] = rel.published_at
    state["last_asset_name"] = rel.apk_name
    state["last_asset_sha256"] = _sha256(apk_path)
    _save_json(state_path, state)
```

- [ ] **Step 2: 写 `tests/test_upstream.py`（只测本地逻辑）**

```python
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.upstream import UpstreamRelease, should_process, mark_processed


def test_should_process_by_tag_change():
    with TemporaryDirectory() as td:
        state = Path(td) / "state.json"
        state.write_text(json.dumps({"last_processed_tag": "v1", "last_processed_published_at": "t1"}))
        assert should_process(state, UpstreamRelease("v2", "t2", "a.apk", "http://x")) is True


def test_should_skip_same_tag_and_published_at():
    with TemporaryDirectory() as td:
        state = Path(td) / "state.json"
        state.write_text(json.dumps({"last_processed_tag": "v1", "last_processed_published_at": "t1"}))
        assert should_process(state, UpstreamRelease("v1", "t1", "a.apk", "http://x")) is False
```

- [ ] **Step 3: 运行单测**

Run:
```bash
python -m unittest -q
```

- [ ] **Step 4: 提交**

```bash
git add scripts/upstream.py tests/test_upstream.py
git commit -m "feat: add upstream release checker and downloader"
```

---

### Task 3: APK 解包/打包 + 工具链安装（zipalign/apksigner）

**Files:**
- Create: `scripts/apk_io.py`
- Create: `scripts/tooling.py`
- Test: `tests/test_apk_io.py`

- [ ] **Step 1: 实现工具链下载与定位（最小可用）**

`scripts/tooling.py`:
```python
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def cache_dir() -> Path:
    p = repo_root() / ".cache"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def ensure_android_build_tools(version: str = "34.0.0") -> tuple[Path, Path]:
    """
    Returns (zipalign, apksigner).
    """
    bt_dir = cache_dir() / "android-build-tools" / version
    zipalign = bt_dir / "zipalign"
    apksigner = bt_dir / "apksigner"
    if zipalign.exists() and apksigner.exists():
        return zipalign, apksigner

    bt_dir.mkdir(parents=True, exist_ok=True)
    url = f"https://dl.google.com/android/repository/build-tools_r{version}-linux.zip"
    archive = bt_dir / f"build-tools_r{version}-linux.zip"
    if not archive.exists():
        with urllib.request.urlopen(url, timeout=300) as resp, archive.open("wb") as out:
            out.write(resp.read())
    with zipfile.ZipFile(archive) as z:
        z.extractall(bt_dir)

    extracted = bt_dir / version
    if not extracted.exists():
        candidates = [p for p in bt_dir.iterdir() if p.is_dir()]
        if candidates:
            extracted = candidates[0]
    if extracted.exists():
        for name in ["zipalign", "apksigner"]:
            src = extracted / name
            if src.exists():
                shutil.copy2(src, bt_dir / name)
        (bt_dir / "zipalign").chmod(0o755)
        (bt_dir / "apksigner").chmod(0o755)

    if not (zipalign.exists() and apksigner.exists()):
        raise RuntimeError("failed to install android build-tools (zipalign/apksigner)")
    return zipalign, apksigner
```

- [ ] **Step 2: 实现解包/打包 + 对齐签名**

`scripts/apk_io.py`:
```python
from __future__ import annotations

import shutil
import subprocess
import zipfile
from pathlib import Path

from scripts.tooling import ensure_android_build_tools


def unzip_apk(apk_path: Path, out_dir: Path) -> None:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(apk_path) as z:
        z.extractall(out_dir)


def zip_dir(src_dir: Path, out_apk: Path) -> None:
    if out_apk.exists():
        out_apk.unlink()
    out_apk.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_apk, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(src_dir.rglob("*")):
            if p.is_dir():
                continue
            rel = p.relative_to(src_dir).as_posix()
            z.write(p, rel)


def zipalign_and_sign(
    unsigned_apk: Path,
    aligned_apk: Path,
    signed_apk: Path,
    keystore: Path,
    ks_pass: str,
    alias: str,
    key_pass: str,
) -> None:
    zipalign, apksigner = ensure_android_build_tools()
    aligned_apk.parent.mkdir(parents=True, exist_ok=True)
    signed_apk.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run([str(zipalign), "-f", "4", str(unsigned_apk), str(aligned_apk)], check=True)
    subprocess.run(
        [
            str(apksigner),
            "sign",
            "--ks",
            str(keystore),
            "--ks-pass",
            f"pass:{ks_pass}",
            "--ks-key-alias",
            alias,
            "--key-pass",
            f"pass:{key_pass}",
            "--out",
            str(signed_apk),
            str(aligned_apk),
        ],
        check=True,
    )
    subprocess.run([str(apksigner), "verify", "--verbose", str(signed_apk)], check=True)
```

- [ ] **Step 3: 写单测（仅测 zip/unzip 可逆，不测签名）**

`tests/test_apk_io.py`:
```python
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.apk_io import unzip_apk, zip_dir


def test_zip_unzip_roundtrip():
    with TemporaryDirectory() as td:
        root = Path(td)
        src = root / "src"
        src.mkdir()
        (src / "a.txt").write_text("x", encoding="utf-8")
        (src / "dir").mkdir()
        (src / "dir" / "b.txt").write_text("y", encoding="utf-8")

        apk = root / "a.apk"
        zip_dir(src, apk)

        out = root / "out"
        unzip_apk(apk, out)

        assert (out / "a.txt").read_text(encoding="utf-8") == "x"
        assert (out / "dir" / "b.txt").read_text(encoding="utf-8") == "y"
```

- [ ] **Step 4: 运行单测并提交**

Run:
```bash
python -m unittest -q
git add scripts/tooling.py scripts/apk_io.py tests/test_apk_io.py
git commit -m "feat: add apk io utilities and android build-tools bootstrap"
```

---

### Task 4: 规则驱动去广/美化补丁引擎

**Files:**
- Create: `scripts/patcher.py`
- Test: `tests/test_patcher.py`

- [ ] **Step 1: 实现补丁引擎**

`scripts/patcher.py`:
```python
from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PatchReport:
    rewritten_files: int
    dropped_files: int
    appended_css_files: int
    hits: list[str]


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _iter_glob_many(root: Path, globs: list[str]) -> list[Path]:
    out: list[Path] = []
    for g in globs:
        out.extend(sorted(root.glob(g)))
    uniq = []
    seen = set()
    for p in out:
        if p in seen:
            continue
        seen.add(p)
        uniq.append(p)
    return uniq


def apply_rules(unpacked_root: Path, ad_rules_path: Path, ui_rules_path: Path) -> PatchReport:
    ad = _load_json(ad_rules_path)
    ui = _load_json(ui_rules_path)

    rewritten_files = 0
    dropped_files = 0
    appended_css_files = 0
    hits: list[str] = []

    file_targets = _iter_glob_many(unpacked_root, ad.get("file_globs", []))
    regex_rewrites = ad.get("regex_rewrites", [])
    blocklist = [s.lower() for s in ad.get("string_blocklist", [])]

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
            new_text, n = re.subn(pat, rep, text)
            if n:
                hits.append(f"rewrite:{name}:{p.as_posix()}:{n}")
                text = new_text

        if text != original:
            p.write_text(text, encoding="utf-8")
            rewritten_files += 1

    for g in ad.get("resource_drop_globs", []):
        for p in sorted(unpacked_root.glob(g)):
            if p.exists() and p.is_file():
                p.unlink()
                dropped_files += 1

    for item in ui.get("css_append", []):
        glob_pat = item.get("glob")
        append = item.get("append", "")
        if not glob_pat or not append:
            continue
        for p in sorted(unpacked_root.glob(glob_pat)):
            if not p.exists() or not p.is_file():
                continue
            try:
                p.write_text(p.read_text(encoding="utf-8", errors="ignore") + append, encoding="utf-8")
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
```

- [ ] **Step 2: 写补丁引擎单测**

`tests/test_patcher.py`:
```python
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.patcher import apply_rules


def test_apply_rules_rewrites_and_drops_and_appends():
    with TemporaryDirectory() as td:
        root = Path(td)
        unpacked = root / "unpacked"
        (unpacked / "assets/public/static/js").mkdir(parents=True)
        (unpacked / "assets/public/static/css").mkdir(parents=True)
        (unpacked / "assets/public/images").mkdir(parents=True)

        js = unpacked / "assets/public/static/js/main.js"
        js.write_text("function initAds(){return 1}; initAds()", encoding="utf-8")

        css = unpacked / "assets/public/static/css/main.css"
        css.write_text("body{}", encoding="utf-8")

        ad_img = unpacked / "assets/public/images/custom_ad.png"
        ad_img.write_bytes(b"123")

        ad_rules = root / "ad.json"
        ui_rules = root / "ui.json"
        ad_rules.write_text(
            json.dumps(
                {
                    "file_globs": ["assets/public/static/js/*.js"],
                    "string_blocklist": ["ad"],
                    "regex_rewrites": [{"name": "x", "pattern": r"\\binitAds\\s*\\(", "replace": "noop("}],
                    "resource_drop_globs": ["assets/public/images/custom_ad.*"],
                }
            ),
            encoding="utf-8",
        )
        ui_rules.write_text(json.dumps({"css_append": [{"glob": "assets/public/static/css/*.css", "append": "/*x*/"}]}), encoding="utf-8")

        report = apply_rules(unpacked, ad_rules, ui_rules)

        assert report.rewritten_files == 1
        assert report.dropped_files == 1
        assert report.appended_css_files == 1
        assert "noop(" in js.read_text(encoding="utf-8")
        assert "/*x*/" in css.read_text(encoding="utf-8")
        assert not ad_img.exists()
```

- [ ] **Step 3: 运行单测并提交**

```bash
python -m unittest -q
git add scripts/patcher.py tests/test_patcher.py
git commit -m "feat: add rule-driven patcher for ad removal and ui tweaks"
```

---

### Task 5: 静态校验（防白屏 + 广告残留扫描）

**Files:**
- Create: `scripts/validate.py`
- Test: `tests/test_validate.py`

- [ ] **Step 1: 实现校验器**

`scripts/validate.py`:
```python
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    errors: list[str]


def validate_unpacked(unpacked_root: Path, ad_rules_path: Path) -> ValidationResult:
    errors: list[str] = []

    must_exist = [
        "assets/public/index.html",
        "assets/public/asset-manifest.json",
    ]
    for rel in must_exist:
        if not (unpacked_root / rel).exists():
            errors.append(f"missing:{rel}")

    manifest_path = unpacked_root / "assets/public/asset-manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            files = manifest.get("files") or {}
            main_js = files.get("main.js")
            if isinstance(main_js, str):
                p = unpacked_root / "assets/public" / main_js.lstrip("/")
                if not p.exists():
                    errors.append(f"missing:manifest_ref:{main_js}")
        except Exception:
            errors.append("bad:asset-manifest.json")

    ad = json.loads(ad_rules_path.read_text(encoding="utf-8"))
    blocklist = [s.lower() for s in ad.get("string_blocklist", [])]
    scan_globs = ad.get("file_globs", [])
    for g in scan_globs:
        for p in unpacked_root.glob(g):
            if not p.is_file():
                continue
            try:
                text = p.read_text(encoding="utf-8", errors="ignore").lower()
            except Exception:
                continue
            for s in blocklist:
                if s and s in text:
                    errors.append(f"ad-hit:{s}:{p.as_posix()}")
                    break

    return ValidationResult(ok=(len(errors) == 0), errors=errors)
```

- [ ] **Step 2: 写单测**

`tests/test_validate.py`:
```python
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.validate import validate_unpacked


def test_validate_missing_files():
    with TemporaryDirectory() as td:
        root = Path(td)
        (root / "assets/public").mkdir(parents=True)
        ad_rules = root / "ad.json"
        ad_rules.write_text(json.dumps({"string_blocklist": ["ad"], "file_globs": []}), encoding="utf-8")
        res = validate_unpacked(root, ad_rules)
        assert res.ok is False


def test_validate_manifest_ref():
    with TemporaryDirectory() as td:
        root = Path(td)
        (root / "assets/public/static/js").mkdir(parents=True)
        (root / "assets/public/index.html").write_text("x", encoding="utf-8")
        (root / "assets/public/asset-manifest.json").write_text(json.dumps({"files": {"main.js": "/static/js/main.js"}}), encoding="utf-8")
        (root / "assets/public/static/js/main.js").write_text("x", encoding="utf-8")
        ad_rules = root / "ad.json"
        ad_rules.write_text(json.dumps({"string_blocklist": ["ad"], "file_globs": []}), encoding="utf-8")
        res = validate_unpacked(root, ad_rules)
        assert res.ok is True
```

- [ ] **Step 3: 运行单测并提交**

```bash
python -m unittest -q
git add scripts/validate.py tests/test_validate.py
git commit -m "feat: add unpacked validation to prevent blank screen and ad residue"
```

---

### Task 6: GitHub Release 发布（REST API）

**Files:**
- Create: `scripts/github_release.py`

- [ ] **Step 1: 实现 Release 创建/查找/上传**

`scripts/github_release.py`:
```python
from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


API = "https://api.github.com"


def _token() -> str:
    t = os.environ.get("GITHUB_TOKEN")
    if not t:
        raise RuntimeError("GITHUB_TOKEN is required for GitHub release publishing")
    return t.strip()


def _req(method: str, url: str, data: dict[str, Any] | None = None, extra_headers: dict[str, str] | None = None) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {_token()}",
        "User-Agent": "jmcomic-adfree-bot",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if extra_headers:
        headers.update(extra_headers)
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, headers=headers, data=body, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _upload(url: str, file_path: Path, content_type: str = "application/vnd.android.package-archive") -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {_token()}",
        "User-Agent": "jmcomic-adfree-bot",
        "Content-Type": content_type,
    }
    with file_path.open("rb") as f:
        data = f.read()
    req = urllib.request.Request(url, headers=headers, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ensure_release(repo: str, tag: str, title: str, body: str) -> dict[str, Any]:
    try:
        return _req("GET", f"{API}/repos/{repo}/releases/tags/{tag}")
    except Exception:
        return _req(
            "POST",
            f"{API}/repos/{repo}/releases",
            data={"tag_name": tag, "name": title, "body": body, "draft": False, "prerelease": False},
        )


def upload_asset(repo: str, release_id: int, file_path: Path, name: str) -> dict[str, Any]:
    rel = _req("GET", f"{API}/repos/{repo}/releases/{release_id}")
    upload_url = str(rel["upload_url"]).split("{", 1)[0]
    return _upload(f"{upload_url}?name={name}", file_path)
```

- [ ] **Step 2: 提交**

```bash
git add scripts/github_release.py
git commit -m "feat: add github release publisher via rest api"
```

---

### Task 7: 端到端流水线（检测→处理→发布）

**Files:**
- Create: `scripts/pipeline.py`
- Modify: `README.md`

- [ ] **Step 1: 实现 keystore 生成与复用**

在 `scripts/pipeline.py` 中实现 `ensure_keystore()`，使用 `keytool` 生成 `~/.jmcomic_adfree/keystore.jks`（或仓库 `.cache/keystore.jks`）并复用，避免每次换签名。

- [ ] **Step 2: 实现完整 pipeline 主流程**

主流程（伪代码要求具象落地）：
1) 读取 `state/upstream.json`
2) `get_latest_release()`
3) `should_process()` 为 False → exit(0)
4) 下载 APK 到 `artifacts/input/<tag>/<asset>.apk`
5) 解包到 `artifacts/work/<tag>/unpacked`
6) `apply_rules(unpacked, rules/ad_patterns.json, rules/ui_tweaks.json)`
7) `validate_unpacked()`；失败则把 `errors` 写入 `artifacts/logs/<tag>.json` 并 exit(2)
8) 打包 unsigned → aligned → signed：
   - `artifacts/output/<tag>/jmcomic3_adfree_<tag>.apk`
9) 将 `unpacked` 同步到仓库工作区（覆盖当前解包文件），但保留仓库自有文件（`docs/ state/ rules/ scripts/ tests/ artifacts/` 等）
10) `git add -A && git commit -m "chore: sync upstream <tag> and apply adfree patches"`
11) `git push`
12) `ensure_release()` + `upload_asset()` 发布 `jmcomic3_adfree_<tag>.apk`
13) `mark_processed()` 更新状态并提交/推送（若尚未包含在前一步 commit）

- [ ] **Step 3: 更新 README**

补充：
- 自动化入口命令（手动跑）：`python scripts/pipeline.py`
- 需要的环境变量：`GITHUB_TOKEN`
- 失败时查看：`artifacts/logs/`

- [ ] **Step 4: 运行本地 dry-run**

Run:
```bash
python -m unittest -q
python scripts/pipeline.py --help || true
```

- [ ] **Step 5: 提交**

```bash
git add scripts/pipeline.py README.md
git commit -m "feat: add end-to-end pipeline for adfree rebuild and release"
```

---

### Task 8: 定时无人值守执行（每小时）

**Files:**
- None（创建一个定时任务）

- [ ] **Step 1: 创建定时任务**

Cron: `0 * * * *`

Message（要点）：
- `git pull --rebase`
- 运行 `python scripts/pipeline.py`
- 若无新版本：正常退出
- 若失败：保留 `artifacts/logs/`，不发布

---

## Plan Self-Review Checklist

- 覆盖了：检测版本→下载→解包→补丁→校验→打包签名→发布→提交改动→状态避免重复。
- 没有使用外部 Python 依赖（requests/pyyaml 等），减少环境不确定性。
- 对“版本变动”采用规则文件可热更新（无需改代码也能扩展补丁）。
