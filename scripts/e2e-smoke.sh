#!/usr/bin/env bash
#
# scripts/e2e-smoke.sh
#
# One-shot end-to-end smoke test (Python backend):
#   1. Installs the Python backend in editable mode.
#   2. Boots the offline e2e stub server on a free port.
#   3. Waits for /api/v1/health to become reachable.
#   4. Verifies the wire shape of /api/v1/health.
#   5. Always tears the server down (success or failure).
#
# Usage:
#   ./scripts/e2e-smoke.sh
#   PORT=9000 ./scripts/e2e-smoke.sh   # override e2e port
#
# Exits 0 on full success, non-zero on any failure.
#
# Note: the frontend HttpAPI integration suite is wired in once the
# chain layer and experiments land (Phase 2 / Phase 3).  Phase 1
# only verifies the skeleton is reachable end-to-end.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8765}"
HOST="${HOST:-127.0.0.1}"
LOG_FILE="${LOG_FILE:-/tmp/e2e-smoke-$$-server.log}"
SERVER_PID=""

# Colour helpers (no-op when stdout is not a tty).
if [ -t 1 ]; then
  C_BOLD="\033[1m"; C_GREEN="\033[32m"; C_RED="\033[31m"; C_YEL="\033[33m"; C_RST="\033[0m"
else
  C_BOLD=""; C_GREEN=""; C_RED=""; C_YEL=""; C_RST=""
fi

log()  { printf "%b\n" "${C_BOLD}[e2e-smoke]${C_RST} $*" >&2; }
ok()   { printf "%b\n" "${C_GREEN}✓${C_RST} $*" >&2; }
warn() { printf "%b\n" "${C_YEL}!${C_RST} $*" >&2; }
die()  { printf "%b\n" "${C_RED}✗${C_RST} $*" >&2; exit 1; }

cleanup() {
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    log "stopping e2e stub (pid=${SERVER_PID})"
    kill "${SERVER_PID}" 2>/dev/null || true
    # Give it 3s to exit cleanly, then SIGKILL.
    for _ in 1 2 3 4 5 6; do
      kill -0 "${SERVER_PID}" 2>/dev/null || break
      sleep 0.5
    done
    kill -9 "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  if [ -n "${LOG_FILE}" ] && [ "${KEEP_LOG:-0}" != "1" ]; then
    rm -f "${LOG_FILE}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ─── Preflight checks ────────────────────────────────────────────────────
[ -d "${REPO_ROOT}/backend" ] || die "backend/ not found at ${REPO_ROOT}"
command -v python3 >/dev/null 2>&1 || die "python3 not found in PATH"
command -v python3.12 >/dev/null 2>&1 || warn "python3.12 not in PATH; will fall back to python3"

# Pick the right interpreter.  Plan targets 3.12, so we prefer it
# when available, otherwise fall back to whatever `python3` resolves
# to.  The pyproject.toml requires >=3.12,<3.15, so we bail out
# hard if neither is acceptable.
PY="${PY:-}"
if command -v python3.12 >/dev/null 2>&1; then
  PY="$(command -v python3.12)"
elif command -v python3 >/dev/null 2>&1; then
  PY="$(command -v python3)"
else
  die "no python interpreter found"
fi
log "using python: ${PY}"
"${PY}" - <<'PY' || die "python ${PY} is outside the supported range (>=3.12,<3.15)"
import sys
if not (3, 12) <= sys.version_info < (3, 15):
    sys.exit(1)
PY

# ─── Step 1: Install backend ─────────────────────────────────────────────
log "installing backend (editable + dev extras)…"
(
  cd "${REPO_ROOT}/backend"
  "${PY}" -m pip install --quiet --upgrade pip
  "${PY}" -m pip install --quiet -e ".[dev]"
)
ok "backend installed"

# ─── Step 2: Start e2e stub ─────────────────────────────────────────────
log "starting e2e stub on http://${HOST}:${PORT}…"
(
  cd "${REPO_ROOT}/backend"
  E2E_HOST="${HOST}" E2E_PORT="${PORT}" E2E_LOG_LEVEL=warning \
    "${PY}" -m dtm_backend.scripts.e2e_server > "${LOG_FILE}" 2>&1 &
  echo $! > /tmp/e2e-smoke-$$-pid
)
SERVER_PID="$(cat /tmp/e2e-smoke-$$-pid 2>/dev/null || echo "")"
rm -f /tmp/e2e-smoke-$$-pid
[ -n "${SERVER_PID}" ] || die "failed to spawn e2e stub"

# ─── Step 3: Wait for /api/v1/health ─────────────────────────────────────
log "waiting for /api/v1/health…"
READY=0
for i in $(seq 1 60); do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    warn "e2e stub exited prematurely. server log:"
    sed 's/^/    /' "${LOG_FILE}" >&2 || true
    die "e2e stub process died"
  fi
  if curl -fsS -m 1 "http://${HOST}:${PORT}/api/v1/health" >/dev/null 2>&1; then
    READY=1
    ok "stub ready after ${i}×0.5s"
    break
  fi
  sleep 0.5
done
[ "${READY}" -eq 1 ] || {
  warn "server log:"
  sed 's/^/    /' "${LOG_FILE}" >&2 || true
  die "e2e stub failed to become ready within 30s"
}

# ─── Step 4: Verify /api/v1/health wire shape ──────────────────────────
log "verifying /api/v1/health wire shape…"
HEALTH_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/health")"
log "  → ${HEALTH_BODY}"
EXPECTED='{"status":"ok","chain":"mainnet","blockNumber":0,"wsConnected":false}'
if [ "${HEALTH_BODY}" != "${EXPECTED}" ]; then
  warn "expected: ${EXPECTED}"
  warn "got:      ${HEALTH_BODY}"
  die "/api/v1/health did not return the expected wire shape"
fi
ok "/api/v1/health shape OK"

# ─── Step 5: Verify CORS preflight ─────────────────────────────────────
log "verifying CORS headers…"
CORS_ORIGIN="$(curl -fsS -m 2 -D - -o /dev/null \
  -H "Origin: http://localhost:5173" \
  "http://${HOST}:${PORT}/api/v1/health" \
  | tr -d '\r' \
  | awk -F': ' 'tolower($1) == "access-control-allow-origin" { print $2; exit }')"
if [ "${CORS_ORIGIN}" != "http://localhost:5173" ]; then
  warn "got access-control-allow-origin: ${CORS_ORIGIN:-<missing>}"
  die "CORS middleware did not respond with the expected allow-origin"
fi
ok "CORS OK (allow-origin: ${CORS_ORIGIN})"

# ─── Done ───────────────────────────────────────────────────────────────
ok "e2e smoke OK  →  http://${HOST}:${PORT}"
exit 0
