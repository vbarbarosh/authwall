# An allow list needs confirmed addresses

Authwall is started with `AUTHWALL_ALLOWED_DOMAINS=corp.test`, the email flow
enabled, and `AUTHWALL_CONFIRM_EMAIL_REQUIRED=false`.

## Expected

Authwall refuses to start. The error names the allow-rule variables that are
set and the two ways out: require confirmation, or disable the email flow.

It starts when confirmation is required or left unset (it then resolves to
enabled), when the email flow is off and only magic links or OAuth bring
addresses in, and when only deny rules are set.

## Why

An allow list is the reason to put Authwall in front of an internal app, and
it admits an account by its addresses. Email sign-up stores whatever address
the visitor typed; with confirmation off, that typed address counted as
membership. Anyone could sign up as `someone@corp.test`, an address they do
not own, and was proxied (AW-01, probe P1 of `notes/audit-2026-09-23.md`).

Magic links and OAuth bring in only addresses that were verified on the way,
so they are safe without the setting. Deny lists fail closed, so they do not
need it either. The configuration that is unsafe is refused at startup, as
the username-only flow with access rules already is
(`username_only_flow_with_access_rules.md`).
