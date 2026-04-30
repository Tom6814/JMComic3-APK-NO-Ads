from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from scripts.git_utils import origin_token


API = "https://api.github.com"


def token() -> str:
    t = os.environ.get("GITHUB_TOKEN")
    if t and t.strip():
        return t.strip()
    t2 = origin_token()
    if t2:
        return t2
    raise RuntimeError("missing github token (set GITHUB_TOKEN or use x-access-token remote)")


def request_json(method: str, url: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token()}",
        "User-Agent": "jmcomic-adfree-bot",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, headers=headers, data=body, method=method)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def request_no_body(method: str, url: str) -> None:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token()}",
        "User-Agent": "jmcomic-adfree-bot",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    req = urllib.request.Request(url, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60):
        return None


def upload_binary(url: str, file_path: Path, content_type: str) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {token()}",
        "User-Agent": "jmcomic-adfree-bot",
        "Content-Type": content_type,
    }
    with file_path.open("rb") as f:
        data = f.read()
    req = urllib.request.Request(url, headers=headers, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ensure_release(repo: str, tag: str, title: str, body: str, *, draft: bool = True) -> tuple[dict[str, Any], bool]:
    try:
        return request_json("GET", f"{API}/repos/{repo}/releases/tags/{tag}"), False
    except Exception:
        return (
            request_json(
            "POST",
            f"{API}/repos/{repo}/releases",
                data={"tag_name": tag, "name": title, "body": body, "draft": draft, "prerelease": False},
            ),
            True,
        )


def update_release(repo: str, release_id: int, data: dict[str, Any]) -> dict[str, Any]:
    return request_json("PATCH", f"{API}/repos/{repo}/releases/{release_id}", data=data)


def delete_release(repo: str, release_id: int) -> None:
    request_no_body("DELETE", f"{API}/repos/{repo}/releases/{release_id}")


def delete_asset_if_exists(repo: str, release_id: int, name: str) -> None:
    rel = request_json("GET", f"{API}/repos/{repo}/releases/{release_id}")
    assets = rel.get("assets") or []
    for a in assets:
        if str(a.get("name")) == name:
            asset_id = int(a["id"])
            request_no_body("DELETE", f"{API}/repos/{repo}/releases/assets/{asset_id}")
            return None


def upload_asset(repo: str, release_id: int, file_path: Path, name: str) -> dict[str, Any]:
    rel = request_json("GET", f"{API}/repos/{repo}/releases/{release_id}")
    upload_url = str(rel["upload_url"]).split("{", 1)[0]
    delete_asset_if_exists(repo, release_id, name)
    url = upload_url + "?" + urllib.parse.urlencode({"name": name})
    return upload_binary(url, file_path, "application/vnd.android.package-archive")
