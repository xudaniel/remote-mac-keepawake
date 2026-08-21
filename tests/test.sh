#!/bin/bash

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly REPO_ROOT
readonly CLI="$REPO_ROOT/bin/remote-mac-keepawake"
TEST_AREA="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/remote-mac-keepawake-tests.XXXXXX")"
readonly TEST_AREA
readonly LABEL="com.xudaniel.remote-mac-keepawake"

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
  [[ ! -f "$1" ]] || fail "Expected file to be absent: $1"
}

assert_contains_text() {
  printf '%s\n' "$1" | /usr/bin/grep -Fq "$2" ||
    fail "Expected '$2' in command output"
}

assert_contains_file() {
  /usr/bin/grep -Fq "$2" "$1" || fail "Expected '$2' in $1"
}

assert_eq() {
  [[ "$1" == "$2" ]] || fail "Expected '$1' to equal '$2'"
}

assert_json() {
  printf '%s\n' "$1" | /usr/bin/python3 -c \
    'import json, sys; json.load(sys.stdin)' ||
    fail "Output is not valid JSON"
}

reset_area() {
  /bin/rm -rf "$TEST_AREA"
  /bin/mkdir -p "$TEST_AREA"
}

run_cli() {
  RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 /bin/bash "$CLI" "$@"
}

run_cli_fail_step() {
  local step="$1"
  shift
  RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
    RMKA_TEST_FAIL_STEP="$step" /bin/bash "$CLI" "$@"
}

user_plist="$TEST_AREA/user/Library/LaunchAgents/$LABEL.plist"
user_cli="$TEST_AREA/user/.local/bin/remote-mac-keepawake"
system_plist="$TEST_AREA/Library/LaunchDaemons/$LABEL.plist"
system_cli="$TEST_AREA/usr/local/bin/remote-mac-keepawake"

printf '1. Syntax, version, and help contract\n'
/bin/bash -n "$CLI" || fail "CLI has invalid shell syntax"
assert_eq "$(/bin/bash "$CLI" version)" "remote-mac-keepawake 1.1.0"
help_output="$(/bin/bash "$CLI" help)"
assert_contains_text "$help_output" "Health exit codes"
assert_contains_text "$help_output" "migrate --system --yes"

printf '2. Atomic user install, stable CLI, and healthy JSON\n'
reset_area
run_cli install --user >/dev/null || fail "User install failed"
assert_file "$user_plist"
assert_file "$user_cli"
/usr/bin/plutil -lint "$user_plist" >/dev/null || fail "User plist is invalid"
assert_contains_file "$user_plist" '<string>/usr/bin/caffeinate</string>'
assert_contains_file "$user_plist" '<string>-i</string>'
assert_eq "$(/usr/bin/stat -f '%Lp' "$user_cli")" "755"
status_output="$(run_cli status --user --json)" || fail "Healthy status failed"
assert_json "$status_output"
assert_contains_text "$status_output" '"idle_sleep_prevented":true'
health_output="$(run_cli health --user --json --network --chrome)" ||
  fail "Healthy diagnostics failed"
assert_json "$health_output"
assert_contains_text "$health_output" '"health":"healthy"'
assert_contains_text "$health_output" '"network_checked":1'
assert_contains_text "$health_output" '"chrome_checked":1'

printf '3. Idempotent reinstall and duplicate-mode protection\n'
run_cli install --user >/dev/null || fail "Idempotent user reinstall failed"
if run_cli install --system >/dev/null 2>&1; then
  fail "System install should require the migration path"
fi
assert_file "$user_plist"
assert_not_file "$system_plist"

printf '4. Fail-closed bootstrap and assertion handling\n'
reset_area
json_error="$(run_cli_fail_step install_plist install --user --json 2>&1)"
json_error_rc=$?
assert_eq "$json_error_rc" "1"
assert_json "$json_error"
assert_contains_text "$json_error" '"ok":false'
assert_not_file "$user_plist"
if run_cli_fail_step bootstrap install --user >/dev/null 2>&1; then
  fail "Bootstrap failure must fail installation"
fi
assert_not_file "$user_plist"
assert_not_file "$user_cli"
if run_cli_fail_step kickstart install --user >/dev/null 2>&1; then
  fail "Kickstart failure must fail installation"
