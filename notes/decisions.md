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
