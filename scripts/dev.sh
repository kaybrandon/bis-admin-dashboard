#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.dotnet:$PATH"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"

echo "Starting Admin API on :5080 and SPA on :5173"
(cd "$ROOT/src/api" && dotnet run --urls http://localhost:5080) &
API_PID=$!
(cd "$ROOT/client" && npm install && npm run dev) &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null || true' EXIT
wait
