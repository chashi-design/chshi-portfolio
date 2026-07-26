#!/usr/bin/env python3

import argparse
import os
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSET_DIR = ROOT / "assets"
PNG_SUFFIXES = {".png"}
SKIPPED_SUFFIXES = {".jpg", ".jpeg", ".gif"}


def format_bytes(value):
    units = ["B", "KB", "MB", "GB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} {unit}"
        size /= 1024


def visual_signature(image):
    return image.convert("RGBA")


def images_match(original_path, optimized_path):
    with Image.open(original_path) as original, Image.open(optimized_path) as optimized:
        if original.size != optimized.size:
            return False

        original_rgba = visual_signature(original)
        optimized_rgba = visual_signature(optimized)
        return ImageChops.difference(original_rgba, optimized_rgba).getbbox() is None


def optimize_png(path, dry_run=False):
    original_size = path.stat().st_size
    tmp_path = path.with_name(f".{path.name}.optimize-tmp")

    try:
        with Image.open(path) as image:
            if getattr(image, "is_animated", False):
                return "skipped", original_size, original_size, "animated PNG"

            image.load()
            save_options = {
                "format": "PNG",
                "optimize": True,
                "compress_level": 9,
            }
            if "icc_profile" in image.info:
                save_options["icc_profile"] = image.info["icc_profile"]

            image.save(tmp_path, **save_options)

        optimized_size = tmp_path.stat().st_size
        if optimized_size >= original_size:
            tmp_path.unlink(missing_ok=True)
            return "unchanged", original_size, original_size, ""

        if not images_match(path, tmp_path):
            tmp_path.unlink(missing_ok=True)
            return "skipped", original_size, original_size, "pixel mismatch"

        if dry_run:
            tmp_path.unlink(missing_ok=True)
        else:
            os.replace(tmp_path, path)

        return "optimized", original_size, optimized_size, ""
    finally:
        tmp_path.unlink(missing_ok=True)


def iter_image_paths(asset_target):
    if asset_target.is_file():
        if asset_target.suffix.lower() in PNG_SUFFIXES | SKIPPED_SUFFIXES:
            yield asset_target
        return

    for path in sorted(asset_target.rglob("*")):
        if path.is_file() and path.suffix.lower() in PNG_SUFFIXES | SKIPPED_SUFFIXES:
            yield path


def display_path(path):
    try:
        return path.relative_to(ROOT)
    except ValueError:
        return path


def main():
    parser = argparse.ArgumentParser(description="Losslessly optimize raster image assets.")
    parser.add_argument(
        "asset_dir",
        nargs="?",
        default=str(DEFAULT_ASSET_DIR),
        help="Image file or directory to scan. Defaults to ./assets.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report savings without replacing files.")
    args = parser.parse_args()

    asset_target = Path(args.asset_dir).resolve()
    if not asset_target.exists():
        raise SystemExit(f"Asset path does not exist: {asset_target}")
    optimized = []
    unchanged = 0
    skipped = []
    total_before = 0
    total_after = 0

    for path in iter_image_paths(asset_target):
        suffix = path.suffix.lower()
        original_size = path.stat().st_size
        total_before += original_size

        if suffix in PNG_SUFFIXES:
            status, before, after, reason = optimize_png(path, dry_run=args.dry_run)
        else:
            status, before, after, reason = "skipped", original_size, original_size, "lossless PNG-only mode"

        total_after += after

        if status == "optimized":
            optimized.append((path, before, after))
        elif status == "unchanged":
            unchanged += 1
        else:
            skipped.append((path, reason))

    for path, before, after in optimized:
        relative = display_path(path)
        saved = before - after
        print(f"optimized {relative}: {format_bytes(before)} -> {format_bytes(after)} ({format_bytes(saved)} saved)")

    if skipped:
        for path, reason in skipped:
            relative = display_path(path)
            print(f"skipped {relative}: {reason}")

    saved_total = total_before - total_after
    mode = "dry run" if args.dry_run else "written"
    print()
    print(f"Result: {mode}")
    print(f"Optimized: {len(optimized)}")
    print(f"Unchanged: {unchanged}")
    print(f"Skipped: {len(skipped)}")
    print(f"Total: {format_bytes(total_before)} -> {format_bytes(total_after)} ({format_bytes(saved_total)} saved)")


if __name__ == "__main__":
    main()
