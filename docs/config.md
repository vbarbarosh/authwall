# Configuration

## Overview

| Varname | Short description |
|---|---|
| [`LISTEN`](#listen) | Bind address for the HTTP server. |
| [`PORT`](#port) | HTTP listen port. |
| [`AUTHWALL_SECRET`](#authwall_secret) | Root secret for sessions and CSRF protection. |
| [`AUTHWALL_LOGGER`](#authwall_logger) | Log destination. |
| [`AUTHWALL_PASSWORD_MIN`](#authwall_password_min) | Minimum password length for new passwords. |
| [`AUTHWALL_BCRYPT_ROUNDS`](#authwall_bcrypt_rounds) | bcrypt cost for new password hashes. |
| [`AUTHWALL_RATE_LIMITING`](#authwall_rate_limiting) | Enables or disables in-memory rate limiting. |
| [`AUTHWALL_PUBLIC_URL`](#authwall_public_url) | Public base URL used for redirects and generated links. |
| [`AUTHWALL_TARGET_URL`](#authwall_target_url) | Upstream application URL. |
| [`AUTHWALL_TARGET_MODE`](#authwall_target_mode) | Upstream proxy behavior mode. |
| [`AUTHWALL_SET_HEADERS`](#authwall_set_headers) | Headers to add to upstream requests. |
| [`AUTHWALL_UNSET_HEADERS`](#authwall_unset_headers) | Headers to remove from upstream requests. |
| [`AUTHWALL_DB`](#authwall_db) | Database connection URI. |
| [`AUTHWALL_SEED`](#authwall_seed) | Bootstrap users created at startup. |
| [`AUTHWALL_COOKIE_DOMAIN`](#authwall_cookie_domain) | Session cookie domain. |
| [`AUTHWALL_COOKIE_PATH`](#authwall_cookie_path) | Session cookie path. |
| [`AUTHWALL_COOKIE_SAMESITE`](#authwall_cookie_samesite) | SameSite value for the session cookie. |
| [`AUTHWALL_COOKIE_SECURE`](#authwall_cookie_secure) | Whether session cookies require HTTPS. |
| [`AUTHWALL_ALLOWED_EMAILS`](#authwall_allowed_emails) | Exact email addresses allowed to sign in. |
| [`AUTHWALL_ALLOWED_DOMAINS`](#authwall_allowed_domains) | Email domains allowed to sign in. |
| [`AUTHWALL_DENIED_EMAILS`](#authwall_denied_emails) | Exact email addresses denied sign-in. |
| [`AUTHWALL_DENIED_DOMAINS`](#authwall_denied_domains) | Email domains denied sign-in. |
| [`AUTHWALL_MAILER`](#authwall_mailer) | Mailer provider selection. |
| [`AUTHWALL_RESEND_KEY`](#authwall_resend_key) | Resend API key. |
| [`AUTHWALL_RESEND_FROM`](#authwall_resend_from) | Resend sender address. |
| [`AUTHWALL_MAILJET_KEY`](#authwall_mailjet_key) | Mailjet API key. |
| [`AUTHWALL_MAILJET_SECRET`](#authwall_mailjet_secret) | Mailjet API secret. |
| [`AUTHWALL_MAILJET_FROM`](#authwall_mailjet_from) | Mailjet sender address. |
| [`AUTHWALL_SES_KEY`](#authwall_ses_key) | AWS access key id for SES. |
| [`AUTHWALL_SES_SECRET`](#authwall_ses_secret) | AWS secret access key for SES. |
| [`AUTHWALL_SES_REGION`](#authwall_ses_region) | AWS SES region. |
| [`AUTHWALL_SES_SESSION_TOKEN`](#authwall_ses_session_token) | Optional AWS session token for SES. |
| [`AUTHWALL_SES_FROM`](#authwall_ses_from) | AWS SES sender address. |
| [`AUTHWALL_FLOWS`](#authwall_flows) | Enabled sign-in flows. |
| [`AUTHWALL_MAGIC_LINK`](#authwall_magic_link) | Magic-link and magic-code mode. |
| [`AUTHWALL_GOOGLE_CLIENT_ID`](#authwall_google_client_id) | Google OAuth client id. |
| [`AUTHWALL_GOOGLE_CLIENT_SECRET`](#authwall_google_client_secret) | Google OAuth client secret. |
| [`AUTHWALL_GOOGLE_REDIRECT_URL`](#authwall_google_redirect_url) | Google OAuth redirect URL. |
| [`AUTHWALL_GITHUB_CLIENT_ID`](#authwall_github_client_id) | GitHub OAuth client id. |
| [`AUTHWALL_GITHUB_CLIENT_SECRET`](#authwall_github_client_secret) | GitHub OAuth client secret. |
| [`AUTHWALL_GITHUB_REDIRECT_URL`](#authwall_github_redirect_url) | GitHub OAuth redirect URL. |
| [`AUTHWALL_FACEBOOK_CLIENT_ID`](#authwall_facebook_client_id) | Facebook OAuth client id. |
| [`AUTHWALL_FACEBOOK_CLIENT_SECRET`](#authwall_facebook_client_secret) | Facebook OAuth client secret. |
| [`AUTHWALL_FACEBOOK_REDIRECT_URL`](#authwall_facebook_redirect_url) | Facebook OAuth redirect URL. |
| [`AUTHWALL_MICROSOFT_CLIENT_ID`](#authwall_microsoft_client_id) | Microsoft OAuth client id. |
| [`AUTHWALL_MICROSOFT_CLIENT_SECRET`](#authwall_microsoft_client_secret) | Microsoft OAuth client secret. |
| [`AUTHWALL_MICROSOFT_REDIRECT_URL`](#authwall_microsoft_redirect_url) | Microsoft OAuth redirect URL. |
| [`AUTHWALL_TWITTER_CLIENT_ID`](#authwall_twitter_client_id) | X OAuth client id. |
| [`AUTHWALL_TWITTER_CLIENT_SECRET`](#authwall_twitter_client_secret) | X OAuth client secret. |
| [`AUTHWALL_TWITTER_REDIRECT_URL`](#authwall_twitter_redirect_url) | X OAuth redirect URL. |
| [`AUTHWALL_DISCORD_CLIENT_ID`](#authwall_discord_client_id) | Discord OAuth client id. |
| [`AUTHWALL_DISCORD_CLIENT_SECRET`](#authwall_discord_client_secret) | Discord OAuth client secret. |
| [`AUTHWALL_DISCORD_REDIRECT_URL`](#authwall_discord_redirect_url) | Discord OAuth redirect URL. |

## AUTHWALL_SECRET

Root secret used to derive Authwall's session and CSRF secrets.

- Type: string
- Default: generated automatically and stored in `data/secret.key`
- Validation: must be at least 32 characters when set

Set this explicitly when secrets are managed by the runtime, orchestrator, or an external secret store.
If it is not set, Authwall loads `data/secret.key`;
if that file does not exist, Authwall generates a random secret and writes it there.

Rotating this value invalidates existing sessions and CSRF tokens.

Example:

```sh
AUTHWALL_SECRET=$(bin/random-secret)
```

## AUTHWALL_PUBLIC_URL

Public base URL for Authwall.
Authwall uses this value when building redirects and generated links that must point back to the Authwall service.

- Type: URL string
- Default: `http://127.0.0.1:3000`

Set this to the externally visible URL users and OAuth providers use to reach Authwall.
For production, this should usually be an HTTPS URL.

Example:

```sh
AUTHWALL_PUBLIC_URL=https://myapp.com
```

## AUTHWALL_TARGET_URL

URL of the upstream application protected by Authwall.
Requests that pass Authwall authentication and are not handled by `/auth` routes are proxied to this target.

- Type: URL string
- Default: `http://127.0.0.1:8080`

Use the URL that Authwall can reach from its own runtime environment.
In Docker Compose, this is usually a service URL such as `http://echo-server:8080`;
outside Docker it is often a loopback URL.

Example:

```sh
AUTHWALL_TARGET_URL=https://internal-service:8080
```

## AUTHWALL_TARGET_MODE

Controls how Authwall identifies itself when forwarding requests to `AUTHWALL_TARGET_URL`.

- Type: enum
- Values: `direct`, `proxy`
- Default: `direct`

Use `direct` when the upstream should receive requests as if they were sent directly to the target URL.
In this mode, the `Host` header is filled with the domain from `AUTHWALL_TARGET_URL`.

Use `proxy` when the upstream should be aware that Authwall is acting as a reverse proxy.
This enables forwarded headers such as `X-Forwarded-For`, `X-Forwarded-Host`,
and `X-Forwarded-Proto`.

Example:

```sh
AUTHWALL_TARGET_MODE=proxy
```

## AUTHWALL_SET_HEADERS

Headers to add to requests before Authwall forwards them to `AUTHWALL_TARGET_URL`.
These headers are applied after Authwall adds its own authenticated-user header.

- Type: semicolon-separated `Header-Name=value` entries
- Default: none
- Validation: each header name and value must be valid for Node's HTTP client

Use this for static headers the upstream expects on every proxied request.
Header values may be empty.

Example:

```sh
AUTHWALL_SET_HEADERS='X-Team=notes;Authorization=Basic abc:def==;X-Empty='
```

## AUTHWALL_UNSET_HEADERS

Headers to remove from requests before Authwall forwards them to `AUTHWALL_TARGET_URL`.

- Type: semicolon-separated header names
- Default: none
- Validation: each header name must be valid for Node's HTTP client

Use this to prevent client-supplied headers from reaching the upstream, especially headers that the upstream treats as trusted identity or authorization input.

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

Examples:

```sh
AUTHWALL_DB=mysql://authwall:authwall@mysql/authwall
AUTHWALL_DB=postgres://authwall:authwall@postgres/authwall
```

## AUTHWALL_SEED

Bootstrap users created at startup.
Authwall creates missing users and adds missing username or email identities for existing users.

- Type: compact string or JSON array
- Default: none

Compact format:

```sh
AUTHWALL_SEED='admin:change-me:admin@example.com;ops:change-me:ops1@example.com,ops2@example.com'
```

JSON format:

```sh
AUTHWALL_SEED='[{"username":"admin","password":"change-me","emails":["admin@example.com"]}]'
```
