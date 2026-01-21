set -euo pipefail

STARTED_SUPABASE="false"
if [ "${SUPABASE_ALREADY_RUNNING:-false}" != "true" ]; then
  pnpm supabase:start -- -x studio,migra,deno-relay,pgadmin-schema-diff,imgproxy &
  STARTED_SUPABASE="true"
fi

docker run --add-host=host.docker.internal:host-gateway --rm -it --name=stripe -d stripe/stripe-cli:latest listen --forward-to http://host.docker.internal:3000/api/stripe/webhook --skip-verify --api-key "$STRIPE_SECRET_KEY" --log-level debug

if [ "$1" = "build" ]; then
  echo "Building and testing in production mode"
  NODE_ENV=test next build
  NODE_ENV=test next start &
else
  echo "Testing in development mode"
  pnpm dev:test &
fi

pnpm cypress:headless

if [ "$STARTED_SUPABASE" = "true" ]; then
  pnpm supabase:stop -- --no-backup
fi
exit 0
