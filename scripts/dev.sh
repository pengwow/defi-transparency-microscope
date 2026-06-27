#!/usr/bin/env bash
#
# scripts/dev.sh
#
# One-shot developer launcher: spawns the FastAPI backend and the
# Vite frontend in the same terminal, colour-tags their output
# (e.g. `[backend] …` / `[frontend] …`), and tears both down
# cleanly on Ctrl+C / SIGTERM.
#
# This is the canonical way to run DTM end-to-end on a developer
# machine.  The long-running e2e stub (used by `scripts/e2e-smoke.sh`)
# is intentionally NOT what this script starts — this script always
# launches the *real* `dtm-backend` console entry point.
#
# Usage:
#   ./scripts/dev.sh
#   ./scripts/dev.sh --backend-only
#   ./scripts/dev.sh --frontend-only
#   BACKEND_PORT=9000 FRONTEND_PORT=5174 ./scripts/dev.sh
#
# Environment overrides:
#   BACKEND_PORT   default 8000
#   FRONTEND_PORT  default 5173
#   BACKEND_HOST   default 127.0.0.1
#   FRONTEND_HOST  default 127.0.0.1
#   PY             python interpreter to use (default: python3.12 / python3)
#   SKIP_PY_CHECK=1    skip the "is the backend installed?" preflight
#   SKIP_PORT_CHECK=1  skip the "is the port free?" preflight
#   KEEP_LOGS=1        keep per-service log files instead of deleting them
#
# Exit codes:
#   0  if both processes exited cleanly (rare — they normally run forever)
#   the exit code of whichever process died first, otherwise
#   130 on SIGINT, 143 on SIGTERM (matches the standard shell convention)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Defaults ────────────────────────────────────────────────────────────
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"

START_BACKEND=1
START_FRONTEND=1

# ─── Arg parsing ─────────────────────────────────────────────────────────
print_usage() {
  cat <<'USAGE'
Usage: scripts/dev.sh [--backend-only | --frontend-only]

  Spawns the FastAPI backend and the Vite frontend in the same
  terminal.  Each process has its stdout/stderr prefixed with a
  colour-coded tag so the two streams are easy to tell apart.

  --backend-only     only start the FastAPI backend
  --frontend-only    only start the Vite frontend
  -h, --help         show this help

Environment overrides: BACKEND_PORT, FRONTEND_PORT, BACKEND_HOST,
FRONTEND_HOST, PY, SKIP_PY_CHECK, SKIP_PORT_CHECK, KEEP_LOGS.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --backend-only)  START_FRONTEND=0 ;;
    --frontend-only) START_BACKEND=0 ;;
    -h|--help)       print_usage; exit 0 ;;
    *)               printf "unknown argument: %s\n" "$1" >&2; print_usage >&2; exit 2 ;;
  esac
  shift
done

if [ "${START_BACKEND}" -eq 0 ] && [ "${START_FRONTEND}" -eq 0 ]; then
  printf "refusing to start: --backend-only and --frontend-only are mutually exclusive\n" >&2
  exit 2
fi

# ─── Colour helpers (no-op when stdout is not a tty) ────────────────────
if [ -t 1 ]; then
  C_BOLD="\033[1m";  C_DIM="\033[2m"
  C_GRN="\033[32m";  C_YEL="\033[33m"; C_RED="\033[31m"; C_BLU="\033[34m"
  C_RST="\033[0m"
else
  C_BOLD="";  C_DIM=""
  C_GRN="";  C_YEL=""; C_RED=""; C_BLU=""
  C_RST=""
fi

log()  { printf "%b\n" "${C_BOLD}[dev]${C_RST} $*" >&2; }
ok()   { printf "%b\n" "${C_GRN}✓${C_RST} $*" >&2; }
warn() { printf "%b\n" "${C_YEL}!${C_RST} $*" >&2; }
die()  { printf "%b\n" "${C_RED}✗${C_RST} $*" >&2; exit 1; }

# ─── Preflight checks ───────────────────────────────────────────────────
[ -d "${REPO_ROOT}/backend" ]  || die "backend/  not found at ${REPO_ROOT}/backend"
[ -d "${REPO_ROOT}/frontend" ] || die "frontend/ not found at ${REPO_ROOT}/frontend"

