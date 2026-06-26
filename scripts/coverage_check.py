#!/usr/bin/env python3.12
"""Per-glob coverage gate for the Python backend.

Reads `coverage.json` (the output of `coverage json`) and asserts
that the average coverage in each named directory glob meets the
configured threshold.

Usage:
    coverage_check.py --coverage coverage/coverage.json \
        --threshold chain=80 \
        --threshold experiments=90 \
        --threshold routes=70

Exits 0 when every glob meets its threshold, 1 otherwise.  Files
that don't match any glob are ignored.

Each glob is matched against the start of the file path after
normalising backslashes to forward slashes.  A glob of `chain`
matches e.g. `src/dtm_backend/chain/abis.py`.

The script is invoked by the `backend-unit` CI job after
`coverage xml -o coverage/coverage.xml` (so the JSON sibling is
already on disk).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Per the Phase 5 plan defaults.  Override via --threshold <name>=<pct>.
DEFAULT_THRESHOLDS: dict[str, float] = {
    "chain": 80.0,
    "experiments": 90.0,
    "routes": 70.0,
}


def _parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse CLI args: a coverage file path + repeated --threshold."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--coverage",
        type=Path,
        default=Path("coverage/coverage.json"),
        help="path to coverage.json (default: coverage/coverage.json)",
    )
    parser.add_argument(
        "--threshold",
        action="append",
        default=[],
        metavar="GLOB=PCT",
        help="per-glob threshold, e.g. chain=80.  May be repeated.",
    )
    return parser.parse_args(argv)


def _parse_thresholds(raw: list[str]) -> dict[str, float]:
    """Parse `--threshold chain=80 experiments=90` into {glob: pct}."""
    thresholds: dict[str, float] = dict(DEFAULT_THRESHOLDS)
    for entry in raw:
        if "=" not in entry:
            raise SystemExit(f"--threshold must be GLOB=PCT, got {entry!r}")
        glob, value = entry.split("=", 1)
        thresholds[glob.strip()] = float(value.strip())
    return thresholds


def _file_in_glob(path: str, glob: str) -> bool:
    """True when `path` lives under the given directory glob.

    `chain` matches `src/dtm_backend/chain/...`; we match by
    segment so we don't accidentally treat a file called
    `chainfoo.py` as inside `chain/`.
    """
    parts = path.replace("\\", "/").split("/")
    return glob in parts


def _glob_average(files: dict[str, dict], glob: str) -> tuple[float, int]:
    """Return (average_percent_covered, file_count) for files in `glob`."""
    matched: list[float] = []
    for path, payload in files.items():
        if _file_in_glob(path, glob):
            summary = payload.get("summary", {})
            matched.append(float(summary.get("percent_covered", 0.0)))
    if not matched:
        return 0.0, 0
    return sum(matched) / len(matched), len(matched)


def _check(coverage_path: Path, thresholds: dict[str, float]) -> int:
    """Run the gate; return the process exit code (0 / 1)."""
    if not coverage_path.is_file():
        print(f"coverage file not found: {coverage_path}", file=sys.stderr)
        return 1
    with coverage_path.open() as fh:
        data = json.load(fh)
    files = data.get("files", {})

    failures = 0
    print(f"per-glob coverage (source: {coverage_path})")
    for glob, threshold in sorted(thresholds.items()):
        avg, count = _glob_average(files, glob)
        if count == 0:
            print(f"  {glob:<14}  no files matched   SKIP")
            continue
        status = "PASS" if avg >= threshold else "FAIL"
        print(f"  {glob:<14}  avg={avg:5.1f}%  threshold={threshold:5.1f}%  files={count:3d}  {status}")
        if avg < threshold:
            failures += 1
    if failures:
        print(f"{failures} glob(s) below threshold", file=sys.stderr)
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    thresholds = _parse_thresholds(args.threshold)
    return _check(args.coverage, thresholds)


if __name__ == "__main__":
    raise SystemExit(main())
