#!/bin/bash

set -u

readonly REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly CLI="$REPO_ROOT/bin/remote-mac-keepawake"
readonly TEST_AREA="$(mktemp -d "${TMPDIR:-/tmp}/remote-mac-keepawake-tests.XXXXXX")"

cleanup() {
  /bin/rm -rf "$TEST_AREA"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_file() {
  [[ -f "$1" ]] || fail "Expected file: $1"
}

assert_not_file() {
  [[ ! -f "$1" ]] || fail "Expected file to be removed: $1"
}

assert_contains() {
  /usr/bin/grep -Fq "$2" "$1" || fail "Expected '$2' in $1"
}

printf '1. Shell syntax\n'
/bin/bash -n "$CLI" || fail "CLI has invalid shell syntax"

printf '2. User-mode installation\n'
RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 /bin/bash "$CLI" install --user >/dev/null || \
  fail "User-mode dry-run install failed"
user_plist="$TEST_AREA/user/Library/LaunchAgents/com.xudaniel.remote-mac-keepawake.plist"
assert_file "$user_plist"
/usr/bin/plutil -lint "$user_plist" >/dev/null || fail "User plist is invalid"
assert_contains "$user_plist" '<string>/usr/bin/caffeinate</string>'
assert_contains "$user_plist" '<string>-i</string>'
assert_contains "$user_plist" '<key>KeepAlive</key>'

printf '3. Duplicate-mode protection\n'
if RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 /bin/bash "$CLI" install --system >/dev/null 2>&1; then
  fail "System installation should be rejected while user mode exists"
fi

printf '4. User-mode uninstallation\n'
RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 /bin/bash "$CLI" uninstall --user >/dev/null || \
  fail "User-mode dry-run uninstall failed"
assert_not_file "$user_plist"

printf '5. System-mode installation\n'
RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 /bin/bash "$CLI" install --system >/dev/null || \
  fail "System-mode dry-run install failed"
system_plist="$TEST_AREA/Library/LaunchDaemons/com.xudaniel.remote-mac-keepawake.plist"
assert_file "$system_plist"
/usr/bin/plutil -lint "$system_plist" >/dev/null || fail "System plist is invalid"
assert_contains "$system_plist" '<string>/usr/bin/caffeinate</string>'

printf '6. System-mode uninstallation\n'
RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 /bin/bash "$CLI" uninstall --system >/dev/null || \
  fail "System-mode dry-run uninstall failed"
assert_not_file "$system_plist"

printf 'PASS: all tests completed successfully\n'
