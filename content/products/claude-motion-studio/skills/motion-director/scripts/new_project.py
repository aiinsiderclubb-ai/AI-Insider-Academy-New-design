#!/usr/bin/env python3
"""Create a motion project from the bundled Remotion template.

Copies skills/motion-director/template/ into a new folder, sets the style
every composition starts in, and prints the next steps. It does not run
npm itself — installing packages is the user's call.

Examples:
    python3 new_project.py ./promo-video
    python3 new_project.py ./reel --style swiss-grid
    python3 new_project.py --list-styles
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "template"
STYLES = ["signal", "swiss-grid", "editorial", "terminal", "bold-kinetic", "data-noir", "print-riso", "quiet-line"]
SKIP = {"node_modules", "out", ".remotion", "dist", "build"}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="New Remotion motion project from the Motion Studio template.")
    parser.add_argument("target", nargs="?", type=Path, help="folder to create")
    parser.add_argument("--style", default="signal", choices=STYLES, help="style the compositions start in (default signal)")
    parser.add_argument("--name", help="package name (default: folder name)")
    parser.add_argument("--force", action="store_true", help="write into a folder that is not empty")
    parser.add_argument("--list-styles", action="store_true")
    args = parser.parse_args(argv)

    if args.list_styles:
        print("\n".join(STYLES))
        return 0
    if not args.target:
        parser.error("give a folder, e.g. ./my-video")
    if not TEMPLATE.is_dir():
        print(f"error: template not found at {TEMPLATE} — copy the whole skill folder, not just SKILL.md", file=sys.stderr)
        return 1
    target = args.target.resolve()
    if target.exists() and any(target.iterdir()) and not args.force:
        print(f"error: {target} is not empty — choose a new folder, or pass --force to write into it", file=sys.stderr)
        return 1

    copied = 0
    for source in sorted(TEMPLATE.rglob("*")):
        relative = source.relative_to(TEMPLATE)
        if any(part in SKIP for part in relative.parts) or source.is_dir():
            continue
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied += 1

    package = target / "package.json"
    data = json.loads(package.read_text(encoding="utf-8"))
    data["name"] = re.sub(r"[^a-z0-9-]+", "-", (args.name or target.name).lower()).strip("-") or "motion-video"
    package.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    restyled = []
    if args.style != "signal":
        for file in sorted((target / "src" / "compositions").glob("*.tsx")):
            text = file.read_text(encoding="utf-8")
            new = text.replace('style: "signal"', f'style: "{args.style}"')
            if new != text:
                file.write_text(new, encoding="utf-8")
                restyled.append(file.name)

    print(json.dumps({
        "project": str(target),
        "files": copied,
        "style": args.style,
        "restyled": restyled,
        "next": [f"cd {target}", "npm install", "npx remotion studio   # preview in the browser", "npx remotion render KineticType out/reel.mp4"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
