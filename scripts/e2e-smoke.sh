#!/usr/bin/env bash
#
# scripts/e2e-smoke.sh
#
# One-shot end-to-end smoke test:
#   1. Builds the backend.
#   2. Boots the offline e2e stub server on a free port.
#   3. Waits for it to become ready.
#   4. Runs the frontend HttpAPI integration suite against it.
#   5. Always tears the server down (success or failure).
#
# Usage:
#   ./scripts/e2e-smoke.sh
#   PORT=9000 ./scripts/e2e-smoke.sh   # override e2e port
#
# Exits 0 on full success, non-zero on any failure.
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
[ -d "${REPO_ROOT}/frontend" ] || die "frontend/ not found at ${REPO_ROOT}"
command -v pnpm >/dev/null 2>&1 || die "pnpm not found in PATH"
command -v node >/dev/null 2>&1 || die "node not found in PATH"

# ─── Step 1: Build backend ───────────────────────────────────────────────
log "building backend…"
(
  cd "${REPO_ROOT}/backend"
  pnpm install --frozen-lockfile
  pnpm build
)
ok "backend built"

# ─── Step 2: Start e2e stub ─────────────────────────────────────────────
log "starting e2e stub on http://${HOST}:${PORT}…"
(
  cd "${REPO_ROOT}/backend"
  PORT="${PORT}" E2E_HOST="${HOST}" E2E_LOG_LEVEL=warn \
    pnpm e2e:server > "${LOG_FILE}" 2>&1 &
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

# ─── Step 4: Run frontend integration tests ─────────────────────────────
log "running frontend integration tests…"
set +e
(
  cd "${REPO_ROOT}/frontend"
  INTEGRATION_BACKEND_URL="http://${HOST}:${PORT}" pnpm test:integration
)
RC_FE=$?
set -e
if [ "${RC_FE}" -ne 0 ]; then
  warn "frontend integration tests failed (rc=${RC_FE})"
  warn "server log:"
  sed 's/^/    /' "${LOG_FILE}" >&2 || true
  exit "${RC_FE}"
fi
ok "frontend integration tests passed"

# ─── Step 4b: Run backend WS integration tests ─────────────────────────
log "running backend WebSocket integration tests…"
set +e
(
  cd "${REPO_ROOT}/backend"
  INTEGRATION_BACKEND_URL="http://${HOST}:${PORT}" pnpm test:integration -- tests/integration/ws.test.ts
)
RC_BE=$?
set -e
if [ "${RC_BE}" -ne 0 ]; then
  warn "backend WS integration tests failed (rc=${RC_BE})"
  warn "server log:"
  sed 's/^/    /' "${LOG_FILE}" >&2 || true
  exit "${RC_BE}"
fi
ok "backend WebSocket integration tests passed"

# ─── Done ───────────────────────────────────────────────────────────────
ok "e2e smoke OK  →  http://${HOST}:${PORT}"
exit 0
