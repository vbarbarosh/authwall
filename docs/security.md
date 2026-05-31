# Security model

This page describes how Authwall protects the app behind it and the accounts it
manages. For the environment variables referenced here, see the
[configuration reference](config.md).

## The `X-Auth-User` trust boundary

Authwall's core guarantee: the upstream app can trust the `X-Auth-User` header.

- **Incoming `x-auth-*` headers are stripped.** Before any request is proxied,
  Authwall deletes every `x-auth-*` header it received from the client. A client
  cannot smuggle `X-Auth-User: admin` through Authwall.
- **Authwall sets `X-Auth-User` itself**, to the signed-in user's id, only on
  authenticated requests that are not for a [public path](config.md#authwall_public_paths).
- Unauthenticated requests are never proxied — they are redirected to sign-in —
  so the app only ever receives requests Authwall has vetted.
- When [personal access tokens](config.md#authwall_personal_access_tokens) are
  enabled, a valid `Authorization: Bearer ...` token is another way to establish
  the same upstream identity. Authwall validates the token, strips the bearer
  credential, and forwards `X-Auth-User`.
- Email-verification enforcement (`AUTHWALL_CONFIRM_EMAIL_REQUIRED`) applies to
  bearer tokens too: a valid token whose owner has no verified email is rejected
  with `403 Email verification required`.
- When [`AUTHWALL_WEBSOCKETS`](config.md#authwall_websockets) is enabled, the
  same guarantee extends to upgrades: clients authenticate the upgrade with an
  `Authorization: Bearer` personal access token. Authwall strips inbound
  `x-auth-*` headers, removes the credential before forwarding, and sets
  `X-Auth-User` itself.

For this guarantee to hold, the app must be reachable **only** through Authwall.
If the app is also exposed directly, a client can reach it without Authwall and
forge the header itself.

## Sessions and cookies

Sign-in state is kept in a server-side session; the browser holds only an
opaque session id.

- The session cookie is **`HttpOnly`** (not readable from JavaScript) and
  **`SameSite`** (`lax` by default — see [`AUTHWALL_COOKIE_SAMESITE`](config.md#session-cookie)).
- It is marked **`Secure`** automatically when [`AUTHWALL_PUBLIC_URL`](config.md#authwall_public_url)
  is `https://` — keep it that way in production.
- Session and CSRF keys are derived from one root secret
  ([`AUTHWALL_SECRET`](config.md#authwall_secret)) via HKDF. Rotating it
  invalidates every session.
- Sessions are stored in the database, so they survive restarts and are shared
  across instances that share a database. Signing out, or revoking a session
  from the profile, deletes it server-side immediately.

## CSRF protection

Every session carries a random CSRF token. State-changing `POST` endpoints
(password change, account removal, connecting/disconnecting a provider, and so
on) require that token in the request body, and compare it in **constant time**.
A request without the matching token is rejected. The token is delivered to the
frontend through the `GET /auth/status` response.

## Rate limiting

When [`AUTHWALL_RATE_LIMITING`](config.md#authwall_rate_limiting) is enabled
(the default), the sensitive entry points are throttled **per client IP**:

| Endpoint                          | Limit                    |
|-----------------------------------|--------------------------|
| Sign-in                           | 10 requests / 15 minutes |
| Sign-up                           | 5 requests / hour        |
| Password reset                    | 5 requests / hour        |
| Magic-link request                | 5 requests / hour        |
| Personal access token creation    | 5 requests / hour        |
| Failed bearer-token validation    | 20 requests / 15 minutes |

The bearer-token limiter covers both HTTP requests and WebSocket upgrades that
authenticate with a PAT.

Counts are held in memory, so they are not shared between processes and reset
on restart. This slows credential stuffing and brute-force attempts; it is not
a substitute for an upstream WAF or load-balancer throttling.

## Password storage

Passwords are hashed with **bcrypt** — never stored or logged in clear text.
The cost factor is [`AUTHWALL_BCRYPT_ROUNDS`](config.md#passwords) (default
`12`). One-time magic-link codes are bcrypt-hashed the same way. New passwords
must meet [`AUTHWALL_PASSWORD_MIN`](config.md#passwords) (default `8`).

## Access control

Registration is **open by default** — anyone who can reach the sign-in page can
create an account. To run Authwall as a gate for a known set of users,
configure the [access rules](config.md#access-rules): `AUTHWALL_ALLOWED_EMAILS`,
`AUTHWALL_ALLOWED_DOMAINS`, and the matching deny lists. When any allow list is
set, the default flips to deny. The rules are enforced on every sign-in flow,
including OAuth (checked against the provider's verified emails).

Optionally, [`AUTHWALL_CONFIRM_EMAIL_REQUIRED`](config.md#email-confirmation)
holds users at an email-confirmation step until they prove control of their
address before any request reaches the app.

## Open-redirect protection

Sign-in and similar flows accept a `return` parameter so the user lands back
where they started. Authwall only honours a `return` value that is either a
relative path, or an absolute URL on the same host as — or a subdomain of —
`AUTHWALL_PUBLIC_URL`'s hostname. Protocol-relative URLs (`//evil.com`),
backslash tricks, and encoded leading slashes are rejected, so `return` cannot
be used to bounce users to an attacker's site.

## Audit log

Authentication events — sign-in, sign-out, sign-up, password changes, password
resets, email changes, provider connect/disconnect, session revocation — are
recorded in the database with their outcome (success / failure / no-op). The
`bin/activity-summary` [CLI tool](cli.md#operations-and-reporting) summarises
them over a time window.

## Error reporting

When [Sentry](config.md#sentry) is enabled, Authwall scrubs events before they
are sent: `sendDefaultPii` is off, expected user-facing errors are dropped
entirely, `Cookie` / `Authorization` / `Set-Cookie` / `X-CSRF-Token` headers and
the request body are removed, and query parameters that look like secrets
(`token`, `secret`, `password`, `code`, `state`) are replaced with `[Filtered]`.

## Running behind a proxy

Authwall sets Express's `trust proxy`, so `req.ip` is taken from the
`X-Forwarded-For` header. That single trust assumption is load-bearing for
several user-visible signals:

- Per-IP **rate-limit keys** (sign-in, sign-up, PAT creation, bearer-token
  validation, etc.).
- **Last-used IP** shown for browser sessions and for personal access tokens.
- **Source IP** recorded on every row in the `auth_events` audit log.

Deploy Authwall **behind a reverse proxy or load balancer that overwrites
`X-Forwarded-For`** with the real client connection (nginx's `real_ip_header`,
Caddy's `trusted_proxies`, an LB that strips inbound and appends its own, etc.)
— and do not expose Authwall directly to the internet. A directly reachable
instance lets any client send `X-Forwarded-For: 1.2.3.4` and have that value
become the recorded IP everywhere above. The "last used from 8.8.8.8" line on a
token row is only meaningful if the operator has actually constrained who can
write that header.

## Hardening checklist

- [ ] The upstream app is reachable only through Authwall, never directly.
- [ ] Authwall runs behind a TLS terminator; `AUTHWALL_PUBLIC_URL` is `https://`.
- [ ] The upstream proxy or load balancer **overwrites `X-Forwarded-For`** from
      the real client (see [Running behind a proxy](#running-behind-a-proxy)).
      Otherwise rate-limit keys, last-used IPs, and audit IPs are spoofable.
- [ ] `AUTHWALL_SECRET` is managed deliberately, or `data/` is persisted.
- [ ] Rate limiting is left enabled (or handled by an upstream proxy).
- [ ] Registration is restricted with the access rules if sign-up is not meant
      to be open.
- [ ] `AUTHWALL_BCRYPT_ROUNDS` is set appropriately for your hardware.
- [ ] Sentry (if used) is on a trusted DSN; redaction is automatic.
