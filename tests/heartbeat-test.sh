#!/bin/bash

set -u
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_AREA="$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/rmka-heartbeat.XXXXXX")"
trap '/bin/rm -rf "$TEST_AREA"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_file() { [[ -f "$1" ]] || fail "Missing file: $1"; }
assert_mode() { [[ "$(/usr/bin/stat -f '%Lp' "$1")" == "$2" ]] || fail "Wrong mode for $1"; }

/bin/mkdir -p "$TEST_AREA/bin"
cat > "$TEST_AREA/bin/health" <<'EOF'
#!/bin/bash
printf '%s\n' "$*" > "${RMKA_HEALTH_ARGS_LOG:?}"
printf '%s\n' '{"timestamp":"2026-08-21T03:27:03Z","version":"1.2.0","health":"healthy","mode":"user","installed":true,"service_state":"running","pid":14656,"idle_sleep_prevented":true,"power_source":"AC Power","battery_percent":59,"charging":true,"lid_closed":false,"network_checked":1,"network_available":true,"chrome_checked":0,"chrome_running":null}'
EOF
cat > "$TEST_AREA/bin/curl" <<EOF
#!/bin/bash
printf '%s\n' "\$*" > "$TEST_AREA/curl-args"
EOF
cat > "$TEST_AREA/bin/networkQuality" <<'EOF'
#!/bin/bash
printf 'called\n' >> "${RMKA_SPEED_CALLS_LOG:?}"
[[ "$*" == *"-c"* && "$*" == *"-M 20"* ]] || exit 64
printf '%s\n' '{"dl_throughput":34165724,"ul_throughput":53158616,"base_rtt":25.3589,"responsiveness":195.1129}'
EOF
/bin/chmod 0755 "$TEST_AREA/bin/health" "$TEST_AREA/bin/curl" "$TEST_AREA/bin/networkQuality"

if printf 'test-secret\n' | RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
  "$ROOT/bin/remote-mac-heartbeat" install --url http://127.0.0.1/api/heartbeat \
  --token-stdin --speed-test-interval 60 >/dev/null 2>&1; then
  fail "Unsafe speed-test interval was accepted"
fi

printf 'test-secret\ntest-sites-secret\n' | RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
  "$ROOT/bin/remote-mac-heartbeat" install \
  --url http://127.0.0.1/api/heartbeat --token-stdin --sites-token-stdin --user \
  --internet-speed >/dev/null ||
  fail "Install failed"

config="$TEST_AREA/user/.config/remote-mac-keepawake/dashboard"
plist="$TEST_AREA/user/Library/LaunchAgents/com.xudaniel.remote-mac-heartbeat.plist"
assert_file "$config/ingest-token"
assert_file "$config/sites-bypass-token"
assert_file "$plist"
assert_mode "$config" 700
assert_mode "$config/ingest-token" 600
"$ROOT/bin/remote-mac-heartbeat" version | /usr/bin/grep -q '1.1.0' || fail "Version failed"

RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
  "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Send failed"
/usr/bin/grep -q 'Authorization: Bearer test-secret' "$TEST_AREA/curl-args" ||
  fail "Authorization header missing"
/usr/bin/grep -q 'OAI-Sites-Authorization: Bearer test-sites-secret' "$TEST_AREA/curl-args" ||
  fail "Sites authorization header missing"
/usr/bin/grep -q 'battery_percent' "$TEST_AREA/curl-args" || fail "JSON payload missing"
/usr/bin/grep -q -- '--network' "$TEST_AREA/health-args" || fail "Network check was not enabled"
/usr/bin/grep -q 'internet_download_mbps.*34.2' "$TEST_AREA/curl-args" || fail "Download speed missing"
/usr/bin/grep -q 'internet_upload_mbps.*53.2' "$TEST_AREA/curl-args" || fail "Upload speed missing"
/usr/bin/grep -q 'internet_latency_ms.*25.4' "$TEST_AREA/curl-args" || fail "Latency missing"
/usr/bin/grep -q 'internet_responsiveness_rpm.*195.1' "$TEST_AREA/curl-args" || fail "Responsiveness missing"

RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
  "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Second send failed"
[[ "$(/usr/bin/wc -l < "$TEST_AREA/speed-calls" | /usr/bin/tr -d ' ')" == "1" ]] ||
  fail "Speed test cache was not reused"

RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"configured":true' || fail "Status failed"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"internet_speed_enabled":true' || fail "Speed-test status missing"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" uninstall >/dev/null ||
  fail "Uninstall failed"
[[ ! -e "$config/ingest-token" ]] || fail "Token survived uninstall"

printf 'PASS: private heartbeat install, send, status, and uninstall\n'
