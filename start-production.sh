#!/bin/bash
# artifacts-builder production server
# Port: 4103 (Obsidian port allocation)
# Serves as API backend for Vercel via Cloudflare Tunnel

set -euo pipefail

# launchd PATH is /usr/bin:/bin only — source env
if [ -f /Users/yen/scripts/scheduled/_env.sh ]; then
  source /Users/yen/scripts/scheduled/_env.sh
fi

cd /Users/yen/artifacts-builder

# Load production env (no set -a, only export needed vars)
if [ -f .env.production ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    export "$key=$value"
  done < .env.production
fi

export PORT=4103
export NODE_ENV=production

# Build if .next doesn't exist
if [ ! -d .next ]; then
  /opt/homebrew/bin/pnpm build
fi

exec /opt/homebrew/bin/pnpm start -p "$PORT"
