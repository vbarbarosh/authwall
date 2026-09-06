# Decisions

Options considered for Authwall, with what was chosen and what was left on the
table. An entry marked *Not implemented* describes a design that has been
thought through but deliberately not built.

## Refusing to start when the database holds denied sessions or tokens

**Status: not implemented.** Recorded as an option, not a plan.

### What ships today

Access rules are read from the environment at startup and checked at sign-in,
sign-up, magic-link request, and when an address is added or changed. Nothing
re-checks an existing session or a personal access token: tightening the rules
governs whoever signs in next, everyone already inside keeps their session
until it expires or is revoked by hand, and every token keeps working until it
expires or its owner revokes it. There is no sweep, and no script that lists
what a sweep would remove.

A startup sweep — `bootstrap_access_rules()` after `bootstrap_users()`, plus
`bin/access-rules-sweep` with `--force-remove` — was built in the working tree
on 2026-09-05, was never committed, and is no longer in the tree. The story
`tests/api/stories/authwall_restarts_with_new_settings.md` records the
requirement as not implemented.

### The option

Authwall could refuse to start while the database holds
sessions or live personal access tokens belonging to accounts the configured
access rules would no longer admit. Startup fails with a message naming the
count and pointing at `bin/access-rules-sweep`. The operator then either:

- runs `bin/access-rules-sweep --force-remove` and starts again, having seen
  exactly what was destroyed before it was destroyed; or
- passes a force variable to start anyway.

The force variable has two possible meanings, and they are not the same:

| Variable | Meaning |
| --- | --- |
| `AUTHWALL_ACCESS_RULES_IGNORE_EXISTING=1` | start and leave those sessions and tokens working — the rules bind new sign-ins only |
| `AUTHWALL_ACCESS_RULES_DROP_EXISTING=1` | start and sweep them — sessions deleted, tokens revoked |

Two variables rather than one flag with two values, so that neither meaning is
reachable by accident, and so a deployment that wants credentials destroyed has
to say so.

### Why it is attractive

An operator learns what a configuration change is about to destroy *before* it
happens, at the moment they are already looking at the terminal. That is the
one thing an automatic sweep cannot offer: tokens are gone by the time the
process is listening, and each integration holding one has to enrol again.

It also makes the destructive step an explicit act. A restart is routine — a
deploy, a crash loop, a node reschedule — and routine operations should not
quietly destroy credentials.

### Why it was not chosen

Refusing to start turns a misconfiguration into an outage. An instance that
crash-loops on boot because two stale sessions belong to a since-departed
contractor is worse for the people it protects than a sweep they did not ask
for: the sweep costs those accounts a sign-in, the refusal costs everyone the
whole service.

It also fails in exactly the deployments that most need access rules. A
container orchestrator restarts pods without a human present; a start that
blocks on operator judgement will be retried, backed off, and eventually paged,
long after the rollout was supposed to be finished.

### What would change the answer

- A way to fail *soft*: start, serve, and hold the denied sessions in a
  quarantined state rather than deleting them, so nothing is destroyed and
  nothing is down. This is the design worth exploring if this comes back.
- Making token revocation reversible — a `revoked_at` that an operator can
  clear within some window — which removes most of the argument for refusing
  to start at all.

## Refusing to start on a configuration nothing can satisfy

**Status: implemented** on 2026-09-06, in `validate_email_access_rules()` in
`config/make_config.js`. Story: `tests/api/stories/username_only_flow_with_access_rules.md`.

### The situation

Email access rules admit an account by its verified addresses. A username alone
can neither register nor sign in under them. So `AUTHWALL_FLOWS=username` with
any `AUTHWALL_ALLOWED_*` or `AUTHWALL_DENIED_*` rule set is a gate nobody can
pass, and the startup summary would announce "only listed domains can sign in"
over it. An operator reads that line as gated and usable; the instance is gated
and empty.

### The options

| Option | Outcome |
| --- | --- |
| Start and say nothing | The instance is discovered empty by its first user, or never, and the summary line lies |
| Start and warn | The warning scrolls past in a container log; the summary line still lies one line below it |
| Refuse to start, naming the variables | The operator finds out at the terminal, before anyone is turned away |

### Why refusing was chosen

The contradiction is entirely in the environment and entirely knowable at
startup: nothing in the database, no request, and no provider answer can change
it. Refusing costs an operator one restart with a corrected variable; the other
two options cost the people the gate was meant to admit.

It is also the answer the codebase already gives to the same class of problem.
`AUTHWALL_CONFIRM_EMAIL_REQUIRED` without an email flow, `cookie.same_site=none`
without `cookie.secure`, an OAuth provider with half its credentials, an
unrecognized `AUTHWALL_*` variable: each refuses to start. A second policy for
this one would need a reason, and there is none.

