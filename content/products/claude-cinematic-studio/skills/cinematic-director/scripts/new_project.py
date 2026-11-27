#!/usr/bin/env python3
"""Create a cinematic project from the bundled Remotion + three.js template.

Copies skills/cinematic-director/template/ into a new folder, optionally
switches every composition to one look, and prints the next steps. It does not
run npm itself — installing packages downloads code, so that is the user's call.

The project is timed in seconds and reads its frame rate from the `fps` prop,
so the same film renders at 24/30/60 fps for delivery or at 4x for real motion
blur (see grade-finish/scripts/finish.py).

Examples:
    python3 new_project.py ./launch-film
    python3 new_project.py ./reel --look kinetic
    python3 new_project.py --list-looks
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / "template"
LOOKS = {
    "keynote": "premium product launch: titanium type, black space, soft strip lights",
    "chrome": "luxury and fashion: mirror chrome, deep blue night, hard reflections",
    "kinetic": "sport and energy: matte black, one acid accent, hard cuts",
    "neon": "futuristic brand film: graphite and cyan, glow, HUD, grid, light trails",
    "editorial": "film title and storytelling: serif in warm gold, slow drift, grain",
}
SKIP = {"node_modules", "out", ".remotion", "dist", "build"}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="New cinematic project from the Cinematic Studio template.")
    parser.add_argument("target", nargs="?", type=Path, help="folder to create")
    parser.add_argument("--look", choices=sorted(LOOKS), help="switch every composition's default look to this one")
    parser.add_argument("--name", help="package name (default: folder name)")
    parser.add_argument("--force", action="store_true", help="write into a folder that is not empty")
    parser.add_argument("--list-looks", action="store_true")
    args = parser.parse_args(argv)

    if args.list_looks:
        for name, brief in LOOKS.items():
            print(f"{name:10} {brief}")
        return 0
    if not args.target:
        parser.error("give a folder, e.g. ./my-film")
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
    for folder in ("public/footage", "public/models", "public/audio", "out"):
        (target / folder).mkdir(parents=True, exist_ok=True)

    package = target / "package.json"
    data = json.loads(package.read_text(encoding="utf-8"))
    data["name"] = re.sub(r"[^a-z0-9-]+", "-", (args.name or target.name).lower()).strip("-") or "cinematic-film"
    package.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    switched = 0
    if args.look:
        root = target / "src" / "Root.tsx"
        text = root.read_text(encoding="utf-8")
        text, switched = re.subn(r'look: "[a-z]+" as const', f'look: "{args.look}" as const', text)
        root.write_text(text, encoding="utf-8")

    print(json.dumps({
        "project": str(target),
        "files": copied,
        "look": args.look or "per composition",
        "compositions_switched": switched,
        "next": [
            f"cd {target}",
            "npm install            # ~400 MB: Remotion, three.js, Chrome for rendering",
            "npx remotion studio    # preview and scrub in the browser",
            "npx remotion still HeroTitle out/frame.png --frame=120 --scale=0.5",
            "npx remotion render HeroTitle out/hero.mp4",
        ],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
