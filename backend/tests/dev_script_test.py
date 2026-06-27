"""Smoke tests for ``scripts/dev.sh``.

These tests don't actually launch the backend or frontend; they only
verify the script's surface behaviour (help text, argument parsing,
mutual-exclusion checks, and basic syntax).  End-to-end launch is
covered by the manual developer workflow.

Tests run the script via ``subprocess.run`` with a short timeout
and require the host to have ``bash`` and ``mktemp`` available
(guaranteed on every CI runner we target).
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT = REPO_ROOT / "scripts" / "dev.sh"


def _run(args: list[str], env_extra: dict[str, str] | None = None, timeout: int = 10) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    # Force a clean shell environment for the script so we don't
    # inherit a half-configured dev shell from the test runner.
    env["SKIP_PY_CHECK"] = "1"
    env["SKIP_PORT_CHECK"] = "1"
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        ["bash", str(SCRIPT), *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
        cwd=str(REPO_ROOT),
    )


def test_script_exists_and_is_executable() -> None:
    assert SCRIPT.exists(), f"{SCRIPT} not found"
    assert os.access(SCRIPT, os.X_OK), f"{SCRIPT} is not executable"


def test_bash_syntax_check() -> None:
    """`bash -n` parses the script without executing it."""
    res = subprocess.run(
        ["bash", "-n", str(SCRIPT)],
        capture_output=True,
        text=True,
        timeout=5,
    )
    assert res.returncode == 0, f"bash -n failed: {res.stderr}"


def test_help_prints_usage_and_exits_zero() -> None:
    res = _run(["--help"])
    assert res.returncode == 0, f"--help exited {res.returncode}\nstderr: {res.stderr}"
    assert "Usage: scripts/dev.sh" in res.stdout
    assert "--backend-only" in res.stdout
    assert "--frontend-only" in res.stdout
    assert "BACKEND_PORT" in res.stdout
    assert "FRONTEND_PORT" in res.stdout


def test_unknown_arg_rejected() -> None:
    res = _run(["--no-such-flag"])
    assert res.returncode == 2, f"expected exit 2, got {res.returncode}"
    assert "unknown argument" in res.stderr


def test_backend_only_and_frontend_only_are_mutually_exclusive() -> None:
    res = _run(["--backend-only", "--frontend-only"])
    assert res.returncode == 2, f"expected exit 2, got {res.returncode}"
    assert "mutually exclusive" in res.stderr


@pytest.mark.skipif(
    shutil.which("node") is None or shutil.which("pnpm") is None,
    reason="node/pnpm not available",
)
def test_frontend_only_fails_cleanly_when_node_modules_missing() -> None:
    """`--frontend-only` should at least get past preflight checks
    and attempt to launch pnpm — even if vite later fails because
    node_modules isn't installed, the preflight banner should print."""
    res = _run(["--frontend-only"], env_extra={"KEEP_LOGS": "1"}, timeout=8)
    # Either the script launched vite (which may or may not crash
    # depending on node_modules state) and was killed by the
    # timeout, or it bailed early because pnpm exec failed.
    # We only assert the *banner* lines were printed, not the
    # exit code (which is environment-dependent).
    assert "starting DTM dev stack" in res.stderr
    assert "frontend" in res.stderr
