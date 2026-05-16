# Sign-in flows

A *sign-in flow* is one way a user can authenticate with Authwall. Three
families are available:

| Flow                  | How the user signs in                                                  |
|-----------------------|------------------------------------------------------------------------|
| **Password**          | Username or email address, plus a password                             |
| **Magic link / code** | A one-time link or code delivered by email                             |
| **OAuth**             | An external provider — Google, GitHub, Microsoft, Facebook, X, Discord |

Several flows can be enabled at once; the sign-in page shows every flow that is
turned on. Which flows are active is decided at startup from
[`AUTHWALL_FLOWS`](config.md#authwall_flows) and the supporting variables
described below.

## Choosing flows: `AUTHWALL_FLOWS`

`AUTHWALL_FLOWS` is the final step of configuration. Mailer, OAuth credentials,
password options, and magic-link mode are all resolved first; `AUTHWALL_FLOWS`
then selects among the flows those settings made available.

It accepts either `auto` (the default) or a comma-separated list drawn from:

```
username  email  magic_link  magic_code  magic_link_and_code
google  github  microsoft  facebook  twitter  discord
```

There is no `password` value — password sign-in is requested per identifier
with `username` and/or `email`.

### `auto` mode

In `auto` mode every flow whose prerequisites are already in place is enabled —
**with one important exception**: if any OAuth provider is configured, the
password and magic-link flows are switched *off* in `auto` mode. The assumption
is that once you wire up an external identity provider, you want sign-in to go
through it exclusively.

To run an OAuth provider *alongside* password or magic-link sign-in, list the
flows explicitly instead of relying on `auto`:

```sh
# Google plus username/password — both offered
AUTHWALL_FLOWS=username,google
```

### Explicit lists

When `AUTHWALL_FLOWS` names flows explicitly, each one must already be fully
configured. If a listed flow is missing its prerequisites — for example
`email` without a mailer, or `github` without GitHub credentials — Authwall
refuses to start with an error naming the problem. This is deliberate: it
prevents a flow you asked for from silently not appearing.

---

## Password

Sign-in with a password, identified by a username, an email address, or both.

- `username` — sign in with a username. No mailer required.
- `email` — sign in with an email address. Requires a configured mailer
  (so the address can be confirmed and recovered).

In `auto` mode both are enabled when no OAuth provider is configured;
`email` additionally needs a mailer.

**Pages and routes:**

| Path                           | Purpose                                                                               |
|--------------------------------|---------------------------------------------------------------------------------------|
| `/auth/sign-in`                | Sign-in page                                                                          |
| `/auth/sign-up`                | Registration page — registration is open; the first visitor creates the first account |
| `/auth/password-reset`         | Request a password-reset email                                                        |
| `/auth/password-reset/confirm` | Set a new password from the reset link                                                |
| `/auth/change-password`        | Change the password of the signed-in account (from the profile)                       |

Password length and hashing are governed by
[`AUTHWALL_PASSWORD_MIN` and `AUTHWALL_BCRYPT_ROUNDS`](config.md#passwords).
Password reset requires a mailer regardless of which identifier is used.

```sh
# Username + password only — the zero-config default
AUTHWALL_FLOWS=username

# Username and email, both with passwords (needs a mailer)
AUTHWALL_FLOWS=username,email
```

---

## Magic link / code

Passwordless sign-in: the user enters their email address and receives a
one-time **link**, a one-time **code**, or both. A magic link is also a
sign-up path — a first-time address creates an account.

This flow always requires a configured mailer.

**Which channel users get** is set by
[`AUTHWALL_MAGIC_LINK`](config.md#authwall_magic_link):

- `link` — email contains only a clickable link.
- `code` — email contains only a code the user types into the browser.
- `link_and_code` — email contains both (the default in `auto`).
- `off` / `disabled` — magic-link sign-in is disabled.

In `AUTHWALL_FLOWS`, the channel is requested with `magic_link`, `magic_code`,
or `magic_link_and_code` (shorthand for both). The requested channel must be
compatible with `AUTHWALL_MAGIC_LINK` — asking for `magic_code` while
`AUTHWALL_MAGIC_LINK=link` is a startup error.

**Pages and routes:**

| Path | Purpose |
|---|---|
| `/auth/magic-link` | Request a magic link or code |
| `/auth/magic-link/confirm` | Confirm a link or submit a code |
| `/auth/magic-link/sent` | "Check your email" notice |

```sh
# Magic code only (also set AUTHWALL_MAGIC_LINK=code)
AUTHWALL_FLOWS=magic_code
AUTHWALL_MAGIC_LINK=code
```

---

## OAuth

Sign-in delegated to an external provider — Google, GitHub, Microsoft,
Facebook, X, or Discord. OAuth registration is open by default: anyone with an
account at the provider can sign in, and an Authwall account is created on
first use.

Each provider is requested by name in `AUTHWALL_FLOWS` (`google`, `github`,
`microsoft`, `facebook`, `twitter`, `discord`) and needs its three
`*_CLIENT_ID` / `*_CLIENT_SECRET` / `*_REDIRECT_URL` variables.

Provider setup — where to register the app, redirect URLs, scopes, and
per-provider quirks — is covered in detail in
[OAuth providers](oauth-providers.md).

---

## Combining flows

Flows are additive. A user with multiple identities (say a password and a
linked Google account) can sign in through any of them, and from the profile
page can connect or disconnect providers — except the last remaining sign-in
method, which cannot be removed.

```sh
# Password, magic link, and three OAuth providers, all offered
AUTHWALL_FLOWS=username,email,magic_link,google,github,microsoft
```

## Restricting who can sign in

All flows funnel through the same [access rules](config.md#access-rules)
(`AUTHWALL_ALLOWED_EMAILS`, `AUTHWALL_ALLOWED_DOMAINS`, and the deny lists).
Use them to turn open registration into an allowlist regardless of which flow a
user picks.

## Rate limiting

When [`AUTHWALL_RATE_LIMITING`](config.md#authwall_rate_limiting) is enabled
(the default), the entry points of these flows are rate-limited per client IP:

- Sign-in — 10 requests per 15 minutes.
- Sign-up — 5 requests per hour.
- Password reset — 5 requests per hour.
- Magic-link request — 5 requests per hour.

## Email confirmation

Independently of the flow used to sign in, Authwall can require a user to
confirm an email address before reaching the upstream app. See
[`AUTHWALL_CONFIRM_EMAIL`](config.md#authwall_confirm_email).
