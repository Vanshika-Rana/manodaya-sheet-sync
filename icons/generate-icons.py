#!/usr/bin/env python3
"""Generate placeholder PWA icons. Replace icons/icon-192.png and icons/icon-512.png with real artwork when ready."""

import struct
import zlib
from pathlib import Path

GREEN = (0x1A, 0x5C, 0x3A)


def write_png(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
    compressed = zlib.compress(raw, 9)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)
    print(f"Wrote {path}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    write_png(root / "icon-192.png", 192, 192, GREEN)
    write_png(root / "icon-512.png", 512, 512, GREEN)
