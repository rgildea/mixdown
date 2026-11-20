#!/usr/bin/env bash
# Run the pgTAP database tests in supabase/tests/database against the local stack.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "${CLAUDE_CODE_REMOTE:-}" ]]; then export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io; fi
npx supabase test db "$@"
