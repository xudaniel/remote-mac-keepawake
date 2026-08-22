#!/bin/bash

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly REPO_ROOT
readonly CLI="$REPO_ROOT/bin/remote-mac-keepawake"
readonly HEARTBEAT="$REPO_ROOT/bin/remote-mac-heartbeat"
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
assert_eq "$(/bin/bash "$CLI" version)" "remote-mac-keepawake 1.4.0"
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
assert_contains_text "$default_health" '"battery_condition":"normal"'
assert_contains_text "$default_health" '"battery_cycle_count":120'
assert_contains_text "$default_health" '"battery_health_percent":90.0'
assert_contains_text "$default_health" '"thermal_state":"nominal"'
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
low_battery_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_BATTERY_PERCENT=19 RMKA_TEST_CHARGING=false \
  /bin/bash "$CLI" health --system --json)"
low_battery_rc=$?
assert_eq "$low_battery_rc" "2"
assert_contains_text "$low_battery_output" '"battery_percent":19'
assert_contains_text "$low_battery_output" '"charging":false'
assert_contains_text "$low_battery_output" '"health":"degraded"'
invalid_battery_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_BATTERY_PERCENT=invalid RMKA_TEST_CHARGING=invalid \
  /bin/bash "$CLI" health --system --json)" ||
  fail "Malformed battery output should be normalized"
assert_json "$invalid_battery_output"
assert_contains_text "$invalid_battery_output" '"battery_percent":null'
assert_contains_text "$invalid_battery_output" '"charging":null'
hardware_warning_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_BATTERY_CONDITION=service-recommended RMKA_TEST_THERMAL_STATE=serious \
  /bin/bash "$CLI" health --system --json)"
hardware_warning_rc=$?
assert_eq "$hardware_warning_rc" "2"
assert_contains_text "$hardware_warning_output" '"battery_condition":"service-recommended"'
assert_contains_text "$hardware_warning_output" '"thermal_state":"serious"'
malformed_hardware_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_BATTERY_CYCLE_COUNT=bad RMKA_TEST_BATTERY_HEALTH_PERCENT=bad \
  RMKA_TEST_THERMAL_STATE=bad /bin/bash "$CLI" health --system --json)" ||
  fail "Malformed hardware metrics should be normalized"
assert_contains_text "$malformed_hardware_output" '"battery_cycle_count":null'
assert_contains_text "$malformed_hardware_output" '"battery_health_percent":null'
assert_contains_text "$malformed_hardware_output" '"thermal_state":"unknown"'
malformed_decimal_output="$(RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_TEST_BATTERY_HEALTH_PERCENT='1..2' /bin/bash "$CLI" health --system --json)" ||
  fail "Malformed decimal battery health should be normalized"
assert_json "$malformed_decimal_output"
assert_contains_text "$malformed_decimal_output" '"battery_health_percent":null'
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
assert_eq "$("$system_cli" version)" "remote-mac-keepawake 1.4.0"

release_fixture="$TEST_AREA/release-fixture"
release_package="remote-mac-keepawake-v1.4.0"
/bin/mkdir -p "$release_fixture/$release_package/bin"
/usr/bin/install -m 0755 "$CLI" "$release_fixture/$release_package/bin/remote-mac-keepawake"
/usr/bin/install -m 0755 "$HEARTBEAT" "$release_fixture/$release_package/bin/remote-mac-heartbeat"
/usr/bin/tar -czf "$release_fixture/$release_package.tar.gz" -C "$release_fixture" "$release_package"
(
  cd "$release_fixture" || exit 1
  /usr/bin/shasum -a 256 "$release_package.tar.gz" > SHA256SUMS
) || fail "Could not prepare release checksum fixture"
cat > "$release_fixture/curl" <<'EOF'
#!/bin/bash
output=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output="$2"; shift ;;
    http*) url="$1" ;;
  esac
  shift
done
if [[ "$url" == */releases/latest ]]; then
  printf '%s\n' 'https://releases.example/releases/tag/v1.4.0'
