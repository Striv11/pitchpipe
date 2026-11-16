#!/usr/bin/env bash
# Single quality gate used by CI and by build-lab before every push:
# format check, lint, typecheck, tests, production build.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm ci; fi
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
