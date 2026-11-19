#!/usr/bin/env bash
# Start the local Supabase stack (Postgres, Auth, REST, Realtime, Mailpit), then seed dev users.
# Works on a Mac (Docker Desktop/OrbStack running) and in Claude Code cloud sessions (Linux,
# where we start dockerd ourselves and pull images from Docker Hub).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname)" == "Linux" && "$(id -u)" == "0" ]] && command -v dockerd >/dev/null; then
    echo "Starting dockerd…"
    nohup dockerd >/tmp/dockerd.log 2>&1 &
    for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
  fi
  docker info >/dev/null 2>&1 || { echo "Docker isn't running. Start OrbStack or Docker Desktop." >&2; exit 1; }
fi

# Cloud sessions: the default registry (public.ecr.aws) rejects shared proxy IPs.
if [[ -n "${CLAUDE_CODE_REMOTE:-}" ]]; then export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io; fi

# Audio lives in R2 (ADR 0002), so skip Storage and other services we don't use.
# Extra args are passed through, e.g. `npm run db:start -- --debug`.
start() { npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta "$@"; }

if [[ -n "${CLAUDE_CODE_REMOTE:-}" ]]; then
  # Cloud sessions only: after a worker restart, old containers come back with the Docker daemon
  # and can still be booting when the CLI checks them, so retry a couple of times.
  for attempt in 1 2 3; do
    start "$@" && break
    [[ $attempt == 3 ]] && exit 1
    echo "Stack not ready yet, retrying in 5s…"; sleep 5
  done
else
  # Locally, a failure is a real error: stop and show it rather than loop.
  start "$@"
fi
node scripts/dev-seed-users.mjs
echo
echo "App env (apps/web/.env.local): NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=\$(npx supabase status -o json | jq -r .ANON_KEY)"
echo "Mailpit (catches all email): http://127.0.0.1:54324"
