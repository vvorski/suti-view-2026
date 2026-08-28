#!/usr/bin/env bash
#
# Build and push to Cloudflare Pages.
#
# Deliberately a script rather than a raw wrangler invocation in package.json:
# the build must succeed before anything is uploaded, and `wrangler pages
# deploy` will happily publish a stale dist/ if the build failed and nothing
# stopped it.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_NAME="${CF_PAGES_PROJECT:-suti-view-2026}"
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "==> Building"
pnpm build

echo "==> Deploying to Cloudflare Pages project '${PROJECT_NAME}' (branch: ${BRANCH})"
pnpm exec wrangler pages deploy dist \
  --project-name "${PROJECT_NAME}" \
  --branch "${BRANCH}" \
  --commit-dirty=true
