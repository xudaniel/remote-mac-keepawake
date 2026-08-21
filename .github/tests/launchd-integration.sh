#!/bin/bash

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
readonly REPO_ROOT
readonly SOURCE_CLI="$REPO_ROOT/bin/remote-mac-keepawake"
readonly INSTALLED_CLI="$HOME/.local/bin/remote-mac-keepawake"

cleanup() {
  if [[ -x "$INSTALLED_CLI" ]]; then
    "$INSTALLED_CLI" uninstall --user >/dev/null 2>&1 || true
  else
    "$SOURCE_CLI" uninstall --user >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

json_field() {
  /usr/bin/python3 -c \
    "import json,sys; print(json.load(sys.stdin).get('$1', ''))"
}

cleanup
"$SOURCE_CLI" install --user
initial="$("$INSTALLED_CLI" status --user --json)" ||
  fail "Installed service did not become healthy"
pid_before="$(printf '%s\n' "$initial" | json_field pid)"
[[ "$pid_before" =~ ^[0-9]+$ ]] || fail "Initial PID is missing"

/bin/kill "$pid_before" || fail "Could not stop the managed caffeinate process"
pid_after=""
attempt=1
while [[ "$attempt" -le 15 ]]; do
  current="$("$INSTALLED_CLI" status --user --json 2>/dev/null || true)"
  pid_after="$(printf '%s\n' "$current" | json_field pid 2>/dev/null || true)"
  if [[ "$pid_after" =~ ^[0-9]+$ && "$pid_after" != "$pid_before" ]] &&
     printf '%s\n' "$current" | /usr/bin/grep -Fq '"idle_sleep_prevented":true'; then
    break
  fi
  /bin/sleep 1
  attempt=$((attempt + 1))
done

[[ "$pid_after" =~ ^[0-9]+$ && "$pid_after" != "$pid_before" ]] ||
  fail "launchd did not restart caffeinate with a new PID"
"$INSTALLED_CLI" self-test --user
"$INSTALLED_CLI" uninstall --user
trap - EXIT
printf 'PASS: launchd restarted caffeinate and pmset verified its assertion\n'
