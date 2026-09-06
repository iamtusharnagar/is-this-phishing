#!/usr/bin/env bash
# Lints only the actual extension payload -- not node_modules, not the test
# suite. Linting the whole repo directly produces false positives from
# dev dependencies (a real one encountered during development: addons-linter
# flagged a coinminer-usage pattern inside an unrelated transitive
# dependency's minified code, nothing to do with this extension at all).
set -euo pipefail

cd "$(dirname "$0")/.."

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

cp manifest.json site-detector.js page-signals.js content.js background.js "$STAGING_DIR"/
cp -r popup icons "$STAGING_DIR"/

npx addons-linter "$STAGING_DIR"
