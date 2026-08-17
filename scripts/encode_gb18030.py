from pathlib import Path
import sys


def main() -> int:
    paths = sys.argv[1:]
    if len(paths) % 2:
        print("Expected source and destination paths in pairs.", file=sys.stderr)
        return 2

    for source, destination in zip(paths[::2], paths[1::2]):
        try:
            text = Path(source).read_bytes().decode("utf-8")
            Path(destination).write_bytes(text.encode("gb18030"))
        except (OSError, UnicodeError) as error:
            print(f"Unable to encode {source}: {error}", file=sys.stderr)
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
