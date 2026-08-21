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
- Webhooks require HTTPS and receive only the service name, health state, and
  install mode. Treat webhook URLs as secrets and do not commit them.
- Release archives include SHA-256 checksums; CI action references are pinned
  to reviewed commit SHAs.
- Releases include an SPDX software bill of materials and GitHub artifact
  provenance attestations. Verify them with `gh attestation verify` against
  this repository after validating `SHA256SUMS`.

This project cannot protect against physical access, power or network loss,
FileVault pre-boot lock, operating-system compromise, or hardware failure.