command -v node >/dev/null 2>&1   || die "node not found in PATH (Vite needs it)"
command -v pnpm >/dev/null 2>&1  || die "pnpm not found in PATH (frontend uses pnpm)"

# Port-availability check (best-effort; warns but does not fail).
check_port_free() {
  local host="$1" port="$2" label="$3"
  if [ "${SKIP_PORT_CHECK:-0}" = "1" ]; then
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 - "$host" "$port" <<'PY' 2>/dev/null
import socket, sys
host, port = sys.argv[1], int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind((host, port))
except OSError:
    sys.exit(1)
finally:
    s.close()
PY
    then
      warn "${label} port ${host}:${port} is already in use — the child will likely fail to bind"
      return 1
    fi
  fi
  return 0
}

if [ "${START_BACKEND}" -eq 1 ]; then
  if [ "${SKIP_PY_CHECK:-0}" != "1" ]; then
    # Honour the user-supplied PY if it's already set and runnable.
    if [ -n "${PY:-}" ] && command -v "${PY}" >/dev/null 2>&1; then
      PY="$(command -v "${PY}")"
    else
      PY=""
      if command -v python3.12 >/dev/null 2>&1; then
        PY="$(command -v python3.12)"
      elif command -v python3 >/dev/null 2>&1; then
        PY="$(command -v python3)"
      else
        die "no python interpreter found (need >=3.12,<3.15)"
      fi
    fi
    log "using python: ${PY}"
    "${PY}" - <<'PY' || die "python ${PY} is outside the supported range (>=3.12,<3.15)"
import sys
if not (3, 12) <= sys.version_info < (3, 15):
    sys.exit(1)
PY
    if "${PY}" -c "import dtm_backend" >/dev/null 2>&1; then
      log "backend launcher: ${PY} -m dtm_backend.main"
    else
      log "backend launcher: ${PY} -m dtm_backend.main (PYTHONPATH fallback)"
    fi
  else
    PY="${PY:-python3}"
  fi
  BACKEND_CMD=("${PY}" -m dtm_backend.main)
  check_port_free "${BACKEND_HOST}" "${BACKEND_PORT}" "backend" || true
fi

if [ "${START_FRONTEND}" -eq 1 ]; then
  check_port_free "${FRONTEND_HOST}" "${FRONTEND_PORT}" "frontend" || true
fi

# ─── Banner ──────────────────────────────────────────────────────────────
log "starting DTM dev stack"
[ "${START_BACKEND}" -eq 1 ]  && log "  backend  → http://${BACKEND_HOST}:${BACKEND_PORT}"
[ "${START_FRONTEND}" -eq 1 ] && log "  frontend → http://${FRONTEND_HOST}:${FRONTEND_PORT}"
log "press Ctrl+C to stop everything"

# ─── Process plumbing ───────────────────────────────────────────────────
# Each service is launched via a subshell that uses `exec` to
# replace itself with the actual command.  This way the subshell's
# PID equals the command's PID, and the subshell is a *direct* child
# of the main script — so we can `wait` on it directly to recover
# the exit code.  The service's combined stdout/stderr is
# redirected to a per-service temp log file.
#
# A second backgrounded `tail -F | sed` pipeline tails that log to
# the terminal with a coloured line prefix, giving us real-time
# interleaved output.
#
# Cleanup uses a recursive `kill_tree` to terminate the whole
# process tree (e.g. pnpm → vite, uvicorn → worker) on shutdown.
BACKEND_PID=""
FRONTEND_PID=""
BACKEND_LOG=""
FRONTEND_LOG=""
BACKEND_TAIL_PID=""
FRONTEND_TAIL_PID=""

backend_prefix="$(printf '%b' "${C_BLU}[backend]${C_RST} ")"
frontend_prefix="$(printf '%b' "${C_GRN}[frontend]${C_RST} ")"

# Recursively kill <pid> and every descendant, then <pid> itself.
#   $1  pid
#   $2  signal (default TERM)
kill_tree() {
  local pid="$1" sig="${2:-TERM}"
  [ -n "${pid}" ] || return 0
  kill -0 "${pid}" 2>/dev/null || return 0
  # Discover every direct child of <pid>, then recurse.
  local child
  for child in $(pgrep -P "${pid}" 2>/dev/null || true); do
    kill_tree "${child}" "${sig}" || true
  done
  kill "-${sig}" "${pid}" 2>/dev/null || true
}

