## Outcome

Describe the user-visible result and the problem it solves.

## Safety and privacy

- [ ] Fail-closed behavior and rollback boundaries remain intact.
- [ ] No token, hostname, username, IP, serial number, location, or real device history is included.
- [ ] FileVault, lid-sleep, power, and network limits remain accurate.
- [ ] New outbound network behavior is opt-in and documented.

## Validation

- [ ] Bash syntax and relevant shell suites pass.
- [ ] Dashboard lint, build, tests, and migrations pass when affected.
- [ ] English and Chinese documentation remain aligned.
- [ ] Release packaging and executable modes remain valid when affected.

## Rollback

Explain how to safely revert or disable this change.
