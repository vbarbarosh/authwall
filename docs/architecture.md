# Architecture

Authwall is an authentication proxy: it sits in front of an app, handles
sign-in, and forwards authenticated requests upstream. This page is a
high-level map of its big blocks — follow the links for detail.

The big blocks, with their options:

- [**HTTP server / proxy**](deployment.md)
- [**Sign-in flows**](sign-in-flows.md)
  - [password](sign-in-flows.md#password)
  - [magic link / code](sign-in-flows.md#magic-link-code)
  - [OAuth](oauth-providers.md)
    - [Google](oauth-providers.md#google)
    - [GitHub](oauth-providers.md#github)
    - [Microsoft](oauth-providers.md#microsoft)
    - [Facebook](oauth-providers.md#facebook)
    - [X](oauth-providers.md#x-formerly-twitter)
    - [Discord](oauth-providers.md#discord)
- [**Sessions**](security.md)
- [**Access control**](config.md#access-rules)
- [**Database**](config.md#authwall_db)
  - [SQLite](config.md#authwall_db)
  - [MySQL](config.md#authwall_db)
  - [PostgreSQL](config.md#authwall_db)
- [**Mailer**](config.md#authwall_mailer)
  - [Resend](config.md#resend)
  - [Mailjet](config.md#mailjet)
  - [Amazon SES](config.md#amazon-ses)
- [**Logger**](config.md#authwall_logger)
  - [daily file](config.md#authwall_logger)
  - [stdout](config.md#authwall_logger)
- [**Sentry**](config.md#sentry)

```mermaid
flowchart LR
    subgraph authwall [Authwall]
        server[HTTP server / proxy]
        flows[Sign-in flows]
        sessions[Sessions]
        access[Access control]
    end

    authwall -->|X-Auth-User| app([Upstream app])
    authwall --> db[(Database)]
    authwall --> mailer[Mailer]
    authwall --> oauth[OAuth providers]
    authwall --> logger[Logger]
    authwall --> sentry[Sentry]

    click server "deployment.md"
    click flows "sign-in-flows.md"
    click sessions "security.md"
    click access "config.md#access-rules"
    click db "config.md#authwall_db"
    click mailer "config.md#authwall_mailer"
    click oauth "oauth-providers.md"
    click logger "config.md#authwall_logger"
    click sentry "config.md#sentry"
```

## Request path

- **HTTP server / proxy** — accepts every request, serves Authwall's own
  `/auth` pages, and reverse-proxies everything else to the upstream app with an
  `X-Auth-User` header for signed-in users. See [Deployment](deployment.md).
- **Upstream app** — the protected application Authwall forwards to, set by
  [`AUTHWALL_TARGET_URL`](config.md#authwall_target_url).

## Authentication

- **Sign-in flows** — password, magic link/code, and OAuth. See
  [Sign-in flows](sign-in-flows.md).
- **OAuth providers** — Google, GitHub, Microsoft, Facebook, X, and Discord
  (external). See [OAuth providers](oauth-providers.md).
- **Sessions** — server-side session records plus a signed cookie keep users
  signed in. See [Security model](security.md).
- **Access control** — allow/deny rules over emails and domains decide who may
  sign in. See [Access rules](config.md#access-rules).

## Storage and outbound

- **Database** — users, identities, sessions, and auth events; SQLite by
  default, or MySQL / PostgreSQL. See [`AUTHWALL_DB`](config.md#authwall_db).
- **Mailer** — sends sign-in, confirmation, and notification email via Resend,
  Mailjet, or Amazon SES (external). See [Emails](emails.md).

## Observability

- **Logger** — request and event logging to a daily file or stdout. See
  [`AUTHWALL_LOGGER`](config.md#authwall_logger).
- **Sentry** — optional error reporting (external). See
  [Sentry](config.md#sentry).
