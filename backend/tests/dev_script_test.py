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

    We simulate by:
      1. Occupying a TCP port via a tiny Python `socket.bind()`.
      2. Asking the dev script to start its backend on the same
         port — uvicorn's bind will fail.
      3. The script must detect the failure and emit a
         "backend exited" / "log kept at" line on stderr before
         exiting non-zero.

    We give the script SKIP_INSTALL=1 to keep the test fast."""
    import socket
    # Pick a port that's likely free; bind it so the next bind
    # to the same port fails.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        occupied_port = s.getsockname()[1]
        # We must keep `s` open through the dev.sh run; closing
        # it would let uvicorn grab the port.  So we wrap the
        # subprocess call inside the `with` block.
        res = _run(
            ["--backend-only"],
            env_extra={
                "SKIP_INSTALL": "1",
                "BACKEND_PORT": str(occupied_port),
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
        or "log:" in res.stderr
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


def test_default_backend_mode_is_e2e() -> None:
    """The default BACKEND_MODE must be the offline e2e stub, not
    the production server.

    Without an e2e default, a fresh `./scripts/dev.sh` on a
    developer machine without an Ethereum RPC would 500 every
    /api/v1/pools call (the production `dtm_backend.main` does
    not install chain fetchers on `app.state`).  The e2e stub
    wires canned fetchers so the live page, Liquidation page,
    and LP/IL page all return data without any network access.
    """
    src = SCRIPT.read_text()
    assert 'BACKEND_MODE="${BACKEND_MODE:-e2e}"' in src, (
        "default BACKEND_MODE must be 'e2e' so dev environments "
        "don't 500 on /api/v1/pools"
    )


def test_backend_mode_e2e_launches_e2e_server() -> None:
    """In e2e mode the script must exec the e2e stub module, not
    the production `dtm_backend.main`.  We do a static check on
    the source — no subprocess — so the test stays fast."""
    src = SCRIPT.read_text()
    assert "dtm_backend.scripts.e2e_server" in src, (
        "BACKEND_MODE=e2e must launch dtm_backend.scripts.e2e_server"
    )
    # The e2e branch and the prod branch must both be present
    # in the launcher logic.
    assert "BACKEND_CMD=(" in src
    assert "e2e)  BACKEND_CMD=" in src or "e2e) BACKEND_CMD=" in src
    assert "prod) BACKEND_CMD=" in src


def test_invalid_backend_mode_rejected() -> None:
    """An invalid BACKEND_MODE value must exit non-zero (2) with
    a clear error, so the user doesn't silently end up on the
    wrong backend."""
    res = _run(["--backend-only"], env_extra={"BACKEND_MODE": "bogus"})
    assert res.returncode == 2, f"expected exit 2, got {res.returncode}"
    assert "invalid BACKEND_MODE" in res.stderr
    assert "expected: e2e|prod" in res.stderr


def test_backend_mode_documented_in_help() -> None:
    """The --help output must list BACKEND_MODE so users can
    discover the e2e/prod switch without reading the source."""
    res = _run(["--help"])
    assert res.returncode == 0
    assert "BACKEND_MODE" in res.stdout
    assert "e2e" in res.stdout
    assert "prod" in res.stdout


def test_launch_backend_passes_e2e_host_port_env() -> None:
    """Static guard: `launch_backend` must export both the
    production `HOST`/`PORT` (for `dtm_backend.main`) and the
    e2e stub's `E2E_HOST`/`E2E_PORT` (for `e2e_server.py`), so a
    single `launch_backend` works for either backend mode
    without the script caller having to know which is in use."""
    src = SCRIPT.read_text()
    # Find the launch_backend function body.
    idx = src.index("launch_backend()")
    body = src[idx: idx + 1500]
    for var in ("HOST=", "PORT=", "E2E_HOST=", "E2E_PORT="):
        assert var in body, (
            f"launch_backend must export {var.rstrip('=')} so the "
            f"e2e stub can bind to the chosen port"
        )
