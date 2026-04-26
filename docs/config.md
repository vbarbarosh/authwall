# Configuration

## Overview

| Varname                            | Short description                                       |
|------------------------------------|---------------------------------------------------------|
| `LISTEN`                           | Bind address for the HTTP server.                       |
| `PORT`                             | HTTP listen port.                                       |
| `AUTHWALL_SECRET`                  | Root secret for sessions and CSRF protection.           |
| `AUTHWALL_LOGGER`                  | Log destination.                                        |
| `AUTHWALL_PASSWORD_MIN`            | Minimum password length for new passwords.              |
| `AUTHWALL_BCRYPT_ROUNDS`           | bcrypt cost for new password hashes.                    |
| `AUTHWALL_RATE_LIMITING`           | Enables or disables in-memory rate limiting.            |
| `AUTHWALL_PUBLIC_URL`              | Public base URL used for redirects and generated links. |
| `AUTHWALL_TARGET_URL`              | Upstream application URL.                               |
| `AUTHWALL_TARGET_MODE`             | Upstream proxy behavior mode.                           |
| `AUTHWALL_SET_HEADERS`             | Headers to add to upstream requests.                    |
| `AUTHWALL_UNSET_HEADERS`           | Headers to remove from upstream requests.               |
| `AUTHWALL_DB`                      | Database connection URI.                                |
| `AUTHWALL_SEED`                    | Bootstrap users created at startup.                     |
| `AUTHWALL_COOKIE_DOMAIN`           | Session cookie domain.                                  |
| `AUTHWALL_COOKIE_PATH`             | Session cookie path.                                    |
| `AUTHWALL_COOKIE_SAMESITE`         | SameSite value for the session cookie.                  |
| `AUTHWALL_COOKIE_SECURE`           | Whether session cookies require HTTPS.                  |
| `AUTHWALL_ALLOWED_EMAILS`          | Exact email addresses allowed to sign in.               |
| `AUTHWALL_ALLOWED_DOMAINS`         | Email domains allowed to sign in.                       |
| `AUTHWALL_DENIED_EMAILS`           | Exact email addresses denied sign-in.                   |
| `AUTHWALL_DENIED_DOMAINS`          | Email domains denied sign-in.                           |
| `AUTHWALL_MAILER`                  | Mailer provider selection.                              |
| `AUTHWALL_RESEND_KEY`              | Resend API key.                                         |
| `AUTHWALL_RESEND_FROM`             | Resend sender address.                                  |
| `AUTHWALL_MAILJET_KEY`             | Mailjet API key.                                        |
| `AUTHWALL_MAILJET_SECRET`          | Mailjet API secret.                                     |
| `AUTHWALL_MAILJET_FROM`            | Mailjet sender address.                                 |
| `AUTHWALL_SES_KEY`                 | AWS access key id for SES.                              |
| `AUTHWALL_SES_SECRET`              | AWS secret access key for SES.                          |
| `AUTHWALL_SES_REGION`              | AWS SES region.                                         |
| `AUTHWALL_SES_SESSION_TOKEN`       | Optional AWS session token for SES.                     |
| `AUTHWALL_SES_FROM`                | AWS SES sender address.                                 |
| `AUTHWALL_FLOWS`                   | Enabled sign-in flows.                                  |
| `AUTHWALL_MAGIC_LINK`              | Magic-link and magic-code mode.                         |
| `AUTHWALL_GOOGLE_CLIENT_ID`        | Google OAuth client id.                                 |
| `AUTHWALL_GOOGLE_CLIENT_SECRET`    | Google OAuth client secret.                             |
| `AUTHWALL_GOOGLE_REDIRECT_URL`     | Google OAuth redirect URL.                              |
| `AUTHWALL_GITHUB_CLIENT_ID`        | GitHub OAuth client id.                                 |
| `AUTHWALL_GITHUB_CLIENT_SECRET`    | GitHub OAuth client secret.                             |
| `AUTHWALL_GITHUB_REDIRECT_URL`     | GitHub OAuth redirect URL.                              |
| `AUTHWALL_FACEBOOK_CLIENT_ID`      | Facebook OAuth client id.                               |
| `AUTHWALL_FACEBOOK_CLIENT_SECRET`  | Facebook OAuth client secret.                           |
| `AUTHWALL_FACEBOOK_REDIRECT_URL`   | Facebook OAuth redirect URL.                            |
| `AUTHWALL_MICROSOFT_CLIENT_ID`     | Microsoft OAuth client id.                              |
| `AUTHWALL_MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret.                          |
| `AUTHWALL_MICROSOFT_REDIRECT_URL`  | Microsoft OAuth redirect URL.                           |
| `AUTHWALL_TWITTER_CLIENT_ID`       | X OAuth client id.                                      |
| `AUTHWALL_TWITTER_CLIENT_SECRET`   | X OAuth client secret.                                  |
| `AUTHWALL_TWITTER_REDIRECT_URL`    | X OAuth redirect URL.                                   |
| `AUTHWALL_DISCORD_CLIENT_ID`       | Discord OAuth client id.                                |
| `AUTHWALL_DISCORD_CLIENT_SECRET`   | Discord OAuth client secret.                            |
| `AUTHWALL_DISCORD_REDIRECT_URL`    | Discord OAuth redirect URL.                             |
