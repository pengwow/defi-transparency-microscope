#!/usr/bin/env bash
#
# scripts/e2e-smoke.sh
#
# One-shot end-to-end smoke test (Python backend):
#   1. Installs the Python backend in editable mode.
#   2. Boots the offline e2e stub server on a free port.
#   3. Waits for /api/v1/health to become reachable.
#   4. Verifies the wire shape of every Phase 1 + Phase 2 endpoint:
#        - GET /api/v1/health
#        - GET /api/v1/pools
#        - GET /api/v1/transactions
#        - GET /api/v1/lending-positions
#        - GET /api/v1/lp-positions
#   5. Verifies the wire shape of every Phase 3 experiment endpoint:
#        - GET  /api/v1/experiments
#        - GET  /api/v1/experiments/{id}
#        - POST /api/v1/experiments/sandwich
#        - POST /api/v1/experiments/il
#        - POST /api/v1/experiments/attribution
#   6. Verifies CORS headers on /api/v1/health.
#   7. Always tears the server down (success or failure).
#
# Usage:
#   ./scripts/e2e-smoke.sh
#   PORT=9000 ./scripts/e2e-smoke.sh   # override e2e port
#
# Exits 0 on full success, non-zero on any failure.
#
# Note: the frontend HttpAPI integration suite is wired in once the
# chain layer and experiments land (Phase 2 / Phase 3).  This script
# only verifies the backend skeleton is reachable end-to-end and
# returns the expected wire shapes for every documented route.
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

# ─── Step 5: Verify /api/v1/pools wire shape ───────────────────────────
log "verifying /api/v1/pools wire shape…"
POOLS_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/pools")"
log "  → $(printf '%s' "${POOLS_BODY}" | head -c 120)…"
# The offline stub returns 3 pools (1 V2 + 2 V3) per the canned fetcher.
if ! printf '%s' "${POOLS_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body, list), f'expected list, got {type(body).__name__}'
assert len(body) == 3, f'expected 3 pools, got {len(body)}'
v2 = [p for p in body if p.get('protocol') == 'uniswap_v2']
v3 = [p for p in body if p.get('protocol') == 'uniswap_v3']
assert len(v2) == 1, f'expected 1 V2 pool, got {len(v2)}'
assert len(v3) == 2, f'expected 2 V3 pools, got {len(v3)}'
# V3 entries carry camelCase sqrtPriceX96 as a decimal string.
for p in v3:
    assert isinstance(p.get('sqrtPriceX96'), str), 'sqrtPriceX96 must be a string'
    assert p['sqrtPriceX96'].isdigit(), 'sqrtPriceX96 must be a decimal string'
    assert isinstance(p.get('feeTier'), int), 'feeTier must be an int'
print('pools ok')
"; then
  warn "got: ${POOLS_BODY}"
  die "/api/v1/pools did not return the expected wire shape"
fi
ok "/api/v1/pools shape OK"

# ─── Step 6: Verify /api/v1/transactions wire shape ────────────────────
log "verifying /api/v1/transactions wire shape…"
TXS_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/transactions")"
log "  → $(printf '%s' "${TXS_BODY}" | head -c 120)…"
if ! printf '%s' "${TXS_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body, list), f'expected list, got {type(body).__name__}'
assert len(body) >= 1, f'expected at least 1 tx, got {len(body)}'
# BackendTx wire-format keys.
REQUIRED = {'hash', 'from', 'to', 'value', 'gasPrice', 'gasLimit', 'input', 'nonce', 'timestamp', 'type'}
for tx in body:
    missing = REQUIRED - set(tx.keys())
    assert not missing, f'tx missing keys: {missing}'
    # BigInts round-trip as decimal strings.
    assert isinstance(tx['value'], str) and tx['value'].isdigit(), 'value must be a decimal string'
    assert isinstance(tx['gasPrice'], str) and tx['gasPrice'].isdigit(), 'gasPrice must be a decimal string'
    assert isinstance(tx['gasLimit'], str) and tx['gasLimit'].isdigit(), 'gasLimit must be a decimal string'
print('transactions ok')
"; then
  warn "got: ${TXS_BODY}"
  die "/api/v1/transactions did not return the expected wire shape"
fi
ok "/api/v1/transactions shape OK"

# ─── Step 7: Verify /api/v1/lending-positions wire shape ───────────────
log "verifying /api/v1/lending-positions wire shape…"
LEND_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/lending-positions")"
log "  → $(printf '%s' "${LEND_BODY}" | head -c 120)…"
if ! printf '%s' "${LEND_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body, list), f'expected list, got {type(body).__name__}'
assert len(body) == 1, f'expected exactly 1 position, got {len(body)}'
pos = body[0]
assert pos.get('protocol') == 'aave_v3', f'expected aave_v3, got {pos.get(\"protocol\")}'
assert isinstance(pos.get('collateral'), dict), 'collateral must be a dict'
assert isinstance(pos.get('debt'), dict), 'debt must be a dict'
assert isinstance(pos.get('healthFactor'), (int, float)), 'healthFactor must be a number'
assert isinstance(pos.get('liquidationThresholdE18'), str), 'liquidationThresholdE18 must be a decimal string'
assert pos['liquidationThresholdE18'].isdigit(), 'liquidationThresholdE18 must be a decimal string'
print('lending ok')
"; then
  warn "got: ${LEND_BODY}"
  die "/api/v1/lending-positions did not return the expected wire shape"