# Start a service.  The first three positional args are the
# bookkeeping slots; the rest is the command to exec.
#   $1  label       — for logging
#   $2  pid_var     — name of the global var to receive the PID
#   $3  logfile     — where to capture stdout+stderr
#   $4  tailpid_var — name of the global var to receive the tail PID
#   $5  prefix      — sed prefix string
#   $6..  cmd       — the command to launch
launch_service() {
  local label="$1" pid_var="$2" logfile="$3" tailpid_var="$4" prefix="$5"
  shift 5
  log "spawning ${label}…"
  # Subshell that execs into the cmd, so its PID == cmd's PID.
  ( exec "$@" > "${logfile}" 2>&1 ) &
  local cmd_pid=$!
  printf -v "${pid_var}" "%s" "${cmd_pid}"
  # Tail the log in the background, prefixing every line.
  # `stdbuf -oL` keeps the output line-buffered (no batched
  # bursts after the child writes a lot at once).
  tail -F --pid="${cmd_pid}" "${logfile}" 2>/dev/null \
    | stdbuf -oL sed "s/^/${prefix}/" &
  printf -v "${tailpid_var}" "%s" "$!"
}

# Start the service whose globals we'll write to.  We bind the
# `eval` indirection above through a tiny wrapper so the reader
# can see which globals are being set.
launch_backend() {
  local logfile
  logfile="$(mktemp -t dev-backend.XXXXXX.log)"
  BACKEND_LOG="${logfile}"
  launch_service "backend" "BACKEND_PID" "${logfile}" \
    "BACKEND_TAIL_PID" "${backend_prefix}" \
    env \
      HOST="${BACKEND_HOST}" \
      PORT="${BACKEND_PORT}" \
      PYTHONPATH="${REPO_ROOT}/backend/src${PYTHONPATH:+:${PYTHONPATH}}" \
      "${BACKEND_CMD[@]}"
}

launch_frontend() {
  local logfile
  logfile="$(mktemp -t dev-frontend.XXXXXX.log)"
  FRONTEND_LOG="${logfile}"
  launch_service "frontend" "FRONTEND_PID" "${logfile}" \
    "FRONTEND_TAIL_PID" "${frontend_prefix}" \
    pnpm --dir "${REPO_ROOT}/frontend" \
      exec vite --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" --strictPort
}

# ─── Launch ─────────────────────────────────────────────────────────────
[ "${START_BACKEND}" -eq 1 ]  && launch_backend
[ "${START_FRONTEND}" -eq 1 ] && launch_frontend

# ─── Shutdown machinery ─────────────────────────────────────────────────
shutdown() {
  if [ "${SHUTTING_DOWN:-0}" = "1" ]; then return 0; fi
  SHUTTING_DOWN=1
  # Tear down both service trees in parallel.  We don't await the
  # trees here — the wait at the end of the script will collect
  # the actual exit codes of the parent PIDs.
  kill_tree "${FRONTEND_PID}" TERM
  kill_tree "${BACKEND_PID}"  TERM
  # Grace period: up to 5s for the trees to exit cleanly.
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    local alive=0
    for pid in "${BACKEND_PID}" "${FRONTEND_PID}"; do
      [ -n "${pid}" ] || continue
      if kill -0 "${pid}" 2>/dev/null; then alive=1; break; fi
    done
    [ "${alive}" -eq 0 ] && return 0
    sleep 0.5
  done
  # Escalate.
  kill_tree "${FRONTEND_PID}" KILL
  kill_tree "${BACKEND_PID}"  KILL
}

# Stop the tail follower(s) without killing the parent script.
stop_followers() {
  for tp in "${BACKEND_TAIL_PID}" "${FRONTEND_TAIL_PID}"; do
    [ -n "${tp}" ] || continue
    kill "${tp}" 2>/dev/null || true
  done
}

