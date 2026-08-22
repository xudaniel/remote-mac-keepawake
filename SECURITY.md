# Security policy

## Supported versions

Security fixes are applied to the latest release. CI tests macOS 14, 15, and
26; older macOS versions are not part of the supported matrix.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this
repository. Do not include passwords, tokens, webhook secrets, hostnames, or
other private machine data in a public issue.

## Security model

- The service runs only Apple's `/usr/bin/caffeinate -i`.
- User mode does not require administrator access.
- System mode validates root ownership, file modes, plist syntax, service
  state, PID, and sleep assertion before reporting success.
- Health diagnostics remain local by default. Internet checks, local
  notifications, and webhooks require explicit flags.
- Mac Pulse heartbeats are HMAC-SHA-256 signed over the request method, path,
  transport timestamp, sample ID, and body digest. Production enforces a
  five-minute replay window and supports current/next/previous rotation slots.
- Authentication failure throttling stores only a hashed key bucket and time;
  it does not retain the source IP address. Bearer-only ingestion is a disabled
  migration compatibility path, not the production default.
- Reporter credentials and caches use mode-`0600` files in a mode-`0700`
  directory. Status output and logs never print signing tokens.
- The GitHub Pages viewer is public code and starts with synthetic data. Its
  optional private connection stores viewer credentials only in per-tab
  `sessionStorage`, sends them only to an operator-entered HTTPS origin, and
  never accepts the heartbeat ingest/signing key. The dashboard enables
  cross-origin reads only for the exact `PUBLIC_VIEWER_ORIGIN`; cross-origin
  mutation remains blocked.
- Webhooks require HTTPS and receive only the service name, health state, and
  install mode. Treat webhook URLs as secrets and do not commit them.
- `upgrade --release` requires HTTPS, validates the selected archive against
  `SHA256SUMS`, rejects unsafe archive paths, and rolls back a failed health
  check. It does not run automatically in the background.
- Release archives include SHA-256 checksums; CI action references are pinned
  to reviewed commit SHAs.
- Releases include an SPDX software bill of materials and GitHub artifact
  provenance attestations. Verify them with `gh attestation verify` against
  this repository after validating `SHA256SUMS`.

This project cannot protect against physical access, power or network loss,
FileVault pre-boot lock, operating-system compromise, or hardware failure.
