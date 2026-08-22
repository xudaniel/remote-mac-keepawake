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
printf '%s\n' '{"timestamp":"2026-08-21T03:27:03Z","version":"1.4.0","health":"healthy","mode":"user","installed":true,"service_state":"running","pid":14656,"idle_sleep_prevented":true,"power_source":"AC Power","battery_percent":59,"battery_condition":"normal","battery_cycle_count":120,"battery_design_capacity_mah":6000,"battery_full_charge_capacity_mah":5400,"battery_health_percent":90.0,"thermal_state":"nominal","charging":true,"lid_closed":false,"network_checked":1,"network_available":true,"chrome_checked":0,"chrome_running":null}'
EOF
cat > "$TEST_AREA/bin/curl" <<EOF
#!/bin/bash
printf '%s\n' "\$*" > "$TEST_AREA/curl-args"
for argument in "\$@"; do
  case "\$argument" in
    @*) /bin/cat "\${argument#@}" >> "$TEST_AREA/curl-payloads" ;;
  esac
done
[[ ! -e "$TEST_AREA/curl-fail" ]]
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
  --internet-speed --network-probe-url https://probe.example/health >/dev/null ||
  fail "Install failed"

config="$TEST_AREA/user/.config/remote-mac-keepawake/dashboard"
plist="$TEST_AREA/user/Library/LaunchAgents/com.xudaniel.remote-mac-heartbeat.plist"
assert_file "$config/ingest-token"
assert_file "$config/ingest-key-id"
assert_file "$config/network-probe-url"
assert_file "$config/sites-bypass-token"
assert_file "$plist"
assert_mode "$config" 700
assert_mode "$config/ingest-token" 600
assert_mode "$config/ingest-key-id" 600
assert_mode "$config/network-probe-url" 600
[[ "$(/bin/cat "$config/network-probe-url")" == "https://probe.example/health" ]] ||
  fail "Configured network probe URL was not preserved"
assert_mode "$config/outbox" 700
"$ROOT/bin/remote-mac-heartbeat" version | /usr/bin/grep -q '1.4.0' || fail "Version failed"

RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
  "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Send failed"
/usr/bin/grep -q 'Authorization: Bearer test-secret' "$TEST_AREA/curl-args" ||
  fail "Authorization header missing"
/usr/bin/grep -q 'OAI-Sites-Authorization: Bearer test-sites-secret' "$TEST_AREA/curl-args" ||
  fail "Sites authorization header missing"
/usr/bin/grep -q 'X-Mac-Pulse-Key-Id: current' "$TEST_AREA/curl-args" ||
  fail "Signing key ID header missing"
/usr/bin/grep -Eq 'X-Mac-Pulse-Signature: [0-9a-f]{64}' "$TEST_AREA/curl-args" ||
  fail "HMAC signature header missing"
/usr/bin/grep -Eq 'X-Mac-Pulse-Timestamp: [0-9]{4}-' "$TEST_AREA/curl-args" ||
  fail "Transport timestamp header missing"
/usr/bin/grep -q 'battery_percent' "$TEST_AREA/curl-payloads" || fail "JSON payload missing"
/usr/bin/grep -Eq '"sample_id":"[0-9a-f-]{36}"' "$TEST_AREA/curl-payloads" ||
  fail "Idempotent sample ID missing"
transport_timestamp="$(/usr/bin/sed -n 's/.*X-Mac-Pulse-Timestamp: \([^ ]*\).*/\1/p' "$TEST_AREA/curl-args")"
sample_id="$(/usr/bin/sed -n 's/.*"sample_id":"\([0-9a-f-]*\)".*/\1/p' "$TEST_AREA/curl-payloads")"
signature="$(/usr/bin/sed -n 's/.*X-Mac-Pulse-Signature: \([0-9a-f]*\).*/\1/p' "$TEST_AREA/curl-args")"
body_digest="$(/usr/bin/openssl dgst -sha256 -r "$TEST_AREA/curl-payloads" | /usr/bin/awk '{print $1}')"
expected_signature="$(printf '%s\n%s\n%s\n%s\n%s' POST /api/heartbeat "$transport_timestamp" "$sample_id" "$body_digest" |
  /usr/bin/openssl dgst -sha256 -hmac test-secret -r | /usr/bin/awk '{print $1}')"
[[ "$signature" == "$expected_signature" ]] || fail "HMAC signature does not match the canonical payload"
/usr/bin/grep -q -- '--retry 2' "$TEST_AREA/curl-args" || fail "Upload retry policy missing"
/usr/bin/grep -q -- '--network' "$TEST_AREA/health-args" || fail "Network check was not enabled"
/usr/bin/grep -q 'internet_download_mbps.*34.2' "$TEST_AREA/curl-payloads" || fail "Download speed missing"
/usr/bin/grep -q 'internet_upload_mbps.*53.2' "$TEST_AREA/curl-payloads" || fail "Upload speed missing"
/usr/bin/grep -q 'internet_latency_ms.*25.4' "$TEST_AREA/curl-payloads" || fail "Latency missing"
/usr/bin/grep -q 'internet_responsiveness_rpm.*195.1' "$TEST_AREA/curl-payloads" || fail "Responsiveness missing"
/usr/bin/grep -q 'network_fault":"none"' "$TEST_AREA/curl-payloads" || fail "Network fault isolation missing"
/usr/bin/grep -q 'network_gateway_jitter_ms.*0.4' "$TEST_AREA/curl-payloads" || fail "Network jitter missing"
/usr/bin/grep -q 'network_gateway_packet_loss_percent.*0.0' "$TEST_AREA/curl-payloads" || fail "Network loss missing"

RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
  "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Second send failed"
[[ "$(/usr/bin/wc -l < "$TEST_AREA/speed-calls" | /usr/bin/tr -d ' ')" == "1" ]] ||
  fail "Speed test cache was not reused"

assert_network_fault() {
  local expected="$1"
  shift
  /bin/rm -f "$config/network-diagnostics.json"
  /usr/bin/env "$@" RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
    RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
    RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
    RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
    "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Network fault fixture $expected failed"
  /usr/bin/tail -n 1 "$TEST_AREA/curl-payloads" |
    /usr/bin/grep -q "\"network_fault\":\"$expected\"" || fail "Network fault $expected was not classified"
}

assert_network_fault local-network RMKA_TEST_ROUTE_AVAILABLE=false
assert_network_fault dns RMKA_TEST_DNS_AVAILABLE=false
assert_network_fault internet RMKA_TEST_HTTPS_AVAILABLE=false
assert_network_fault dashboard-ingest RMKA_TEST_INGEST_REACHABLE=false
assert_network_fault none RMKA_TEST_GATEWAY_LATENCY_MS=140.0 \
  RMKA_TEST_GATEWAY_JITTER_MS=45.0 RMKA_TEST_GATEWAY_PACKET_LOSS_PERCENT=12.5
/usr/bin/tail -n 1 "$TEST_AREA/curl-payloads" | /usr/bin/grep -q '"network_gateway_jitter_ms":45.0' ||
  fail "High-jitter measurement was not retained"

printf 'fail\n' > "$TEST_AREA/curl-fail"
if RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
  RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
  RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
  RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
    "$ROOT/bin/remote-mac-heartbeat" send >/dev/null 2>&1; then
  fail "Failed upload was reported as successful"
fi
[[ "$(find "$config/outbox" -type f -name '*.json' | /usr/bin/wc -l | /usr/bin/tr -d ' ')" == "1" ]] ||
  fail "Failed heartbeat was not retained in the outbox"
/bin/rm -f "$TEST_AREA/curl-fail"
RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
  "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Outbox replay failed"
[[ "$(find "$config/outbox" -type f -name '*.json' | /usr/bin/wc -l | /usr/bin/tr -d ' ')" == "0" ]] ||
  fail "Outbox did not drain after connectivity recovered"

printf 'rotated-secret\n' | RMKA_DASH_TEST_ROOT="$TEST_AREA" \
  "$ROOT/bin/remote-mac-heartbeat" rotate-key --key-id next --token-stdin >/dev/null ||
  fail "Key rotation failed"
assert_mode "$config/ingest-token" 600
assert_mode "$config/ingest-key-id" 600
[[ "$(/bin/cat "$config/ingest-key-id")" == "next" ]] || fail "Rotated key ID was not activated"
RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
RMKA_DASH_NETWORK_QUALITY="$TEST_AREA/bin/networkQuality" \
RMKA_HEALTH_ARGS_LOG="$TEST_AREA/health-args" RMKA_SPEED_CALLS_LOG="$TEST_AREA/speed-calls" \
  "$ROOT/bin/remote-mac-heartbeat" send >/dev/null || fail "Signed send after rotation failed"
/usr/bin/grep -q 'X-Mac-Pulse-Key-Id: next' "$TEST_AREA/curl-args" || fail "Rotated key ID was not used"
/usr/bin/grep -q 'Authorization: Bearer rotated-secret' "$TEST_AREA/curl-args" || fail "Rotated key was not used"

/bin/mkdir -p "$config/send.lock"
printf '%s\n' "$$" > "$config/send.lock/pid"
if RMKA_DASH_TEST_ROOT="$TEST_AREA" RMKA_DASH_ALLOW_HTTP=1 \
  RMKA_DASH_CLI="$TEST_AREA/bin/health" RMKA_DASH_CURL="$TEST_AREA/bin/curl" \
    "$ROOT/bin/remote-mac-heartbeat" send >/dev/null 2>&1; then
  fail "Concurrent heartbeat send was not rejected"
fi
/bin/rm -f "$config/send.lock/pid"
/bin/rmdir "$config/send.lock"

RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"configured":true' || fail "Status failed"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"internet_speed_enabled":true' || fail "Speed-test status missing"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"pending_samples":0' || fail "Outbox status missing"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"signed_heartbeats":true' || fail "Signed-heartbeat status missing"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -q '"network_diagnostics_enabled":true' || fail "Network diagnostics status missing"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" status |
  /usr/bin/grep -Eq '"last_success_at":"[0-9]{4}-' || fail "Last-success status missing"
printf '%s\n' '{"preserved":true}' > "$config/outbox/preserved.json"
RMKA_DASH_TEST_ROOT="$TEST_AREA" "$ROOT/bin/remote-mac-heartbeat" uninstall >/dev/null ||
  fail "Uninstall failed"
[[ ! -e "$config/ingest-token" ]] || fail "Token survived uninstall"
[[ ! -e "$config/ingest-key-id" ]] || fail "Key ID survived uninstall"
assert_file "$config/outbox/preserved.json"

printf 'PASS: private heartbeat delivery, replay, status, locking, and uninstall\n'
