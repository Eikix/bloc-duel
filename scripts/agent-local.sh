#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

world_address="${BLOCDUEL_AGENT_WORLD_ADDRESS:-}"
if [ -z "$world_address" ]; then
  if [ ! -f .data/world_address.txt ]; then
    echo "Missing .data/world_address.txt. Start the local stack or set BLOCDUEL_AGENT_WORLD_ADDRESS." >&2
    exit 1
  fi
  world_address="$(cat .data/world_address.txt)"
fi

rpc_url="${BLOCDUEL_AGENT_RPC_URL:-http://127.0.0.1:5050}"
torii_url="${BLOCDUEL_AGENT_TORII_URL:-http://127.0.0.1:8080}"

npm run agent:cli -- \
  --rpc-url "$rpc_url" \
  --torii-url "$torii_url" \
  --world-address "$world_address" \
  "$@"