elif [[ "$url" == */SHA256SUMS ]]; then
  if [[ -e "${RMKA_RELEASE_FIXTURE:?}/tamper" ]]; then
    printf '%064d  remote-mac-keepawake-v1.4.0.tar.gz\n' 0 > "$output"
  else
    /bin/cp "$RMKA_RELEASE_FIXTURE/SHA256SUMS" "$output"
  fi
elif [[ "$url" == */remote-mac-keepawake-v1.4.0.tar.gz ]]; then
  /bin/cp "$RMKA_RELEASE_FIXTURE/remote-mac-keepawake-v1.4.0.tar.gz" "$output"
else
  exit 22
fi
EOF
/bin/chmod 0755 "$release_fixture/curl"
installed_reporter="$TEST_AREA/user/.local/bin/remote-mac-heartbeat"
/usr/bin/install -m 0755 "$HEARTBEAT" "$installed_reporter"
/usr/bin/sed -i '' 's/readonly VERSION="1.4.0"/readonly VERSION="1.3.0"/' "$installed_reporter"
RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_RELEASE_BASE_URL=https://releases.example \
  RMKA_RELEASE_FIXTURE="$release_fixture" RMKA_CURL_BIN="$release_fixture/curl" \
  /bin/bash "$CLI" upgrade --system --release latest >/dev/null ||
  fail "Verified release upgrade failed"
assert_eq "$("$installed_reporter" version)" "remote-mac-heartbeat 1.4.0"
cli_hash="$(/usr/bin/shasum -a 256 "$system_cli" | /usr/bin/awk '{print $1}')"
reporter_hash="$(/usr/bin/shasum -a 256 "$installed_reporter" | /usr/bin/awk '{print $1}')"
if RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 RMKA_TEST_FAIL_STEP=upgrade_reporter_copy \
  RMKA_RELEASE_BASE_URL=https://releases.example \
  RMKA_RELEASE_FIXTURE="$release_fixture" RMKA_CURL_BIN="$release_fixture/curl" \
  /bin/bash "$CLI" upgrade --system --release latest >/dev/null 2>&1; then
  fail "Interrupted dual-CLI release upgrade was reported as successful"
fi
assert_eq "$(/usr/bin/shasum -a 256 "$system_cli" | /usr/bin/awk '{print $1}')" "$cli_hash"
assert_eq "$(/usr/bin/shasum -a 256 "$installed_reporter" | /usr/bin/awk '{print $1}')" "$reporter_hash"
printf 'tamper\n' > "$release_fixture/tamper"
cli_hash="$(/usr/bin/shasum -a 256 "$system_cli" | /usr/bin/awk '{print $1}')"
if RMKA_TEST_ROOT="$TEST_AREA" RMKA_DRY_RUN=1 \
  RMKA_RELEASE_BASE_URL=https://releases.example \
  RMKA_RELEASE_FIXTURE="$release_fixture" RMKA_CURL_BIN="$release_fixture/curl" \
  /bin/bash "$CLI" upgrade --system --release v1.4.0 >/dev/null 2>&1; then
  fail "Tampered release checksum was accepted"
fi
assert_eq "$(/usr/bin/shasum -a 256 "$system_cli" | /usr/bin/awk '{print $1}')" "$cli_hash"
downgrade_source="$TEST_AREA/remote-mac-keepawake-1.3.0"
/bin/cp "$CLI" "$downgrade_source"
/usr/bin/sed -i '' 's/readonly VERSION="1.4.0"/readonly VERSION="1.3.0"/' "$downgrade_source"
if run_cli upgrade --system --from "$downgrade_source" >/dev/null 2>&1; then
  fail "Unsupported downgrade was accepted without --allow-downgrade"
fi

printf '10. Clean uninstall preserves explicit mode isolation\n'
run_cli uninstall --system >/dev/null || fail "System uninstall failed"
assert_not_file "$system_plist"
assert_not_file "$system_cli"

printf 'PASS: all reliability and operations tests completed successfully\n'