fi
ok "/api/v1/lending-positions shape OK"

# ─── Step 8: Verify /api/v1/lp-positions wire shape ───────────────────
log "verifying /api/v1/lp-positions wire shape…"
LP_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/lp-positions")"
log "  → $(printf '%s' "${LP_BODY}" | head -c 120)…"
if ! printf '%s' "${LP_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body, list), f'expected list, got {type(body).__name__}'
assert len(body) == 1, f'expected exactly 1 lp position, got {len(body)}'
pos = body[0]
assert pos.get('protocol') == 'uniswap_v3', f'expected uniswap_v3, got {pos.get(\"protocol\")}'
assert pos.get('status') == 'active', f'expected status=active, got {pos.get(\"status\")}'
assert isinstance(pos.get('poolId'), str), 'poolId must be a string'
assert isinstance(pos.get('token0'), dict), 'token0 must be a dict'
assert isinstance(pos.get('token1'), dict), 'token1 must be a dict'
assert isinstance(pos.get('tickLower'), int), 'tickLower must be an int'
assert isinstance(pos.get('tickUpper'), int), 'tickUpper must be an int'
assert isinstance(pos.get('feeTier'), int), 'feeTier must be an int'
# BigInts round-trip as decimal strings.
for field in ('amount0', 'amount1', 'feeIncomeE18', 'impermanentLossE18', 'netPnlE18'):
    assert isinstance(pos.get(field), str) and pos[field].isdigit(), f'{field} must be a decimal string'
print('lp ok')
"; then
  warn "got: ${LP_BODY}"
  die "/api/v1/lp-positions did not return the expected wire shape"
fi
ok "/api/v1/lp-positions shape OK"

# ─── Step 9: Verify /api/v1/experiments wire shape ───────────────────
log "verifying /api/v1/experiments wire shape…"
EXPERIMENTS_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/experiments")"
log "  → $(printf '%s' "${EXPERIMENTS_BODY}" | head -c 120)…"
if ! printf '%s' "${EXPERIMENTS_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body, list), f'expected list, got {type(body).__name__}'
assert len(body) == 4, f'expected 4 presets, got {len(body)}'
for p in body:
    assert isinstance(p.get('id'), str) and p['id'], 'id must be a non-empty string'
    assert isinstance(p.get('name'), str) and p['name'], 'name must be a non-empty string'
    cfg = p.get('config', {})
    assert cfg.get('protocol') in ('uniswap_v2', 'uniswap_v3'), 'protocol must be v2 or v3'
    assert isinstance(cfg.get('reserve0'), str) and cfg['reserve0'].isdigit(), 'reserve0 must be a decimal string'
    assert isinstance(cfg.get('reserve1'), str) and cfg['reserve1'].isdigit(), 'reserve1 must be a decimal string'
    assert isinstance(cfg.get('fee'), int), 'fee must be an int'
    assert isinstance(cfg.get('runs'), int), 'runs must be an int'
print('experiments ok')
"; then
  warn "got: ${EXPERIMENTS_BODY}"
  die "/api/v1/experiments did not return the expected wire shape"
fi
ok "/api/v1/experiments shape OK"

# ─── Step 10: Verify /api/v1/experiments/{id} lookup + 404 ───────────
log "verifying /api/v1/experiments/{id}…"
EXPERIMENT_BODY="$(curl -fsS -m 2 "http://${HOST}:${PORT}/api/v1/experiments/sandwich-v2-usdc-weth")"
if [ "$(printf '%s' "${EXPERIMENT_BODY}" | "${PY}" -c 'import json,sys;print(json.load(sys.stdin)["id"])')" != "sandwich-v2-usdc-weth" ]; then
  warn "got: ${EXPERIMENT_BODY}"
  die "/api/v1/experiments/{id} did not return the expected id"
fi
EXPERIMENT_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -m 2 "http://${HOST}:${PORT}/api/v1/experiments/does-not-exist")"
if [ "${EXPERIMENT_STATUS}" != "404" ]; then
  die "expected 404 for unknown experiment id, got ${EXPERIMENT_STATUS}"
fi
ok "/api/v1/experiments/{id} OK (404 on unknown)"

# ─── Step 11: Verify /api/v1/experiments/sandwich ────────────────────
log "verifying /api/v1/experiments/sandwich…"
SANDWICH_BODY="$(curl -fsS -m 2 -X POST -H 'Content-Type: application/json' \
  -d "{\"reserve0\":\"$((80 * 10**18))\",\"reserve1\":\"$((160 * 10**24))\",\"victimAmountIn\":\"$((1 * 10**18))\",\"attackerAmountIn\":\"$((1 * 10**17))\",\"fee\":3000}" \
  "http://${HOST}:${PORT}/api/v1/experiments/sandwich")"
