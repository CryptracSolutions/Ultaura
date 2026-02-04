#!/usr/bin/env bash
set -euo pipefail

# When you open the app from a phone, `localhost` resolves to the phone itself.
# This script runs Next.js bound to the LAN and points the browser at the LAN-reachable
# Supabase URL as well.

APP_PORT="${PORT:-3000}"
SUPABASE_PORT="${SUPABASE_PORT:-54321}"

LAN_IP="${ULTAURA_DEV_IP:-}"
if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="$(ifconfig | awk '/inet / && $2 !~ /^127\\./ {print $2; exit}')"
fi

if [[ -z "${LAN_IP}" ]]; then
  echo "Could not determine a LAN IP address. Set ULTAURA_DEV_IP manually, e.g.:"
  echo "  ULTAURA_DEV_IP=192.168.0.164 pnpm dev:phone"
  exit 1
fi

export NEXT_PUBLIC_SITE_URL="http://${LAN_IP}:${APP_PORT}"
export NEXT_PUBLIC_SUPABASE_URL="http://${LAN_IP}:${SUPABASE_PORT}"

echo "Ultaura phone dev:"
echo "  App URL:      ${NEXT_PUBLIC_SITE_URL}"
echo "  Supabase URL: ${NEXT_PUBLIC_SUPABASE_URL}"
echo

exec pnpm -s dev:lan

