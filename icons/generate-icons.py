#!/usr/bin/env python3
"""
Generate Manodaya Homes PWA icons.

Run from project root:
  .venv-icons/bin/python icons/generate-icons.py

Replace the output PNGs with custom artwork anytime — keep filenames
icon-192.png and icon-512.png for manifest.json.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Brand palette (matches style.css)
GREEN = "#1a5c3a"
GREEN_MID = "#2a7349"
GREEN_LIGHT = "#edf7f1"
PAPER = "#faf9f5"
TERRA = "#7a3010"
ACCENT = "#c8a84b"


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def draw_house(draw: ImageDraw.ImageDraw, size: int) -> None:
    s = size / 512
    cx = size / 2

    # Soft ground strip
    ground_y = int(392 * s)
    draw.rounded_rectangle(
        (int(48 * s), ground_y, int(464 * s), int(464 * s)),
        radius=int(18 * s),
        fill=GREEN_MID,
    )

    # House body
    body = (
        int(148 * s),
        int(228 * s),
        int(364 * s),
        int(392 * s),
    )
    draw.rounded_rectangle(body, radius=int(14 * s), fill=PAPER)

    # Roof (warm terracotta tone — homestay feel)
    roof = [
        (cx, int(108 * s)),
        (int(118 * s), int(248 * s)),
        (int(394 * s), int(248 * s)),
    ]
    draw.polygon(roof, fill="#e8ddd0")

    # Roof overhang shadow line
    draw.line(
        [(int(118 * s), int(248 * s)), (int(394 * s), int(248 * s))],
        fill=TERRA,
        width=max(2, int(4 * s)),
    )

    # Chimney
    chim = (
        int(292 * s),
        int(148 * s),
        int(332 * s),
        int(228 * s),
    )
    draw.rounded_rectangle(chim, radius=int(6 * s), fill=PAPER)
    draw.rectangle(
        (int(286 * s), int(142 * s), int(338 * s), int(154 * s)),
        fill=TERRA,
    )

    # Door
    door = (
        int(226 * s),
        int(292 * s),
        int(286 * s),
        int(392 * s),
    )
    draw.rounded_rectangle(door, radius=int(8 * s), fill=TERRA)
    draw.ellipse(
        (
            int(272 * s),
            int(338 * s),
            int(282 * s),
            int(348 * s),
        ),
        fill=ACCENT,
    )

    # Windows
    for wx in (int(172 * s), int(318 * s)):
        win = (wx, int(268 * s), wx + int(56 * s), int(318 * s))
        draw.rounded_rectangle(win, radius=int(6 * s), fill=GREEN_LIGHT, outline=GREEN, width=max(2, int(3 * s)))
        mid_x = wx + int(28 * s)
        mid_y1, mid_y2 = int(268 * s), int(318 * s)
        draw.line([(mid_x, mid_y1), (mid_x, mid_y2)], fill=GREEN, width=max(1, int(2 * s)))
        draw.line([(wx, int(293 * s)), (wx + int(56 * s), int(293 * s))], fill=GREEN, width=max(1, int(2 * s)))

    # Welcome step
    draw.rounded_rectangle(
        (int(214 * s), int(384 * s), int(298 * s), int(398 * s)),
        radius=int(4 * s),
        fill=ACCENT,
    )

    # Small "MH" monogram badge — readable at 512, subtle at 192
    badge_r = int(36 * s)
    badge_cx, badge_cy = int(408 * s), int(156 * s)
    draw.ellipse(
        (
            badge_cx - badge_r,
            badge_cy - badge_r,
            badge_cx + badge_r,
            badge_cy + badge_r,
        ),
        fill=ACCENT,
    )
    font_size = max(14, int(28 * s))
    try:
        from PIL import ImageFont

        font = ImageFont.truetype("/System/Library/Fonts/Supplemental Georgia Bold.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()

    label = "MH"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (badge_cx - tw / 2, badge_cy - th / 2 - int(2 * s)),
        label,
        fill=PAPER,
        font=font,
    )


def render_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), GREEN)
    draw = ImageDraw.Draw(img)

    # Subtle inner frame for polish (flat, not gradient)
    inset = max(2, size // 64)
    draw.rounded_rectangle(
        (inset, inset, size - inset, size - inset),
        radius=size // 8,
        outline=GREEN_MID,
        width=max(1, size // 128),
    )

    draw_house(draw, size)
    return img


def main() -> None:
    root = Path(__file__).resolve().parent
    for size in (512, 192):
        path = root / f"icon-{size}.png"
        render_icon(size).save(path, "PNG", optimize=True)
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
