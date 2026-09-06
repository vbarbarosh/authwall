# Username-only flow with email access rules

Authwall is started with `AUTHWALL_FLOWS=username` and
`AUTHWALL_ALLOWED_DOMAINS=authwall.test`. No email, magic-link, or OAuth flow
is enabled.

## Expected

Authwall refuses to start. The error names the rule variables that are set and
the flows that would satisfy them. Adding any one of those flows — `email`, a
magic-link mode, or a configured OAuth provider — lets it start.

## Why

Email access rules admit an account by its verified addresses, so a username
alone can neither register nor sign in under them. With no flow that brings an
email in, the rules describe a door nobody can enter, and the startup summary
would still announce *"only listed domains can sign in"* over it. An operator
reads that line and believes the instance is gated and usable; it is gated and
empty.

Startup already refuses `AUTHWALL_CONFIRM_EMAIL_REQUIRED` without an email
flow.  This is the same class of contradiction, and it gets the same answer.
The decision to refuse rather than warn is recorded in
[`notes/decisions.md`](../../../notes/decisions.md).
