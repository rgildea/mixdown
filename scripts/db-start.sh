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
# Containers left over from a restarted Docker daemon come back on their own, but can still be
# booting when the CLI checks, so retry a few times.
for attempt in 1 2 3 4 5; do
  npx supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta && break
  [[ $attempt == 5 ]] && exit 1
  echo "Stack not ready yet, retrying in 5s…"; sleep 5
done
node scripts/dev-seed-users.mjs
echo
echo "App env (apps/web/.env.local): NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=\$(npx supabase status -o json | jq -r .ANON_KEY)"
echo "Mailpit (catches all email): http://127.0.0.1:54324"
