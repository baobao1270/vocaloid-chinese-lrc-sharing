from pathlib import Path
import sys


def main() -> int:
    paths = sys.argv[1:]
    if len(paths) % 2:
        print("Expected UTF-8 and GB18030 paths in pairs.", file=sys.stderr)
        return 2

    for utf8_path, gb18030_path in zip(paths[::2], paths[1::2]):
        try:
            source = Path(utf8_path).read_bytes()
            decoded = Path(gb18030_path).read_bytes().decode("gb18030").encode("utf-8")
        except (OSError, UnicodeError) as error:
            print(f"Unable to verify {gb18030_path}: {error}", file=sys.stderr)
            return 1

        if source != decoded:
            print(f"GB18030 content differs after round-trip: {gb18030_path}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
