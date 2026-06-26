"""Unit tests for `scripts/coverage_check.py`.

The script reads `coverage.json` (output of `coverage json`) and
applies per-glob thresholds.  Tests build a synthetic
`coverage.json` on disk and assert the script's exit code +
stdout output.

Thresholds (per the Phase 5 plan):
  - chain/       >= 80%
  - experiments/ >= 90%
  - routes/      >= 70%
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "coverage_check.py"


def _write_coverage(tmp_path: Path, files: dict[str, dict]) -> Path:
    """Build a minimal `coverage.json` with the given file entries.

    Each entry: {"summary": {"percent_covered": <float>}}.
    The `totals` block is included for completeness.
    """
    coverage_path = tmp_path / "coverage.json"
    payload = {
        "meta": {"version": "7.6.0", "timestamp": "2026-06-26T00:00:00Z"},
        "totals": {
            "covered_lines": 100,
            "num_statements": 200,
            "percent_covered": 50.0,
            "percent_covered_display": "50.0",
        },
        "files": files,
    }
    coverage_path.write_text(json.dumps(payload))
    return coverage_path


def _run(tmp_path: Path, coverage_path: Path, thresholds: dict[str, float]) -> subprocess.CompletedProcess[str]:
    """Invoke the script with the given coverage file and thresholds."""
    args = [
        sys.executable,
        str(SCRIPT),
        "--coverage",
        str(coverage_path),
        "--threshold",
        f"chain={thresholds['chain']}",
        "--threshold",
        f"experiments={thresholds['experiments']}",
        "--threshold",
        f"routes={thresholds['routes']}",
    ]
    return subprocess.run(args, capture_output=True, text=True, cwd=tmp_path)


def _file(percent: float) -> dict:
    """Build a minimal file entry with the given coverage %."""
    return {
        "summary": {
            "covered_lines": int(percent),
            "num_statements": 100,
            "percent_covered": percent,
            "missing_lines": [],
        }
    }


# ──────────────────────────────────────────────────────────────────────
# Pass / fail semantics
# ──────────────────────────────────────────────────────────────────────


def test_script_passes_when_all_glob_thresholds_met(tmp_path: Path) -> None:
    """All globs above their threshold → exit 0, no per-glob failure line."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(95.0),
        "src/dtm_backend/chain/pools.py": _file(90.0),
        "src/dtm_backend/experiments/il.py": _file(99.0),
        "src/dtm_backend/routes/health.py": _file(80.0),
    }
    cov = _write_coverage(tmp_path, files)
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 0, (
        f"expected 0, got {result.returncode}\nstdout={result.stdout}\nstderr={result.stderr}"
    )
    assert "FAIL" not in result.stdout


def test_script_fails_when_chain_below_threshold(tmp_path: Path) -> None:
    """chain at 70% with threshold 80% → exit 1 + FAIL line."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(70.0),
        "src/dtm_backend/experiments/il.py": _file(99.0),
        "src/dtm_backend/routes/health.py": _file(80.0),
    }
    cov = _write_coverage(tmp_path, files)
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 1
    assert "chain" in result.stdout
    assert "FAIL" in result.stdout


def test_script_fails_when_experiments_below_threshold(tmp_path: Path) -> None:
    """experiments at 80% with threshold 90% → exit 1 + FAIL line."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(95.0),
        "src/dtm_backend/experiments/il.py": _file(80.0),
        "src/dtm_backend/routes/health.py": _file(80.0),
    }
    cov = _write_coverage(tmp_path, files)
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 1
    assert "experiments" in result.stdout
    assert "FAIL" in result.stdout


def test_script_fails_when_routes_below_threshold(tmp_path: Path) -> None:
    """routes at 60% with threshold 70% → exit 1 + FAIL line."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(95.0),
        "src/dtm_backend/experiments/il.py": _file(99.0),
        "src/dtm_backend/routes/health.py": _file(60.0),
    }
    cov = _write_coverage(tmp_path, files)
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 1
    assert "routes" in result.stdout
    assert "FAIL" in result.stdout


# ──────────────────────────────────────────────────────────────────────
# Glob matching
# ──────────────────────────────────────────────────────────────────────


def test_script_matches_files_by_directory_glob(tmp_path: Path) -> None:
    """Files anywhere under `src/dtm_backend/chain/` count toward the
    chain threshold (not just one specific file)."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(50.0),
        "src/dtm_backend/chain/pools.py": _file(95.0),
        "src/dtm_backend/chain/transactions.py": _file(100.0),
        "src/dtm_backend/experiments/il.py": _file(99.0),
        "src/dtm_backend/routes/health.py": _file(80.0),
    }
    cov = _write_coverage(tmp_path, files)
    # Average of (50 + 95 + 100) / 3 = 81.67, above 80%.
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 0, result.stdout


def test_script_ignores_files_outside_matched_globs(tmp_path: Path) -> None:
    """`scripts/foo.py` is not in any threshold glob; it must not
    cause a failure."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(95.0),
        "src/dtm_backend/experiments/il.py": _file(99.0),
        "src/dtm_backend/routes/health.py": _file(80.0),
        "src/dtm_backend/scripts/e2e_server.py": _file(0.0),
        "src/dtm_backend/main.py": _file(0.0),
    }
    cov = _write_coverage(tmp_path, files)
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 0, result.stdout


# ──────────────────────────────────────────────────────────────────────
# Reporting
# ──────────────────────────────────────────────────────────────────────


def test_script_prints_per_glob_summary(tmp_path: Path) -> None:
    """For every glob the script prints a line with the %, the
    threshold, and PASS/FAIL — even when it passes."""
    files = {
        "src/dtm_backend/chain/abis.py": _file(95.0),
        "src/dtm_backend/experiments/il.py": _file(99.0),
        "src/dtm_backend/routes/health.py": _file(80.0),
    }
    cov = _write_coverage(tmp_path, files)
    result = _run(tmp_path, cov, {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 0
    assert "chain" in result.stdout
    assert "experiments" in result.stdout
    assert "routes" in result.stdout
    assert "PASS" in result.stdout


def test_script_fails_when_coverage_file_missing(tmp_path: Path) -> None:
    """A missing `coverage.json` exits 1 with a clear error."""
    result = _run(tmp_path, tmp_path / "missing.json", {"chain": 80.0, "experiments": 90.0, "routes": 70.0})
    assert result.returncode == 1
    assert "missing" in result.stderr.lower() or "not found" in result.stderr.lower()
