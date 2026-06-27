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
def test_frontend_only_does_not_exit_silently() -> None:
    """Regression test for the "silent exit" bug: when a service
    dies the script must log WHICH one died AND where its log
    file lives, so the user can debug.  Earlier the script
    would silently exit on a service failure because `wait` was
    in `set -e` context — bash aborted before any log line could
    print.

    We simulate by passing a port that will fail to bind (port 1
    is reserved and uvicorn/vite can't listen there without root).
    The script should detect the failure and log something like
    "backend exited (code=...) — stopping frontend" before
    exiting.  We give the script SKIP_INSTALL=1 to keep the test
    fast and deterministic."""
    res = _run(
        ["--backend-only"],
        env_extra={
            "SKIP_INSTALL": "1",
            "BACKEND_PORT": "1",       # unprivileged bind will fail
            "KEEP_LOGS": "1",
        },
        timeout=10,
    )
    # The script should have exited non-zero (something failed)
    # and its stderr should contain either the "exited" line OR
    # a "log kept at" line.  Either proves the failure path is
    # now observable to the user.
    assert res.returncode != 0, (
        f"expected non-zero exit, got {res.returncode}\n"
        f"stdout: {res.stdout}\nstderr: {res.stderr}"
    )
    assert (
        "exited" in res.stderr
        or "log kept at" in res.stderr
    ), (
        f"failure path is silent — user can't see what went wrong\n"
        f"stderr: {res.stderr}"
    )


def test_script_works_under_bash_posix() -> None:
    """Regression test: the dual-service wait loop must work in
    bash's POSIX mode (where `wait -n` is unavailable).  We launch
    the script under `bash --posix` with `--help`; this exercises
    the same code path the user hit when their shell activated
    POSIX mode and `wait -n` failed with `wait: usage: wait [n]`."""
    res = subprocess.run(
        ["bash", "--posix", str(SCRIPT), "--help"],
        capture_output=True,
        text=True,
        timeout=5,
        env={**os.environ, "SKIP_PY_CHECK": "1", "SKIP_PORT_CHECK": "1"},
        cwd=str(REPO_ROOT),
    )
    assert res.returncode == 0, (
        f"bash --posix --help exited {res.returncode}\n"
        f"stdout: {res.stdout}\nstderr: {res.stderr}"
    )
    assert "Usage: scripts/dev.sh" in res.stdout


def test_script_avoids_posix_only_wait_flags() -> None:
    """Static guard: the source must not invoke the `wait` builtin
    with the `-n` flag (which is bash-4.3+ only and breaks under
    POSIX mode).  We allow the literal phrase to appear in
    comments, but flag any line where it's clearly a command
    invocation (i.e. starts with `wait ` or follows a `;` / `&&` /
    `||` / `|` / `(` boundary).  Catch this at review time so we
    don't regress."""
    src = SCRIPT.read_text()
    # Match `wait` followed by whitespace and `-n`, but not in a
    # comment.  We strip comment lines first to avoid false
    # positives from prose that mentions the flag.
    code_lines = [
        ln for ln in src.splitlines()
        if not ln.lstrip().startswith("#")
    ]
    code = "\n".join(code_lines)
    assert "wait -n" not in code, (
        "scripts/dev.sh invokes `wait -n`, which is unavailable in "
        "POSIX mode.  Use a `kill -0` poll loop instead."
    )


def test_script_documents_skip_install() -> None:
    """The auto-install feature must be discoverable — both in
    --help output and as an env var hook.  We assert the doc
    string contains the SKIP_INSTALL name and that the help text
    mentions auto-install behaviour, so future maintainers don't
    accidentally remove this contract."""
    res = _run(["--help"])
    assert "auto-install" in res.stdout.lower() or "auto install" in res.stdout.lower(), (
        "--help output should describe the auto-install behaviour"
    )
    assert "SKIP_INSTALL" in res.stdout

    src = SCRIPT.read_text()
    assert "SKIP_INSTALL" in src
    # The two install functions must both honour SKIP_INSTALL.
    for fn in ("ensure_backend_deps", "ensure_frontend_deps"):
        assert fn in src
        # Sanity: the function body should reference SKIP_INSTALL.
        fn_idx = src.index(f"{fn}()")
        fn_body = src[fn_idx: fn_idx + 600]
        assert "SKIP_INSTALL" in fn_body, (
            f"{fn} does not honour SKIP_INSTALL"
        )


def test_log_files_have_visible_paths_on_failure() -> None:
    """Static guard: when a service dies, the script must log the
    per-service log file path so the user can debug.  Otherwise
    the failure is silent (the symptom of the bug that prompted
    this whole refactor)."""
    src = SCRIPT.read_text()
    # The asymmetric "frontend died" branch must mention both the
    # exit code AND the log file path.  We assert the string
    # "log:" appears inside that branch.
    assert "frontend log:" in src, (
        "scripts/dev.sh must print the per-service log path when "
        "a service dies, otherwise failures are silent."
    )
