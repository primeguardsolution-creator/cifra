#!/bin/sh
# Builds the PWA and stamps it with a build id, so the app can tell when a newer deploy is live (UpdateBanner).
set -e
BUILD_ID="${EXPO_PUBLIC_BUILD_ID:-$(date +%s)}"
export EXPO_PUBLIC_BUILD_ID="$BUILD_ID"
npx expo export --platform web
node scripts/inject-head.mjs dist/index.html
printf '{"build":"%s","builtAt":"%s"}\n' "$BUILD_ID" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > dist/version.json
echo "build $BUILD_ID"
