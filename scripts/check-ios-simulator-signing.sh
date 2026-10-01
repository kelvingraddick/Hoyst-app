#!/bin/sh
set -eu

# Disabling Simulator signing also removes Firebase Auth's keychain entitlements.
if [ "${PLATFORM_NAME:-}" = "iphonesimulator" ] &&
   [ "${CODE_SIGNING_ALLOWED:-}" != "YES" ]; then
  echo "error: Hoyst Simulator sign-in requires signing. Remove CODE_SIGNING_ALLOWED=NO or use CODE_SIGNING_ALLOWED=YES to preserve keychain entitlements (securityd -34018)." >&2
  exit 1
fi
