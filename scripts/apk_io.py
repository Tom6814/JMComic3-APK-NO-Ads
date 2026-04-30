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
            z.write(p, p.relative_to(src_dir).as_posix())


def zipalign_and_sign(
    unsigned_apk: Path,
    aligned_apk: Path,
    signed_apk: Path,
    keystore: Path,
    ks_pass: str,
    alias: str,
    key_pass: str,
    build_tools_version: str = "34.0.0",
) -> None:
    zipalign, apksigner = ensure_android_build_tools(build_tools_version)
    aligned_apk.parent.mkdir(parents=True, exist_ok=True)
    signed_apk.parent.mkdir(parents=True, exist_ok=True)

    try:
        subprocess.run([str(zipalign), "-f", "4", str(unsigned_apk), str(aligned_apk)], check=True)
    except Exception:
        shutil.copy2(unsigned_apk, aligned_apk)
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
