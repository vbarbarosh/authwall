# Authwall documentation

Authwall is an authentication proxy — it sits between clients and an internal
app, handles sign-in, and forwards authenticated requests with an
`X-Auth-User` header.

## Contents

- [Overview](overview.md) — what Authwall is, runnable `docker run` recipes, the
  project's philosophy, secret management, and related projects.
- [Architecture](architecture.md) — a high-level map of Authwall's big blocks.
- [Getting started](getting-started.md) — a one-command quick start, then the
  full Docker Compose setup in front of a real app.
- [Recipes](recipes.md) — runnable setups from a one-line start to personal
  access tokens and WebSockets.
- [Deployment](deployment.md) — HTTPS, the session secret, production
  databases, logging, and health checks.
- [Deployment examples](examples/) — runnable Docker Compose setups for the
  direct, reverse-proxy, and sidecar topologies (nginx and Caddy).
- [Sign-in flows](sign-in-flows.md) — password, magic link, magic code, and
  OAuth, and how `AUTHWALL_FLOWS` selects them.
- [OAuth providers](oauth-providers.md) — per-provider setup walkthroughs.
- [Emails](emails.md) — the transactional email templates and how to
  customize them.
- [CLI tools](cli.md) — the `bin/` utilities for running, building, and
  operating Authwall.
- [Security model](security.md) — the `X-Auth-User` trust boundary, sessions,
  CSRF, rate limiting, access control, and error-report redaction.
- [Configuration reference](config.md) — every environment variable, with
  defaults, validation rules, and examples.
- [Glossary](glossary.md) — terms used throughout the docs and code.