log "  → $(printf '%s' "${SANDWICH_BODY}" | head -c 120)…"
if ! printf '%s' "${SANDWICH_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body.get('durationMs'), int), 'durationMs must be an int'
assert body['durationMs'] >= 0, 'durationMs must be non-negative'
res = body.get('result', {})
assert isinstance(res.get('attackerProfit'), str), 'attackerProfit must be a string'
assert isinstance(res.get('victimLoss'), str), 'victimLoss must be a string'
assert res['attackerProfit'].lstrip('-').isdigit(), 'attackerProfit must be a decimal string'
assert res['victimLoss'].lstrip('-').isdigit(), 'victimLoss must be a decimal string'
print('sandwich ok')
"; then
  warn "got: ${SANDWICH_BODY}"
  die "/api/v1/experiments/sandwich did not return the expected wire shape"
fi
ok "/api/v1/experiments/sandwich OK"

# ─── Step 12: Verify /api/v1/experiments/il ──────────────────────────
log "verifying /api/v1/experiments/il…"
IL_BODY="$(curl -fsS -m 2 -X POST -H 'Content-Type: application/json' \
  -d '{"priceRatio":2.0,"variant":"v2"}' \
  "http://${HOST}:${PORT}/api/v1/experiments/il")"
log "  → $(printf '%s' "${IL_BODY}" | head -c 120)…"
if ! printf '%s' "${IL_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body.get('durationMs'), int), 'durationMs must be an int'
res = body.get('result', {})
assert res.get('variant') == 'v2', f'expected variant=v2, got {res.get(\"variant\")}'
assert abs(res.get('il', 0) - (-0.0572)) < 1e-3, f'expected il≈-0.0572, got {res.get(\"il\")}'
assert res.get('priceRatio') == 2.0, 'priceRatio must echo the input'
print('il ok')
"; then
  warn "got: ${IL_BODY}"
  die "/api/v1/experiments/il did not return the expected wire shape"
fi
ok "/api/v1/experiments/il OK"

# ─── Step 13: Verify /api/v1/experiments/attribution ─────────────────
log "verifying /api/v1/experiments/attribution…"
ATTRIB_BODY="$(curl -fsS -m 2 -X POST -H 'Content-Type: application/json' \
  -d "{\"reserve0\":\"$((80 * 10**18))\",\"reserve1\":\"$((160 * 10**24))\",\"amountIn\":\"$((1 * 10**18))\",\"fee\":3000,\"priceRatio\":1.5,\"fees\":\"$((1 * 10**18))\",\"rebates\":\"$((5 * 10**17))\"}" \
  "http://${HOST}:${PORT}/api/v1/experiments/attribution")"
log "  → $(printf '%s' "${ATTRIB_BODY}" | head -c 120)…"
if ! printf '%s' "${ATTRIB_BODY}" | "${PY}" -c "
import json, sys
body = json.load(sys.stdin)
assert isinstance(body.get('durationMs'), int), 'durationMs must be an int'
res = body.get('result', {})
assert isinstance(res.get('netPnl'), str), 'netPnl must be a string'
assert res['netPnl'].lstrip('-').isdigit(), 'netPnl must be a decimal string'
print('attribution ok')
"; then
  warn "got: ${ATTRIB_BODY}"
  die "/api/v1/experiments/attribution did not return the expected wire shape"
fi
ok "/api/v1/experiments/attribution OK"

# ─── Step 14: Verify CORS preflight ─────────────────────────────────
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

# ─── Step 15: Verify /ws handshake + welcome + subscribe ────────────
# Phase 4 adds the WebSocket hub.  We boot a tiny in-process WS
# client (the same library the frontend ships) and verify the
# wire format the frontend `WsClient` consumes: the very first
# envelope must be `{ "type": "welcome" }`, and a `subscribe`
# action must yield a `subscribed` ack with the same topic list.
log "verifying /ws wire format…"
if ! "${PY}" -c "
import asyncio, json, sys
import websockets

async def main() -> int:
    url = 'ws://${HOST}:${PORT}/ws'
    async with websockets.connect(url, origin='http://localhost:5173') as ws:
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
        if first != {'type': 'welcome'}:
            print(f'expected welcome, got {first}', file=sys.stderr)
            return 1
        await ws.send(json.dumps({'action': 'subscribe', 'topics': ['mempool']}))
        reply = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
        if reply != {'type': 'subscribed', 'topics': ['mempool']}:
            print(f'expected subscribed, got {reply}', file=sys.stderr)
            return 1
        await ws.send('not json')
        err = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
        if err.get('type') != 'error':
            print(f'expected error, got {err}', file=sys.stderr)
            return 1
    return 0

sys.exit(asyncio.run(main()))
"; then
  die "/ws endpoint did not return the expected wire format"
fi
ok "/ws welcome + subscribe + error envelopes OK"

# ─── Done ───────────────────────────────────────────────────────────────
ok "e2e smoke OK  →  http://${HOST}:${PORT}"
exit 0