### The line this does not cross

This refuses on what the configuration says, never on what the database holds.
The entry above records why the latter was rejected: a refusal that depends on
stored sessions or tokens turns a routine restart into an outage. This check
depends on nothing that can change between two restarts of the same
configuration.

### What would change the answer

- A username allow-list of its own. If usernames could be admitted on their own
  terms, the flow would satisfy the rules and the contradiction would vanish.
- A deployment that runs `username` only to serve accounts created under an
  earlier configuration, with registration deliberately closed. That is a
  legitimate wish; today it must be expressed by keeping the email flow on and
  is not a case this check can tell apart.

## What makes a Microsoft email "verified"

**Status: C implemented** on 2026-09-06 in
`src/oauth_providers/oauth_provider_microsoft.js` with
`src/helpers/oauth_id_token_claims.js`; story
`tests/api/stories/microsoft_email_verified_by_domain_owner.md`. B remains
open. Audit finding A02 (`audit-2026-09-05.md`). The options were recorded
before any code was written, because the choice changes who can sign in on
existing Microsoft-backed deployments.

Two things were left as they are. Microsoft's reference does not say whether
personal accounts receive `xms_edov`; if they do not, personal accounts sign in
without an email until they add one from the profile. And existing
Microsoft-sourced email identities stay verified: demoting them is a separate
decision with a migration attached.

### The situation

Every adapter hands the OAuth flow a list of *verified* emails, and the flow
treats that list as proof of mailbox control: it authorizes the sign-in against
the access rules with it and stores the first entry as a verified identity.
Four adapters earn the word. GitHub keeps only the addresses its `/user/emails`
endpoint flags `verified`; Google requires the `email_verified` claim; Discord
requires the account's `verified` flag; X exposes only a confirmed email.

Microsoft puts the userinfo `email` claim straight into the list. Microsoft
documents that claim as mutable and not to be used for authorization: a tenant
administrator can set any address on any account in their own directory, and
Authwall signs in against the `common` authority, so any tenant on earth
qualifies. This is the "nOAuth" pattern Microsoft published guidance on. The
consequence here: under an allow-list, an attacker with their own tenant can
present `someone@allowed.example`, be admitted, and have that address stored
as a verified identity on their account, which also squats it against its real
owner. Facebook takes the raw email as well and is a separate question; no
claim about Facebook's guarantee is made here.

### The options

| Option | Mechanism | Under access rules | Open registration |
| --- | --- | --- | --- |
| A. Never trust it | Microsoft returns no verified emails; the address is stored pending, like a GitHub account with a private email | Microsoft cannot sign in at all: "A verified email is required" | Works; the address is verified later through Authwall's own confirmation flow |
| B. Trust the operator's own tenant | New `AUTHWALL_MICROSOFT_TENANT`; the authority becomes that tenant instead of `common`, and the ID token's `tid` must match | Admitted; the emails are set by the operator's own directory admins | Works, but only that tenant's accounts can sign in |
| C. Trust it when Microsoft says the domain is verified | Read the ID token; treat the email as verified only when the `xms_edov` optional claim is true (the operator enables it on the app registration). Absent or false: pending, as in A | Admitted only for addresses whose domain the tenant has proven; otherwise refused with a clear message | Works; unverified addresses stay pending |

### Recommendation: C, with B as an option on top

C is the GitHub model applied to Microsoft: the provider states, per address,
whether it vouches for it, and Authwall believes nothing else. It keeps
Microsoft usable with an allow-list, which is the deployment that wants it
most, and the operator's part is one checkbox on the app registration. A is
the safe fallback C degrades to when the claim is missing, so A is contained
in C. B is worth having regardless for deployments that are one organisation,
because it also closes the door on every other tenant's accounts, verified
email or not; it is independent of C and can come later.

### What it costs

- The token response's `id_token` is currently discarded; C needs it parsed and
  its issuer and audience checked, and the `xms_edov` claim read. Confirm the
  claim's exact name, availability for personal accounts, and configuration
  steps against Microsoft's current guidance before building:
  https://learn.microsoft.com/en-us/entra/identity-platform/migrate-off-email-claim-authorization
- Existing Microsoft accounts already hold a verified email identity from the
  old rule. Those rows stay; the change binds new sign-ins and connections.
  Whether to demote existing Microsoft-sourced emails to pending is a second
  decision with a migration attached.
- Docs: the Microsoft section of `docs/oauth-providers.md` gains the optional
  claim step and the "verified only when" rule the other providers already
  document.

### What would change the answer

- Microsoft making the userinfo email claim trustworthy on its own, which its
  documentation currently says it is not.
- A deployment model where Authwall never runs with access rules; then A is
  enough and C is unneeded complexity.
