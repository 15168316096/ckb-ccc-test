#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CKB_BINARY="${CKB_BINARY:-ckb}"
CKB_RPC_URL="${CKB_RPC_URL:-http://127.0.0.1:8114}"
OFFCKB_LOG="${OFFCKB_LOG:-$ROOT_DIR/offckb-devnet.log}"

if ! command -v "$CKB_BINARY" >/dev/null 2>&1 && [ ! -x "$CKB_BINARY" ]; then
  echo "CKB binary is missing or not executable: $CKB_BINARY" >&2
  exit 1
fi

cd "$ROOT_DIR"

npx tsx ./scripts/patch-offckb-devnet.ts

npx offckb clean >/dev/null 2>&1 || true
npx offckb node --binary-path "$CKB_BINARY" >"$OFFCKB_LOG" 2>&1 &
OFFCKB_PID=$!

cleanup() {
  kill "$OFFCKB_PID" >/dev/null 2>&1 || true
  wait "$OFFCKB_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

npx tsx ./scripts/wait-rpc.ts "$CKB_RPC_URL"
npm run test:dao
