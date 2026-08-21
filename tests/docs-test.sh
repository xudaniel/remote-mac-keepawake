#!/bin/bash

set -u
set -o pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly REPO_ROOT
readonly CLI="$REPO_ROOT/bin/remote-mac-keepawake"
readonly HEARTBEAT="$REPO_ROOT/bin/remote-mac-heartbeat"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

require_file() {
  [[ -s "$REPO_ROOT/$1" ]] || fail "Missing or empty file: $1"
}

require_text() {
  /usr/bin/grep -Fq "$2" "$REPO_ROOT/$1" ||
    fail "Expected '$2' in $1"
}

version="$(/usr/bin/awk -F'"' '/readonly VERSION=/{print $2; exit}' "$CLI")"
heartbeat_version="$(/usr/bin/awk -F'"' '/readonly VERSION=/{print $2; exit}' "$HEARTBEAT")"
dashboard_version="$(/usr/bin/awk -F'"' '/"version":/{print $4; exit}' "$REPO_ROOT/dashboard/package.json")"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "CLI version is not semantic: $version"
[[ "$heartbeat_version" == "$version" ]] ||
  fail "Heartbeat version $heartbeat_version does not match CLI version $version"
[[ "$dashboard_version" == "$version" ]] ||
  fail "Dashboard version $dashboard_version does not match CLI version $version"

for path in README.md README.zh-CN.md docs/PRD.en.md docs/PRD.zh-CN.md \
  docs/ARCHITECTURE.md docs/ARCHITECTURE.zh-CN.md \
  docs/assets/mac-pulse-synthetic.svg CONTRIBUTING.md CHANGELOG.md SECURITY.md \
  LICENSE; do
  require_file "$path"
done

require_text README.md "Current release: v$version"
require_text README.zh-CN.md "当前版本：v$version"
require_text CHANGELOG.md "## [$version]"
require_text docs/PRD.en.md "Product version | $version"
require_text docs/PRD.zh-CN.md "产品版本 | $version"

require_text README.md '[简体中文](README.zh-CN.md)'
require_text README.md '[English PRD](docs/PRD.en.md)'
require_text README.md '[中文 PRD](docs/PRD.zh-CN.md)'
require_text README.zh-CN.md '[English](README.md)'
require_text README.zh-CN.md '[英文 PRD](docs/PRD.en.md)'
require_text README.zh-CN.md '[中文 PRD](docs/PRD.zh-CN.md)'
require_text README.md 'docs/assets/mac-pulse-synthetic.svg'
require_text README.md '[architecture and trust boundaries](docs/ARCHITECTURE.md)'
require_text README.zh-CN.md '[架构说明](docs/ARCHITECTURE.zh-CN.md)'
require_text docs/assets/mac-pulse-synthetic.svg 'SYNTHETIC DEMO DATA'

require_text .github/workflows/release.yml 'README.zh-CN.md'
require_text .github/workflows/release.yml 'docs/PRD.en.md'
require_text .github/workflows/release.yml 'docs/PRD.zh-CN.md'
require_text .github/workflows/release.yml 'bin/remote-mac-heartbeat'
require_text .github/workflows/release.yml 'dashboard/package.json'
require_text .github/workflows/release.yml 'SBOM.spdx.json'
require_text .github/workflows/release.yml 'actions/attest@'

printf 'PASS: bilingual documentation and release metadata match v%s\n' "$version"
