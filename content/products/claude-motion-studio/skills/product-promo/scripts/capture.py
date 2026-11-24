#!/usr/bin/env python3
"""Screenshot web pages for a product promo, with the Chrome already installed.

Uses Google Chrome / Chromium / Edge in headless mode — no extra packages.
Each page is opened at the given window size, given time to finish its
animations, and saved as a PNG at 2x pixel density (sharp when the video
zooms in).

Only pages that open without signing in can be captured this way. For pages
behind a login, take the screenshots yourself (browser → Developer tools →
Capture screenshot) and put the PNGs in public/shots/.

Examples:
    python3 capture.py https://example.com https://example.com/pricing --out public/shots
    python3 capture.py https://example.com --size 390x844 --name mobile-home   # phone
    python3 capture.py https://example.com --dark --wait 12
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]


def find_browser() -> str:
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"):
        found = shutil.which(name)
        if found:
            return found
    for path in CANDIDATES:
        if os.path.exists(path):
            return path
    raise RuntimeError("no Chrome, Chromium or Edge found — install Chrome, or take the screenshots by hand")


def slug(url: str) -> str:
    parts = urlparse(url)
    name = (parts.path.strip("/") or "home").replace("/", "-")
    return re.sub(r"[^A-Za-z0-9._-]+", "-", name)[:60] or "page"


def png_size(path: Path) -> tuple[int, int]:
    with open(path, "rb") as handle:
        header = handle.read(24)
    return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Headless-Chrome screenshots for the ProductPromo composition.")
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--out", type=Path, default=Path("public/shots"))
    parser.add_argument("--size", default="1440x900", help="window WIDTHxHEIGHT in CSS pixels (default 1440x900; phone 390x844)")
    parser.add_argument("--scale", type=float, default=2, help="pixel density (default 2)")
    parser.add_argument("--wait", type=float, default=8, help="seconds to let the page load and settle (default 8)")
    parser.add_argument("--dark", action="store_true", help="ask the page for its dark theme")
    parser.add_argument("--name", help="file name for a single URL (without .png)")
    args = parser.parse_args(argv)

    try:
        width, _, height = args.size.lower().partition("x")
        width, height = int(width), int(height)
        browser = find_browser()
    except (ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    results = []
    with tempfile.TemporaryDirectory() as profile:
        for url in args.urls:
            if not url.startswith(("http://", "https://")):
                url = "https://" + url
            name = args.name if args.name and len(args.urls) == 1 else slug(url)
            target = (args.out / f"{name}.png").resolve()
            command = [
                browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                f"--user-data-dir={profile}", f"--window-size={width},{height}",
                f"--force-device-scale-factor={args.scale}", f"--virtual-time-budget={int(args.wait * 1000)}",
                f"--screenshot={target}",
            ]
            if args.dark:
                command.append("--force-dark-mode")
            done = subprocess.run(command + [url], capture_output=True, text=True, timeout=max(60, args.wait * 4))
            if done.returncode or not target.exists():
                results.append({"url": url, "error": (done.stderr or "no screenshot written").strip()[-300:]})
                continue
            w, h = png_size(target)
            note = None
            if target.stat().st_size < 60_000:
                note = "very small file — the page may be blank, a 404 or a sign-in wall; open the PNG and check"
            results.append({"url": url, "file": str(target), "pixels": f"{w}x{h}", "public_path": f"{args.out.name}/{target.name}" if args.out.parent.name == "public" else None, "check": note})
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0 if all("file" in r for r in results) else 2


if __name__ == "__main__":
    sys.exit(main())