fi
assert_not_file "$user_plist"
assert_not_file "$user_cli"
run_cli install --user >/dev/null || fail "Baseline install failed"
plist_before="$(/usr/bin/shasum -a 256 "$user_plist" | /usr/bin/awk '{print $1}')"
cli_before="$(/usr/bin/shasum -a 256 "$user_cli" | /usr/bin/awk '{print $1}')"
if run_cli_fail_step assertion install --user >/dev/null 2>&1; then
  fail "Missing assertion must fail installation"
fi
assert_eq "$(/usr/bin/shasum -a 256 "$user_plist" | /usr/bin/awk '{print $1}')" "$plist_before"
assert_eq "$(/usr/bin/shasum -a 256 "$user_cli" | /usr/bin/awk '{print $1}')" "$cli_before"
run_cli status --user --json >/dev/null || fail "Rollback did not preserve service"

printf '5. Failed unload preserves installation files\n'
if run_cli_fail_step bootout uninstall --user >/dev/null 2>&1; then
  fail "Failed bootout must cancel uninstall"
fi
assert_file "$user_plist"
assert_file "$user_cli"

printf '6. Verified user-to-system migration\n'
run_cli migrate --system --yes >/dev/null || fail "Migration failed"
assert_not_file "$user_plist"
assert_not_file "$user_cli"
assert_file "$system_plist"
assert_file "$system_cli"
/usr/bin/plutil -lint "$system_plist" >/dev/null || fail "System plist is invalid"
run_cli status --system --json >/dev/null || fail "System service is not healthy"
recovery_output="$(run_cli recovery-check --system --json)" ||
  fail "Reboot recovery check failed"
assert_json "$recovery_output"
assert_contains_text "$recovery_output" '"launch_domain":"system"'

printf '7. Health degradation, unavailability, and opt-in privacy\n'
default_health="$(run_cli health --system --json)" || fail "Default health failed"
assert_json "$default_health"
assert_contains_text "$default_health" '"network_checked":0'
assert_contains_text "$default_health" '"network_available":null'
degraded_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_CHROME_RUNNING=false /bin/bash "$CLI" health --system --json --chrome)"
degraded_rc=$?
assert_eq "$degraded_rc" "2"
assert_contains_text "$degraded_output" '"health":"degraded"'
offline_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_NETWORK_AVAILABLE=false /bin/bash "$CLI" health --system --json --network)"
offline_rc=$?
assert_eq "$offline_rc" "2"
assert_contains_text "$offline_output" '"network_available":false'
malformed_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_LID_CLOSED=malformed /bin/bash "$CLI" health --system --json)" ||
  fail "Malformed sensor output should be normalized"
assert_json "$malformed_output"
assert_contains_text "$malformed_output" '"lid_closed":null'
unavailable_output="$(run_cli_fail_step assertion health --system --json)"
unavailable_rc=$?
assert_eq "$unavailable_rc" "1"
assert_contains_text "$unavailable_output" '"health":"unavailable"'
if run_cli health --system --webhook http://example.com >/dev/null 2>&1; then
  fail "Non-HTTPS webhook must be rejected"
fi

printf '8. Bounded watch mode and self-test\n'
watch_output="$(run_cli health --system --json --watch --interval 1)" ||
  fail "Dry-run watch failed"
assert_json "$watch_output"
watch_log="$TEST_AREA/var/log/RemoteMacKeepAwake/health-watch.jsonl"
assert_file "$watch_log"
assert_eq "$(/usr/bin/wc -l < "$watch_log" | /usr/bin/tr -d ' ')" "1"
run_cli health --system --watch --notify --interval 1 >/dev/null ||
  fail "Opt-in local notification mode failed"
run_cli self-test --system >/dev/null || fail "Self-test failed"

printf '9. Atomic local upgrade and rollback\n'
cli_hash="$(/usr/bin/shasum -a 256 "$system_cli" | /usr/bin/awk '{print $1}')"
if run_cli_fail_step upgrade_copy upgrade --system --from "$CLI" >/dev/null 2>&1; then
  fail "Injected upgrade failure must be reported"
fi
assert_eq "$(/usr/bin/shasum -a 256 "$system_cli" | /usr/bin/awk '{print $1}')" "$cli_hash"
run_cli upgrade --system --from "$CLI" >/dev/null || fail "Verified upgrade failed"
assert_eq "$("$system_cli" version)" "remote-mac-keepawake 1.1.0"

printf '10. Clean uninstall preserves explicit mode isolation\n'
run_cli uninstall --system >/dev/null || fail "System uninstall failed"
assert_not_file "$system_plist"
assert_not_file "$system_cli"

printf 'PASS: all reliability and operations tests completed successfully\n'
