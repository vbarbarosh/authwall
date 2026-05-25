# Configuration

By default, Authwall does its best to configure flows, mailers,
and other integrations from whatever settings are present.
But when you explicitly ask for something — a specific mailer,
a specific sign-in flow, a specific cookie mode — Authwall
refuses to start unless that request is fully satisfied.

This is intentional: it prevents the situation where you believe
a setting took effect the way you wanted, but Authwall silently
fell back to a different option.

## Overview

| Varname                                                                     | Short description                                      |
|-----------------------------------------------------------------------------|--------------------------------------------------------|
| [`LISTEN`](#listen)                                                         | Bind address for the HTTP server                       |
| [`PORT`](#port)                                                             | HTTP listen port                                       |
| [`AUTHWALL_SECRET`](#authwall_secret)                                       | Root secret for sessions and CSRF protection           |
| [`AUTHWALL_LOGGER`](#authwall_logger)                                       | Log destination                                        |
| [`AUTHWALL_PASSWORD_MIN`](#authwall_password_min)                           | Minimum password length for new passwords              |
| [`AUTHWALL_BCRYPT_ROUNDS`](#authwall_bcrypt_rounds)                         | bcrypt cost for new password hashes                    |
| [`AUTHWALL_RATE_LIMITING`](#authwall_rate_limiting)                         | Enables or disables in-memory rate limiting            |
| [`AUTHWALL_SENTRY_DSN`](#authwall_sentry_dsn)                               | Sentry DSN for error reporting                         |
| [`AUTHWALL_SENTRY_ENVIRONMENT`](#authwall_sentry_environment)               | Sentry environment name                                |
| [`AUTHWALL_SENTRY_TRACES_SAMPLE_RATE`](#authwall_sentry_traces_sample_rate) | Optional Sentry tracing sample rate                    |
| [`AUTHWALL_PERSONAL_ACCESS_TOKENS`](#authwall_personal_access_tokens)       | Enables bearer tokens for API clients                  |
| [`AUTHWALL_PUBLIC_URL`](#authwall_public_url)                               | Public base URL used for redirects and generated links |
| [`AUTHWALL_PUBLIC_PATHS`](#authwall_public_paths)                           | Public upstream paths that bypass sign-in              |
| [`AUTHWALL_OPTIONAL_AUTH_PATHS`](#authwall_optional_auth_paths)                 | Public paths that receive auth headers when signed in  |
| [`AUTHWALL_TARGET_URL`](#authwall_target_url)                               | Upstream application URL                               |
| [`AUTHWALL_TARGET_MODE`](#authwall_target_mode)                             | Upstream proxy behavior mode                           |
| [`AUTHWALL_SET_HEADERS`](#authwall_set_headers)                             | Headers to add to upstream requests                    |
| [`AUTHWALL_UNSET_HEADERS`](#authwall_unset_headers)                         | Headers to remove from upstream requests               |
| [`AUTHWALL_DB`](#authwall_db)                                               | Database connection URI                                |
| [`AUTHWALL_SEED`](#authwall_seed)                                           | Bootstrap users created at startup                     |
| [`AUTHWALL_COOKIE_DOMAIN`](#authwall_cookie_domain)                         | Session cookie domain                                  |
| [`AUTHWALL_COOKIE_PATH`](#authwall_cookie_path)                             | Session cookie path                                    |
| [`AUTHWALL_COOKIE_SAMESITE`](#authwall_cookie_samesite)                     | SameSite value for the session cookie                  |
| [`AUTHWALL_COOKIE_SECURE`](#authwall_cookie_secure)                         | Whether session cookies require HTTPS                  |
| [`AUTHWALL_ALLOWED_EMAILS`](#authwall_allowed_emails)                       | Exact email addresses allowed to sign in               |
| [`AUTHWALL_ALLOWED_DOMAINS`](#authwall_allowed_domains)                     | Email domains allowed to sign in                       |
| [`AUTHWALL_DENIED_EMAILS`](#authwall_denied_emails)                         | Exact email addresses denied sign-in                   |
| [`AUTHWALL_DENIED_DOMAINS`](#authwall_denied_domains)                       | Email domains denied sign-in                           |
| [`AUTHWALL_CONFIRM_EMAIL_REQUIRED`](#authwall_confirm_email_required)       | Whether a confirmed email is required for access       |
| [`AUTHWALL_CONFIRM_EMAIL`](#authwall_confirm_email)                         | Email-confirmation channel: link, code, or both        |
| [`AUTHWALL_MAILER`](#authwall_mailer)                                       | Mailer provider selection                              |
| [`AUTHWALL_RESEND_KEY`](#authwall_resend_key)                               | Resend API key                                         |
| [`AUTHWALL_RESEND_FROM`](#authwall_resend_from)                             | Resend sender address                                  |
| [`AUTHWALL_MAILJET_KEY`](#authwall_mailjet_key)                             | Mailjet API key                                        |
| [`AUTHWALL_MAILJET_SECRET`](#authwall_mailjet_secret)                       | Mailjet API secret                                     |
| [`AUTHWALL_MAILJET_FROM`](#authwall_mailjet_from)                           | Mailjet sender address                                 |
| [`AUTHWALL_SES_KEY`](#authwall_ses_key)                                     | AWS access key id for SES                              |
| [`AUTHWALL_SES_SECRET`](#authwall_ses_secret)                               | AWS secret access key for SES                          |
| [`AUTHWALL_SES_REGION`](#authwall_ses_region)                               | AWS SES region                                         |
| [`AUTHWALL_SES_SESSION_TOKEN`](#authwall_ses_session_token)                 | Optional AWS session token for SES                     |
| [`AUTHWALL_SES_FROM`](#authwall_ses_from)                                   | AWS SES sender address                                 |
| [`AUTHWALL_FLOWS`](#authwall_flows)                                         | Enabled sign-in flows                                  |
| [`AUTHWALL_MAGIC_LINK`](#authwall_magic_link)                               | Magic-link and magic-code mode                         |
| [`AUTHWALL_GOOGLE_CLIENT_ID`](#authwall_google_client_id)                   | Google OAuth client id                                 |
| [`AUTHWALL_GOOGLE_CLIENT_SECRET`](#authwall_google_client_secret)           | Google OAuth client secret                             |
| [`AUTHWALL_GOOGLE_REDIRECT_URL`](#authwall_google_redirect_url)             | Google OAuth redirect URL                              |
| [`AUTHWALL_GITHUB_CLIENT_ID`](#authwall_github_client_id)                   | GitHub OAuth client id                                 |
| [`AUTHWALL_GITHUB_CLIENT_SECRET`](#authwall_github_client_secret)           | GitHub OAuth client secret                             |
| [`AUTHWALL_GITHUB_REDIRECT_URL`](#authwall_github_redirect_url)             | GitHub OAuth redirect URL                              |
| [`AUTHWALL_FACEBOOK_CLIENT_ID`](#authwall_facebook_client_id)               | Facebook OAuth client id                               |
| [`AUTHWALL_FACEBOOK_CLIENT_SECRET`](#authwall_facebook_client_secret)       | Facebook OAuth client secret                           |
| [`AUTHWALL_FACEBOOK_REDIRECT_URL`](#authwall_facebook_redirect_url)         | Facebook OAuth redirect URL                            |
| [`AUTHWALL_MICROSOFT_CLIENT_ID`](#authwall_microsoft_client_id)             | Microsoft OAuth client id                              |
| [`AUTHWALL_MICROSOFT_CLIENT_SECRET`](#authwall_microsoft_client_secret)     | Microsoft OAuth client secret                          |
| [`AUTHWALL_MICROSOFT_REDIRECT_URL`](#authwall_microsoft_redirect_url)       | Microsoft OAuth redirect URL                           |
| [`AUTHWALL_TWITTER_CLIENT_ID`](#authwall_twitter_client_id)                 | X OAuth client id                                      |
| [`AUTHWALL_TWITTER_CLIENT_SECRET`](#authwall_twitter_client_secret)         | X OAuth client secret                                  |
| [`AUTHWALL_TWITTER_REDIRECT_URL`](#authwall_twitter_redirect_url)           | X OAuth redirect URL                                   |
| [`AUTHWALL_DISCORD_CLIENT_ID`](#authwall_discord_client_id)                 | Discord OAuth client id                                |
| [`AUTHWALL_DISCORD_CLIENT_SECRET`](#authwall_discord_client_secret)         | Discord OAuth client secret                            |
| [`AUTHWALL_DISCORD_REDIRECT_URL`](#authwall_discord_redirect_url)           | Discord OAuth redirect URL                             |

<a id="listen"></a>
<a id="port"></a>

## Server

Where the Authwall HTTP server binds.

- `LISTEN` — bind address. Default: `127.0.0.1` when running from source; the published Docker image bakes in `LISTEN=0.0.0.0` so the container is reachable on every interface. Override to a specific address to bind to one interface.
- `PORT` — TCP port. Default: `3000`.

These configure the local listener only; the externally visible URL is set separately via [AUTHWALL_PUBLIC_URL](#authwall_public_url).

Example:

```sh
LISTEN=0.0.0.0
PORT=8000
```

## AUTHWALL_SECRET

Root secret used to derive Authwall's session and CSRF secrets.

- Type: string
- Default: generated automatically and stored in `data/secret.key`
- Validation: must be at least 32 characters when set

Set this explicitly when secrets are managed by the runtime, orchestrator, or an external secret store.
If it is not set, Authwall loads `data/secret.key`;
if that file does not exist, Authwall generates a random secret and writes it there.

Rotating this value invalidates existing sessions and CSRF tokens.

> [!WARNING]
> If the value (env var or `data/secret.key`) is shorter than 32 characters, Authwall refuses to start.

Example:

```sh
AUTHWALL_SECRET=$(bin/random-secret)
```

## AUTHWALL_LOGGER

Where Authwall writes its log output.

- Type: enum
- Values: `daily`, `stdout`
- Default: `daily`

Use `daily` to write to a date-stamped file under `data/logs/`, named `app-YYYY-MM-DD.log` and rotated automatically when the date changes.
Use `stdout` to write to standard output, which is the right choice for containerized deployments where a process supervisor or log collector picks up stdout.

Example:

```sh
AUTHWALL_LOGGER=stdout
```

<a id="authwall_password_min"></a>
<a id="authwall_bcrypt_rounds"></a>

## Passwords

Controls how Authwall accepts and stores passwords.

- `AUTHWALL_PASSWORD_MIN` — minimum length for new passwords (sign-up, password change, password reset). Type: integer in `[4, 32]`. Default: `8`. Existing shorter hashes continue to work on sign-in; the limit is only enforced when a password is set.
- `AUTHWALL_BCRYPT_ROUNDS` — bcrypt cost factor for new password hashes and magic-code hashes. Type: integer in `[4, 31]`. Default: `12`. Each step roughly doubles hashing time; raising this hardens hashes against offline attacks but slows every sign-in proportionally.

> [!WARNING]
> If either value is out of range, Authwall refuses to start.

Example:

```sh
AUTHWALL_PASSWORD_MIN=12
AUTHWALL_BCRYPT_ROUNDS=13
```

## AUTHWALL_RATE_LIMITING

Toggles Authwall's built-in per-IP rate limiting.

- Type: string flag
- Values: `0` to disable; any other value (or unset) leaves it enabled
- Default: enabled

When enabled, the following endpoints are rate-limited per client IP:

- Sign-in — 10 requests per 15 minutes.
- Sign-up — 5 requests per hour.
- Password reset — 5 requests per hour.
- Magic-link request — 5 requests per hour.
- Personal access token creation — 5 requests per hour.
- Failed bearer-token validation — 20 requests per 15 minutes (returns `429` with `Retry-After`).

Counts are tracked in memory only, so they do not persist across restarts and are not shared between processes.
Disable rate limiting only in environments where requests are throttled by an upstream proxy or load balancer, or in tests where the limits would interfere.

Example:

```sh
AUTHWALL_RATE_LIMITING=0
```

<a id="authwall_sentry_dsn"></a>
<a id="authwall_sentry_environment"></a>
<a id="authwall_sentry_traces_sample_rate"></a>

## Sentry

Configures Sentry error reporting for the Node/Express process.

- `AUTHWALL_SENTRY_DSN` — enables Sentry when set. Leave unset to disable Sentry.
- `AUTHWALL_SENTRY_ENVIRONMENT` — optional environment label, such as `production` or `staging`.
- `AUTHWALL_SENTRY_TRACES_SAMPLE_RATE` — optional performance tracing sample rate in `[0, 1]`. Leave unset to disable tracing.

Authwall registers Sentry's Express error handler before its own redirecting error handler, so exceptions are reported while users still receive Authwall's normal error redirect behavior.
Authwall does not enable `sendDefaultPii`, strips cookies and authorization headers, drops request bodies, and redacts OAuth-style `code`, `state`, and `token` query parameters before events are sent.

Example:

```sh
AUTHWALL_SENTRY_DSN=https://public@example.ingest.sentry.io/1
AUTHWALL_SENTRY_ENVIRONMENT=production
AUTHWALL_SENTRY_TRACES_SAMPLE_RATE=0.05
```

<a id="authwall_personal_access_tokens"></a>

## AUTHWALL_PERSONAL_ACCESS_TOKENS

Enables personal access tokens for API clients.

- Type: boolean flag
- Values: `yes`, `no`, `true`, `false`, `on`, `off`
- Default: `false`

When disabled, Authwall does not expose the token management UI, does not
register the token management routes, and does not accept bearer tokens for
upstream authentication.

When enabled, signed-in users can create tokens from the profile page. The raw
token is shown once, only a SHA-256 hash is stored, and API clients send it as:

```http
Authorization: Bearer awp_...
```

Valid bearer tokens authenticate proxied upstream requests and Authwall forwards
the same trusted `X-Auth-User` header it uses for browser sessions. Authwall
removes the bearer `Authorization` header before proxying the request.

Bearer tokens also work against `GET /auth/status`, so an API client can
introspect the signed-in identity without holding a browser session.

### What bearer tokens cannot do

Bearer tokens are intentionally **not** accepted by the `/auth/*` account
management endpoints — creating or revoking personal access tokens, revoking
browser sessions, changing email or password, deleting the account, and so on.
Those flows require an active browser session and a CSRF token. A leaked PAT
can act on the upstream app as its owner, but it cannot escalate by reshaping
the owner's authwall account.

### Usage from an API client

Once a user has minted a token from the profile page, an API client sends it
as the `Authorization` header on every request:

```sh
curl -H 'Authorization: Bearer awp_…' https://authwall.example.com/api/things
```

The same token works against `/auth/status` for identity introspection:

```sh
curl -H 'Authorization: Bearer awp_…' https://authwall.example.com/auth/status
```

To **rotate** a token, revoke the old one from the profile page and create a
new one. Authwall does not expose a regenerate endpoint by design; the explicit
revoke + create steps keep the audit log clear about what happened.

Example:

```sh
AUTHWALL_PERSONAL_ACCESS_TOKENS=true
```

## AUTHWALL_PUBLIC_URL

Public base URL for Authwall.
Authwall uses this value when building redirects and generated links that must point back to the Authwall service.

- Type: URL string
- Default: `http://127.0.0.1:3000`

Set this to the externally visible URL users and OAuth providers use to reach Authwall.
For production, this should usually be an HTTPS URL.

This value also drives the default of `AUTHWALL_COOKIE_SECURE`: when `AUTHWALL_PUBLIC_URL` starts
with `https://`, the session cookie's `Secure` attribute defaults to `true`
otherwise to `false`.

Example:

```sh
AUTHWALL_PUBLIC_URL=https://myapp.test
```

## AUTHWALL_PUBLIC_PATHS

Public upstream paths that bypass sign-in. These paths are proxied to `AUTHWALL_TARGET_URL` with or without a session and never receive the `X-Auth-User` header.

- Type: list of path strings
- Default: the `public_paths` list in `config/settings.yaml`
- Delimiters: comma, semicolon, or newline

Entries may be exact paths or prefix entries ending in `/*`. For example, `/lib/*` matches `/lib/app.js` and `/lib/vendor/react.js`.

When `AUTHWALL_PUBLIC_PATHS` is set, it replaces the `public_paths` list from `config/settings.yaml`.

Example:

```sh
AUTHWALL_PUBLIC_PATHS="/favicon.ico,/robots.txt,/lib/*,/designs/*"
```

## AUTHWALL_OPTIONAL_AUTH_PATHS

Public upstream paths that bypass sign-in for guests, but behave like private paths when a user is signed in. Anonymous requests are proxied without `X-Auth-User`; signed-in requests are proxied with `X-Auth-User`.

- Type: list of path strings
- Default: the `optional_auth_paths` list in `config/settings.yaml`
- Delimiters: comma, semicolon, or newline

Entries may be exact paths or prefix entries ending in `/*`. This is useful for a landing page that should render guest content for anonymous users and signed-in content for authenticated users at the same URL.

When `AUTHWALL_OPTIONAL_AUTH_PATHS` is set, it replaces the `optional_auth_paths` list from `config/settings.yaml`.

Example:

```sh
AUTHWALL_OPTIONAL_AUTH_PATHS="/,/landing/*"
```

## AUTHWALL_TARGET_URL

URL of the upstream application protected by Authwall.
Every request whose path is not under `/auth` is proxied here.

- Type: URL string
- Default: `http://127.0.0.1:8080`

Use the URL that Authwall can reach from its own runtime environment.
In Docker Compose, this is usually a service URL such as `http://echo-server:8080`;
outside Docker it is often a loopback URL.

How requests reach the upstream:

- **Authenticated requests** — Authwall adds `X-Auth-User: <user_uid>` to the proxied request.
- **Public paths** (configured in `config/settings.yaml` under `public_paths`) are always proxied, with or without a session, and never receive the `X-Auth-User` header.
- **Optional auth paths** (configured in `config/settings.yaml` under `optional_auth_paths`) are proxied without requiring sign-in. Anonymous requests receive no `X-Auth-User`; signed-in requests receive `X-Auth-User` and follow the same email-verification checks as private paths.
- **Other paths without a session** — the user is redirected to the sign-in page; no upstream request is made.

Public paths support exact entries and prefix entries. Prefix entries end with `/*`, so `/lib/*` matches `/lib/app.js` and `/lib/vendor/react.js`; `/designs/*` matches `/designs/default.css`.

```yaml
public_paths:
  - /favicon.ico
  - /robots.txt
  - /lib/*
  - /designs/*
optional_auth_paths:
  - /
  - /landing/*
```

Example:

```sh
AUTHWALL_TARGET_URL=https://internal-service:8080
```

## AUTHWALL_TARGET_MODE

Controls how Authwall rewrites requests when forwarding them to its single
upstream, `AUTHWALL_TARGET_URL`. Choose the mode by how many domains sit behind
Authwall.

- Type: enum
- Values: `direct`, `proxy`
- Default: `direct`

Authwall always forwards to exactly one upstream and cannot route by domain on
its own. The mode decides whether that upstream is the app itself or a reverse
proxy that fans out to several apps:

```
direct   client → authwall → app
proxy    client → authwall → reverse proxy → apps
```

```mermaid
flowchart LR
    subgraph direct
        direction LR
        dc[client] --> da[authwall] --> dapp[app]
    end
    subgraph proxy
        direction LR
        pc[client] --> pa[authwall] --> prp["reverse proxy"] --> papps[apps]
    end
```

Use `direct` when **one** app sits behind Authwall. Authwall rewrites the
`Host` header to the domain of `AUTHWALL_TARGET_URL`, so the app receives the
request as if it had been sent straight to it.

Use `proxy` when **several** domains sit behind Authwall. The upstream is a
reverse proxy (such as nginx or Caddy) that routes each domain to its own app.
Authwall preserves the client's original `Host` header so that proxy can tell
the domains apart, and additionally sends `X-Forwarded-For`, `X-Forwarded-Host`,
and `X-Forwarded-Proto`.

Example:

```sh
AUTHWALL_TARGET_MODE=proxy
```

## AUTHWALL_SET_HEADERS

Headers to add to requests before Authwall forwards them to `AUTHWALL_TARGET_URL`.

- Type: semicolon-separated `Header-Name=value` entries
- Default: none
- Validation: each header name and value must be valid for Node's HTTP client

Use this for static headers the upstream expects on every proxied request.
Header values may be empty.

Outgoing headers are assembled in this order, so later steps override earlier ones:

1. Authwall adds `X-Auth-User` for authenticated, non-public-path requests.
2. `AUTHWALL_SET_HEADERS` entries are applied (and may overwrite `X-Auth-User`).
3. `AUTHWALL_UNSET_HEADERS` entries are removed.

Example:

```sh
AUTHWALL_SET_HEADERS='X-Team=notes;Authorization=Basic abc:def==;X-Empty='
```

## AUTHWALL_UNSET_HEADERS

Headers to remove from requests before Authwall forwards them to `AUTHWALL_TARGET_URL`.
Removal happens last, after Authwall's own headers and `AUTHWALL_SET_HEADERS` have been
applied — see the order in [AUTHWALL_SET_HEADERS](#authwall_set_headers).

- Type: semicolon-separated header names
- Default: none
- Validation: each header name must be valid for Node's HTTP client

Use this to drop headers the upstream should not see — typically session cookies or upstream-trusted
authorization headers leaking through from the client.
Authwall already strips every `x-auth-*` header from incoming requests in middleware,
so client-supplied `X-Auth-User` cannot reach the proxy in any case.

Example:

```sh
AUTHWALL_UNSET_HEADERS='X-Auth-User;X-Forwarded-User'
```

## AUTHWALL_DB

Database connection URI.

- Type: connection URI
- Default: SQLite database at `data/db.sqlite3`
- Values: unset, `mysql://...`, `postgres://...`, `postgresql://...`

Leave this unset for the default local SQLite database.
Set it when Authwall should use MySQL or PostgreSQL instead.

> [!WARNING]
> If the URI uses any other scheme, Authwall refuses to start.

Examples:

```sh
AUTHWALL_DB=mysql://authwall:authwall@mysql/authwall
AUTHWALL_DB=postgres://authwall:authwall@postgres/authwall
```

## AUTHWALL_SEED

Bootstrap users created at startup.
Authwall creates missing users and adds missing username or email identities for existing users.
Entries with neither a username nor a valid email are logged and skipped.

- Type: compact string or JSON array
- Default: none

Compact format — `username:password:emails`, with multiple users separated by `;`:

- `:` separates the three fields per entry: `username`, `password`, `emails`.
- `,` separates multiple emails within the third field.
- `;` separates entries.
- Either `username` or `emails` may be empty, but not both.

```sh
AUTHWALL_SEED='admin:change-me:admin@myapp.test;ops:change-me:ops1@myapp.test,ops2@myapp.test'
```

JSON format — an array of objects:

- `username` — string, optional if at least one email is present.
- `password` — string used when the user is created.
- `emails` — string or array of strings; optional if `username` is present.
- `display_name` — optional string shown in the profile.

```sh
AUTHWALL_SEED='[{"username":"admin","password":"change-me","display_name":"Admin","emails":["admin@myapp.test"]}]'
```

<a id="authwall_cookie_domain"></a>
<a id="authwall_cookie_path"></a>
<a id="authwall_cookie_samesite"></a>
<a id="authwall_cookie_secure"></a>

## Session cookie

Configures the session cookie Authwall sets after sign-in.

- `AUTHWALL_COOKIE_DOMAIN` — `Domain` attribute. Default: unset; the cookie is scoped to the exact host of the response.
- `AUTHWALL_COOKIE_PATH` — `Path` attribute. Default: `/`. Values that do not start with `/` are normalized to `/`.
- `AUTHWALL_COOKIE_SAMESITE` — `SameSite` attribute. Values: `lax`, `strict`, `none`. Default: `lax`.
- `AUTHWALL_COOKIE_SECURE` — `Secure` attribute. Values: `yes`, `no`, `true`, `false`. Default: `true` when `AUTHWALL_PUBLIC_URL` starts with `https://`, otherwise `false`.

Modern browsers reject `SameSite=None` cookies that are not also `Secure`.

> [!WARNING]
> If `AUTHWALL_COOKIE_SAMESITE=none` is set without `AUTHWALL_COOKIE_SECURE=true`, Authwall refuses to start.

The cookie's `Max-Age` is fixed at 30 days and cannot be changed via env vars.

Example:

```sh
AUTHWALL_COOKIE_DOMAIN=myapp.test
AUTHWALL_COOKIE_PATH=/
AUTHWALL_COOKIE_SAMESITE=lax
AUTHWALL_COOKIE_SECURE=true
```

<a id="authwall_allowed_emails"></a>
<a id="authwall_allowed_domains"></a>
<a id="authwall_denied_emails"></a>
<a id="authwall_denied_domains"></a>

## Access rules

Restricts which email addresses may sign in.
All four variables are comma-separated lists. Comparison is case-insensitive (values are normalized to lowercase). Empty lists are ignored.

The four lists are checked in a fixed priority order, where each higher-priority list can override the next:

1. **`AUTHWALL_DENIED_EMAILS`** — highest priority. Listed addresses are always denied.
2. **`AUTHWALL_ALLOWED_EMAILS`** — next. Listed addresses are always allowed, which is how you make per-address exceptions to `AUTHWALL_DENIED_DOMAINS`.
3. **`AUTHWALL_DENIED_DOMAINS`** — block whole domains.
4. **`AUTHWALL_ALLOWED_DOMAINS`** — allow whole domains.

When neither allow list is set, only the deny lists are enforced and everything else is allowed.
When either allow list is set, the default flips to deny — addresses not matched by any rule are rejected.

Implementation:

```js
async function authorize_email(email_normalized)
{
    const [_, domain] = email_normalized.split('@');
    const has_allowed_emails = config.access.allowed_emails.length > 0;
    const has_allowed_domains = config.access.allowed_domains.length > 0;

    if (config.access.denied_emails.includes(email_normalized)) {
        throw new UserFriendlyError('Email is not allowed');
    }

    if (config.access.allowed_emails.includes(email_normalized)) {
        return;
    }

    // denylist (always enforced)
    if (config.access.denied_domains.includes(domain)) {
        throw new UserFriendlyError('Email domain is not allowed');
    }

    if (has_allowed_domains && config.access.allowed_domains.includes(domain)) {
        return;
    }

    // allowlist default deny
    if (has_allowed_domains) {
        throw new UserFriendlyError('Email domain is not allowed');
    }

    if (has_allowed_emails) {
        throw new UserFriendlyError('Email is not allowed');
    }
}
```

Examples:

Only one address can sign in; everyone else is denied:

```sh
AUTHWALL_ALLOWED_EMAILS=admin@myapp.test
```

A small allowlist — these three addresses can sign in, nobody else:

```sh
AUTHWALL_ALLOWED_EMAILS=alice@myapp.test,bob@myapp.test,carol@myapp.test
```

Anyone at `myapp.test` can sign in, except one banned address — `DENIED_EMAILS` overrides `ALLOWED_DOMAINS`:

```sh
AUTHWALL_ALLOWED_DOMAINS=myapp.test
AUTHWALL_DENIED_EMAILS=fired@myapp.test
```

<a id="authwall_confirm_email_required"></a>
<a id="authwall_confirm_email"></a>

## Email confirmation

Controls whether Authwall asks users to confirm an email address, and how the confirmation message is delivered.

- `AUTHWALL_CONFIRM_EMAIL_REQUIRED` — whether a confirmed email is required to reach the protected app. Type: boolean flag. Values: `yes`, `no`, `true`, `false`, `on`, `off`. Default: unset, which resolves to enabled whenever the email sign-in flow is enabled. When enabled, users without a confirmed email are held at the confirmation step instead of being proxied upstream.
- `AUTHWALL_CONFIRM_EMAIL` — confirmation delivery mode. Type: enum. Values: `auto`, `off`, `disabled`, `link`, `code`, `link_and_code`. Default: `auto`.

How each `AUTHWALL_CONFIRM_EMAIL` value behaves:

- `auto` — enabled when a mailer is configured, otherwise disabled. The default channel is `link_and_code`.
- `off` / `disabled` — email confirmation is disabled.
- `link` — confirmation emails contain only a clickable link.
- `code` — confirmation emails contain only a one-time code that the user types into the confirmation page.
- `link_and_code` — confirmation emails contain both.

Any value outside the list above disables confirmation and logs a warning.

> [!WARNING]
> If `AUTHWALL_CONFIRM_EMAIL` is one of `link`, `code`, or `link_and_code` but no mailer is configured, Authwall refuses to start.

> [!WARNING]
> If `AUTHWALL_CONFIRM_EMAIL_REQUIRED` is enabled while the email sign-in flow is disabled, Authwall refuses to start.

A few related knobs are not exposed as environment variables and are tuned in `config/settings.yaml` under `confirm_email`: `expires_minutes` (default `15`), `code_length` (default `6`), `max_attempts` (default `5`), and `resend_cooldown_seconds` (default `60`).

Example:

```sh
AUTHWALL_CONFIRM_EMAIL_REQUIRED=true
AUTHWALL_CONFIRM_EMAIL=code
```

## AUTHWALL_MAILER

Selects which mailer Authwall uses to send sign-in, confirmation, password-reset, magic-link, and notification emails.

- Type: enum
- Values: `auto`, `fake`, `resend`, `mailjet`, `ses`
- Default: `auto`

How each value behaves:

- `auto` — picks the first provider whose required env vars are all set, in this order: [Resend](#authwall_resend_key), [Mailjet](#authwall_mailjet_key), [Amazon SES](#authwall_ses_key). If none is configured, falls back to `fake`.
- `fake` — drops every email instead of sending. Suitable for local development and tests; not safe for production because users will not receive confirmation or password-reset emails.
- `resend` / `mailjet` / `ses` — uses the named provider explicitly.

> [!WARNING]
> When a provider is requested explicitly but not fully configured, Authwall refuses to start.

Example:

```sh
AUTHWALL_MAILER=resend
```

<a id="authwall_resend_key"></a>
<a id="authwall_resend_from"></a>

## Resend

Configures the Resend mailer.
Both variables are required together; the provider is usable only when both are set.

- `AUTHWALL_RESEND_KEY` — Resend API key. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_RESEND_FROM` — Sender address used in the `From` header. Typically formatted as `"Display Name <noreply@myapp.test>"`. The domain must be verified in Resend.

With `AUTHWALL_MAILER=auto` (the default), Resend is selected automatically when both are set.

> [!WARNING]
> If `AUTHWALL_MAILER=resend` is requested explicitly without both, Authwall refuses to start.

Obtain the API key from Resend → API Keys.

Example:

```sh
AUTHWALL_RESEND_KEY=re_...
AUTHWALL_RESEND_FROM="Authwall <noreply@myapp.test>"
```

<a id="authwall_mailjet_key"></a>
<a id="authwall_mailjet_secret"></a>
<a id="authwall_mailjet_from"></a>

## Mailjet

Configures the Mailjet mailer.
All three variables are required together; the provider is usable only when all of them are set.

- `AUTHWALL_MAILJET_KEY` — Mailjet API key.
- `AUTHWALL_MAILJET_SECRET` — Mailjet API secret. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_MAILJET_FROM` — Sender address used in the `From` header. Typically formatted as `"Display Name <noreply@myapp.test>"`. The sender must be verified in Mailjet.

With `AUTHWALL_MAILER=auto` (the default), Mailjet is selected automatically when all three are set and Resend is not configured.

> [!WARNING]
> If `AUTHWALL_MAILER=mailjet` is requested explicitly without all three, Authwall refuses to start.

Obtain credentials from Mailjet → Account Settings → API Key Management.

Example:

```sh
AUTHWALL_MAILJET_KEY=...
AUTHWALL_MAILJET_SECRET=...
AUTHWALL_MAILJET_FROM="Authwall <noreply@myapp.test>"
```

<a id="authwall_ses_key"></a>
<a id="authwall_ses_secret"></a>
<a id="authwall_ses_region"></a>
<a id="authwall_ses_session_token"></a>
<a id="authwall_ses_from"></a>

## Amazon SES

Configures the Amazon SES mailer.
`AUTHWALL_SES_KEY`, `AUTHWALL_SES_SECRET`, and `AUTHWALL_SES_FROM` are required together; `AUTHWALL_SES_REGION` and `AUTHWALL_SES_SESSION_TOKEN` are optional.

- `AUTHWALL_SES_KEY` — AWS access key ID.
- `AUTHWALL_SES_SECRET` — AWS secret access key. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_SES_FROM` — Sender address used in the `From` header. Typically formatted as `"Display Name <noreply@myapp.test>"`. The sender (or its domain) must be verified in SES.
- `AUTHWALL_SES_REGION` — AWS region for the SES endpoint. Defaults to `us-east-1`.
- `AUTHWALL_SES_SESSION_TOKEN` — Optional AWS session token for temporary credentials (e.g. STS / assumed roles). Omit when using long-lived IAM access keys.

With `AUTHWALL_MAILER=auto` (the default), SES is selected automatically when `AUTHWALL_SES_KEY`, `AUTHWALL_SES_SECRET`, and `AUTHWALL_SES_FROM` are all set and neither Resend nor Mailjet is configured.

> [!WARNING]
> If `AUTHWALL_MAILER=ses` is requested explicitly without `AUTHWALL_SES_KEY`, `AUTHWALL_SES_SECRET`, and `AUTHWALL_SES_FROM`, Authwall refuses to start.

Obtain credentials from AWS IAM; verify the sender or its domain in the SES console for the chosen region.

Example:

```sh
AUTHWALL_SES_KEY=AKIA...
AUTHWALL_SES_SECRET=...
AUTHWALL_SES_REGION=us-east-1
AUTHWALL_SES_FROM="Authwall <noreply@myapp.test>"
```

## AUTHWALL_FLOWS

Selects which sign-in flows Authwall offers.
This is the last step of configuration: every other variable (mailer, OAuth credentials, password options, magic-link mode) is resolved first, and `AUTHWALL_FLOWS` then chooses among the flows those prior settings made available.

- Type: `auto` or comma-separated list of flow names
- Values: `auto`, or any combination of `username`, `email`, `magic_link`, `magic_code`, `magic_link_and_code`, `google`, `github`, `microsoft`, `facebook`, `twitter`, `discord`
- Default: `auto`

How each value behaves:

- `auto` — every flow whose prerequisites are already in place is enabled. Configure flows via their own env vars, and they show up automatically.
- comma-separated list — only the listed flows are enabled, and each one must already be fully configured.

The `magic_link_and_code` value is shorthand for both `magic_link` and `magic_code` together.

> [!WARNING]
> When an explicit list names a flow that is missing its prerequisites, Authwall refuses to start.

Example — only password sign-in by username and Google:

```sh
AUTHWALL_FLOWS=username,google
```

## AUTHWALL_MAGIC_LINK

Controls whether magic-link sign-in is enabled and which channel users get.

- Type: enum
- Values: `auto`, `off`, `disabled`, `link`, `code`, `link_and_code`
- Default: `auto`

How each value behaves:

- `auto` — enabled when a mailer is configured, otherwise disabled. The default channel is `link_and_code`.
- `off` / `disabled` — magic-link sign-in is disabled.
- `link` — emails contain only a clickable link.
- `code` — emails contain only a one-time code that the user types into the browser.
- `link_and_code` — emails contain both.

Any value outside the list above disables the flow and logs a warning.

> [!WARNING]
> If the value is one of `link`, `code`, or `link_and_code` but no mailer is configured, Authwall refuses to start.

Example:

```sh
AUTHWALL_MAGIC_LINK=code
```

<a id="authwall_google_client_id"></a>
<a id="authwall_google_client_secret"></a>
<a id="authwall_google_redirect_url"></a>

## Google OAuth

Configures sign-in with Google.
All three variables are required together; the flow is enabled only when all of them are set.

- `AUTHWALL_GOOGLE_CLIENT_ID` — OAuth 2.0 client identifier issued by Google.
- `AUTHWALL_GOOGLE_CLIENT_SECRET` — OAuth 2.0 client secret. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_GOOGLE_REDIRECT_URL` — Callback URL Google redirects to after the user authorizes Authwall. It must match an Authorized Redirect URI registered on the OAuth client in Google Cloud Console; otherwise Google rejects the request. Authwall handles the callback at `/auth/google/callback`, so this is normally `<AUTHWALL_PUBLIC_URL>/auth/google/callback`.

If only some of the three are set, Authwall logs a warning and disables the Google flow.

> [!WARNING]
> If `AUTHWALL_FLOWS=google` is requested explicitly without all three, Authwall refuses to start.

Obtain values from Google Cloud Console → APIs & Services → Credentials.

Example:

```sh
AUTHWALL_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
AUTHWALL_GOOGLE_CLIENT_SECRET=GOCSPX-...
AUTHWALL_GOOGLE_REDIRECT_URL=https://myapp.test/auth/google/callback
```

<a id="authwall_github_client_id"></a>
<a id="authwall_github_client_secret"></a>
<a id="authwall_github_redirect_url"></a>

## GitHub OAuth

Configures sign-in with GitHub.
All three variables are required together; the flow is enabled only when all of them are set.

- `AUTHWALL_GITHUB_CLIENT_ID` — OAuth client identifier issued by GitHub.
- `AUTHWALL_GITHUB_CLIENT_SECRET` — OAuth client secret. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_GITHUB_REDIRECT_URL` — Callback URL GitHub redirects to after the user authorizes Authwall. It must match the Authorization callback URL registered on the OAuth App in GitHub; otherwise GitHub rejects the request. Authwall handles the callback at `/auth/github/callback`, so this is normally `<AUTHWALL_PUBLIC_URL>/auth/github/callback`.

If only some of the three are set, Authwall logs a warning and disables the GitHub flow.

> [!WARNING]
> If `AUTHWALL_FLOWS=github` is requested explicitly without all three, Authwall refuses to start.

Obtain values from GitHub → Settings → Developer settings → OAuth Apps.

Example:

```sh
AUTHWALL_GITHUB_CLIENT_ID=Iv1.abcdef1234567890
AUTHWALL_GITHUB_CLIENT_SECRET=ghs_...
AUTHWALL_GITHUB_REDIRECT_URL=https://myapp.test/auth/github/callback
```

<a id="authwall_facebook_client_id"></a>
<a id="authwall_facebook_client_secret"></a>
<a id="authwall_facebook_redirect_url"></a>

## Facebook OAuth

Configures sign-in with Facebook.
All three variables are required together; the flow is enabled only when all of them are set.

- `AUTHWALL_FACEBOOK_CLIENT_ID` — App ID issued by Meta.
- `AUTHWALL_FACEBOOK_CLIENT_SECRET` — App Secret. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_FACEBOOK_REDIRECT_URL` — Callback URL Facebook redirects to after the user authorizes Authwall. It must match a Valid OAuth Redirect URI configured on the app in Meta for Developers; otherwise Facebook rejects the request. Authwall handles the callback at `/auth/facebook/callback`, so this is normally `<AUTHWALL_PUBLIC_URL>/auth/facebook/callback`.

If only some of the three are set, Authwall logs a warning and disables the Facebook flow.

> [!WARNING]
> If `AUTHWALL_FLOWS=facebook` is requested explicitly without all three, Authwall refuses to start.

Obtain values from Meta for Developers → My Apps → your app → Facebook Login → Settings.

Example:

```sh
AUTHWALL_FACEBOOK_CLIENT_ID=1234567890123456
AUTHWALL_FACEBOOK_CLIENT_SECRET=...
AUTHWALL_FACEBOOK_REDIRECT_URL=https://myapp.test/auth/facebook/callback
```

<a id="authwall_microsoft_client_id"></a>
<a id="authwall_microsoft_client_secret"></a>
<a id="authwall_microsoft_redirect_url"></a>

## Microsoft OAuth

Configures sign-in with Microsoft.
All three variables are required together; the flow is enabled only when all of them are set.

- `AUTHWALL_MICROSOFT_CLIENT_ID` — Application (client) ID from the app registration.
- `AUTHWALL_MICROSOFT_CLIENT_SECRET` — Client secret value. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_MICROSOFT_REDIRECT_URL` — Callback URL Microsoft redirects to after the user authorizes Authwall. It must match a Redirect URI registered on the app registration in Microsoft Entra; otherwise Microsoft rejects the request. Authwall handles the callback at `/auth/microsoft/callback`, so this is normally `<AUTHWALL_PUBLIC_URL>/auth/microsoft/callback`.

If only some of the three are set, Authwall logs a warning and disables the Microsoft flow.

> [!WARNING]
> If `AUTHWALL_FLOWS=microsoft` is requested explicitly without all three, Authwall refuses to start.

Obtain values from Microsoft Entra admin center → Identity → Applications → App registrations.

Example:

```sh
AUTHWALL_MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
AUTHWALL_MICROSOFT_CLIENT_SECRET=...
AUTHWALL_MICROSOFT_REDIRECT_URL=https://myapp.test/auth/microsoft/callback
```

<a id="authwall_twitter_client_id"></a>
<a id="authwall_twitter_client_secret"></a>
<a id="authwall_twitter_redirect_url"></a>

## X OAuth

Configures sign-in with X (formerly Twitter).
All three variables are required together; the flow is enabled only when all of them are set.

The variables keep their `TWITTER` names for compatibility, even though the product is now called X.

- `AUTHWALL_TWITTER_CLIENT_ID` — OAuth 2.0 Client ID from the X app.
- `AUTHWALL_TWITTER_CLIENT_SECRET` — OAuth 2.0 Client Secret. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_TWITTER_REDIRECT_URL` — Callback URL X redirects to after the user authorizes Authwall. It must match a Callback URI registered on the OAuth 2.0 client in the X Developer Portal; otherwise X rejects the request. Authwall handles the callback at `/auth/twitter/callback`, so this is normally `<AUTHWALL_PUBLIC_URL>/auth/twitter/callback`.

If only some of the three are set, Authwall logs a warning and disables the X flow.

> [!WARNING]
> If `AUTHWALL_FLOWS=twitter` is requested explicitly without all three, Authwall refuses to start.

Obtain values from X Developer Portal → Projects & Apps → your app → User authentication settings.

Example:

```sh
AUTHWALL_TWITTER_CLIENT_ID=...
AUTHWALL_TWITTER_CLIENT_SECRET=...
AUTHWALL_TWITTER_REDIRECT_URL=https://myapp.test/auth/twitter/callback
```

<a id="authwall_discord_client_id"></a>
<a id="authwall_discord_client_secret"></a>
<a id="authwall_discord_redirect_url"></a>

## Discord OAuth

Configures sign-in with Discord.
All three variables are required together; the flow is enabled only when all of them are set.

- `AUTHWALL_DISCORD_CLIENT_ID` — Application's Client ID.
- `AUTHWALL_DISCORD_CLIENT_SECRET` — Application's Client Secret. Treat it as a secret: do not commit it or expose it to clients.
- `AUTHWALL_DISCORD_REDIRECT_URL` — Callback URL Discord redirects to after the user authorizes Authwall. It must match a Redirect registered on the application in the Discord Developer Portal; otherwise Discord rejects the request. Authwall handles the callback at `/auth/discord/callback`, so this is normally `<AUTHWALL_PUBLIC_URL>/auth/discord/callback`.

If only some of the three are set, Authwall logs a warning and disables the Discord flow.

> [!WARNING]
> If `AUTHWALL_FLOWS=discord` is requested explicitly without all three, Authwall refuses to start.

Obtain values from Discord Developer Portal → Applications → your application → OAuth2.

Example:

```sh
AUTHWALL_DISCORD_CLIENT_ID=1234567890123456789
AUTHWALL_DISCORD_CLIENT_SECRET=...
AUTHWALL_DISCORD_REDIRECT_URL=https://myapp.test/auth/discord/callback
```