on_signal() {
  local sig="$1"
  case "${sig}" in
    INT)  exit_code=130 ;;
    TERM) exit_code=143 ;;
    *)    exit_code=1 ;;
  esac
  printf "\n" >&2
  log "received ${sig}, shutting down…"
  shutdown
  stop_followers || true
  exit "${exit_code}"
}

on_exit() {
  shutdown || true
  stop_followers || true
  if [ "${KEEP_LOGS:-0}" != "1" ]; then
    for lf in "${BACKEND_LOG}" "${FRONTEND_LOG}"; do
      [ -n "${lf}" ] && rm -f "${lf}" 2>/dev/null || true
    done
  else
    [ -n "${BACKEND_LOG}" ]  && log "backend log kept at:  ${BACKEND_LOG}"
    [ -n "${FRONTEND_LOG}" ] && log "frontend log kept at: ${FRONTEND_LOG}"
  fi
}

trap 'on_signal INT'  INT
trap 'on_signal TERM' TERM
trap on_exit EXIT

# ─── Wait for the first one to die ───────────────────────────────────────
# If both are running, poll their liveness until either exits;
# propagate its exit code and tear the other one down.  If only
# one is running, just wait for it.  We deliberately avoid
# `wait -n` here because it's bash-4.3+ only and not available
# in POSIX mode — a portable `kill -0` poll is robust everywhere.
EXIT_CODE=0
if [ "${START_BACKEND}" -eq 1 ] && [ "${START_FRONTEND}" -eq 1 ]; then
  # Poll until one of the two service PIDs disappears.  The tail
  # followers and the subshell wrappers are also children of
  # this script, but we only care about the service PIDs because
  # those are the ones whose exit code we want to propagate.
  while :; do
    if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then break; fi
    if ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then break; fi
    sleep 0.2
  done
  be_alive=0; fe_alive=0
  kill -0 "${BACKEND_PID}"  2>/dev/null && be_alive=1
  kill -0 "${FRONTEND_PID}" 2>/dev/null && fe_alive=1
  if [ "${be_alive}" -eq 0 ] && [ "${fe_alive}" -eq 1 ]; then
  # Backend died on its own.  Reap it (non-blocking) to
  # recover the exit code, then tear down the frontend.
  # `set +e` is required because `wait` is a special builtin
  # under POSIX, and a non-zero return from it would otherwise
  # abort the script under `set -e` *before* we get a chance to
  # log which service died and where to find its log file.
  set +e
  wait "${BACKEND_PID}"; EXIT_CODE=$?
  set -e
  log "backend exited (code=${EXIT_CODE}) — stopping frontend"
  [ -n "${FRONTEND_LOG}" ] && log "  backend log:  ${BACKEND_LOG}"
  shutdown
elif [ "${be_alive}" -eq 1 ] && [ "${fe_alive}" -eq 0 ]; then
  # Frontend died on its own.  Same `set +e` rationale as above.
  set +e
  wait "${FRONTEND_PID}"; EXIT_CODE=$?
  set -e
  log "frontend exited (code=${EXIT_CODE}) — stopping backend"
  [ -n "${FRONTEND_LOG}" ] && log "  frontend log: ${FRONTEND_LOG}"
  shutdown
else
  # Both dead (race) — reap both for the exit code.  We also
  # log the exit codes here because the asymmetric branches
  # above don't fire in this case.
  set +e
  wait "${BACKEND_PID}";  be_exit=$?
  wait "${FRONTEND_PID}"; fe_exit=$?
  set -e
  log "both services exited: backend=${be_exit} frontend=${fe_exit}"
  [ -n "${BACKEND_LOG}" ]  && log "  backend log:  ${BACKEND_LOG}"
  [ -n "${FRONTEND_LOG}" ] && log "  frontend log: ${FRONTEND_LOG}"
  EXIT_CODE=$(( be_exit != 0 ? be_exit : fe_exit ))
fi
elif [ "${START_BACKEND}" -eq 1 ]; then
  set +e
  wait "${BACKEND_PID}"
  EXIT_CODE=$?
  set -e
elif [ "${START_FRONTEND}" -eq 1 ]; then
  set +e
  wait "${FRONTEND_PID}"
  EXIT_CODE=$?
  set -e
fi

# Tear down the other child if it's still running, then exit.
shutdown || true
stop_followers || true
exit "${EXIT_CODE}"
