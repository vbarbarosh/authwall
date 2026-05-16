# OAuth providers

Authwall can sign users in through six OAuth providers: **Google**, **GitHub**,
**Microsoft**, **Facebook**, **X** (formerly Twitter), and **Discord**.

This page covers the provider-side setup — where to register an application and
what to copy back. For the environment variables themselves, see the
[configuration reference](config.md).

## How OAuth sign-in works

Each provider exposes three routes:

| Route                         | Method | Purpose                                        |
|-------------------------------|--------|------------------------------------------------|
| `/auth/<provider>`            | GET    | Start sign-in (or sign-up)                     |
| `/auth/<provider>/callback`   | GET    | Where the provider sends the user back         |
| `/auth/<provider>/disconnect` | POST   | Unlink the provider from the signed-in account |

`<provider>` is one of `google`, `github`, `microsoft`, `facebook`, `twitter`,
`discord`.

A few behaviors are the same for every provider:

- **PKCE** — Authwall uses the authorization-code flow with PKCE (`S256`) and a
  signed `state` value. You do not configure anything for this.
- **Sign in vs. connect** — visiting `/auth/<provider>` signs the user in,
  creating an account on first use. From the profile page a signed-in user can
  instead *connect* a provider to their existing account; that path is rejected
  if the provider account is already linked to a different user.
- **Verified emails** — when a provider reports a verified email address,
  Authwall adds it as an email identity on the account (unless another account
  already owns it). Unverified emails are ignored.
- **Access rules** — [`AUTHWALL_ALLOWED_EMAILS` / `AUTHWALL_ALLOWED_DOMAINS` /
  the deny lists](config.md#access-rules) are enforced against those verified
  emails. If any access rule is configured, OAuth sign-in additionally requires
  the provider to report at least one verified email — otherwise sign-in fails
  with *"A verified email is required"*.
- **Disconnect protection** — a provider cannot be disconnected if it is the
  account's only remaining sign-in method.

## Enabling a provider

Each provider needs three environment variables, all required together:

```
AUTHWALL_<PROVIDER>_CLIENT_ID
AUTHWALL_<PROVIDER>_CLIENT_SECRET
AUTHWALL_<PROVIDER>_REDIRECT_URL
```

- With `AUTHWALL_FLOWS=auto` (the default), a provider turns on automatically
  once all three of its variables are set.
- If only some of the three are set, Authwall logs a warning and leaves the
  provider disabled.
- If `AUTHWALL_FLOWS` names the provider explicitly but the three variables are
  not all set, Authwall refuses to start.

The redirect URL must point back at Authwall's callback route and must exactly
match what you register with the provider:

```
<AUTHWALL_PUBLIC_URL>/auth/<provider>/callback
```

For example, with `AUTHWALL_PUBLIC_URL=https://myapp.test`, Google's redirect
URL is `https://myapp.test/auth/google/callback`. For local development it is
typically `http://localhost:3000/auth/google/callback`.

---

## Google

- **Console:** Google Cloud Console → APIs & Services → Credentials.
- **Create:** an *OAuth client ID* of type *Web application*.
- **Authorized redirect URI:** `<AUTHWALL_PUBLIC_URL>/auth/google/callback`.
- **Scopes requested:** `openid email profile`.
- **Copy back:** the client ID and client secret.

An email is treated as verified only when Google reports `email_verified` for
it.

```sh
AUTHWALL_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
AUTHWALL_GOOGLE_CLIENT_SECRET=GOCSPX-...
AUTHWALL_GOOGLE_REDIRECT_URL=https://myapp.test/auth/google/callback
```

## GitHub

- **Console:** GitHub → Settings → Developer settings → OAuth Apps → *New OAuth App*.
- **Authorization callback URL:** `<AUTHWALL_PUBLIC_URL>/auth/github/callback`.
- **Scopes requested:** `user:email`.
- **Copy back:** the client ID, and a generated client secret.

GitHub may report several addresses. Authwall keeps every *verified* address and
adds the primary one first.

```sh
AUTHWALL_GITHUB_CLIENT_ID=Iv1.abcdef1234567890
AUTHWALL_GITHUB_CLIENT_SECRET=ghs_...
AUTHWALL_GITHUB_REDIRECT_URL=https://myapp.test/auth/github/callback
```

## Microsoft

- **Console:** Microsoft Entra admin center → Identity → Applications → App registrations.
- **Create:** a new registration; under *Authentication* add a *Web* platform.
- **Redirect URI:** `<AUTHWALL_PUBLIC_URL>/auth/microsoft/callback`.
- **Client secret:** create one under *Certificates & secrets* and copy the
  secret *value* (not the secret ID).
- **Scopes requested:** `openid email profile`.

Authwall uses the `common` authority, so both personal Microsoft accounts and
work/school (Entra) accounts can sign in.

```sh
AUTHWALL_MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
AUTHWALL_MICROSOFT_CLIENT_SECRET=...
AUTHWALL_MICROSOFT_REDIRECT_URL=https://myapp.test/auth/microsoft/callback
```

## Facebook

- **Console:** Meta for Developers → My Apps → your app → add the *Facebook Login* product.
- **Valid OAuth Redirect URI:** `<AUTHWALL_PUBLIC_URL>/auth/facebook/callback`
  (Facebook Login → Settings).
- **Scopes requested:** `email`.
- **Copy back:** the App ID and App Secret (Settings → Basic).

Facebook returns an email address only if the user grants the `email`
permission; accounts that decline it, or that have no email on file, sign in
without an email identity.

```sh
AUTHWALL_FACEBOOK_CLIENT_ID=1234567890123456
AUTHWALL_FACEBOOK_CLIENT_SECRET=...
AUTHWALL_FACEBOOK_REDIRECT_URL=https://myapp.test/auth/facebook/callback
```

## X (formerly Twitter)

The environment variables keep their `TWITTER` names for compatibility, even
though the product is now called X.

- **Console:** X Developer Portal → Projects & Apps → your app → *User authentication settings*.
- **App type:** *Web App* / *Confidential client* — Authwall authenticates the
  token request with HTTP Basic credentials, which X requires for confidential
  clients.
- **Callback URI:** `<AUTHWALL_PUBLIC_URL>/auth/twitter/callback`.
- **Scopes requested:** `tweet.read users.read users.email`.
- **Copy back:** the OAuth 2.0 Client ID and Client Secret.

The `users.email` scope is what lets Authwall read the account's confirmed
email; without it the user signs in without an email identity.

```sh
AUTHWALL_TWITTER_CLIENT_ID=...
AUTHWALL_TWITTER_CLIENT_SECRET=...
AUTHWALL_TWITTER_REDIRECT_URL=https://myapp.test/auth/twitter/callback
```

## Discord

- **Console:** Discord Developer Portal → Applications → your application → OAuth2.
- **Redirect:** add `<AUTHWALL_PUBLIC_URL>/auth/discord/callback` under *Redirects*.
- **Scopes requested:** `identify email`.
- **Copy back:** the Client ID and Client Secret.

An email is treated as verified only when the Discord account itself is
verified.

```sh
AUTHWALL_DISCORD_CLIENT_ID=1234567890123456789
AUTHWALL_DISCORD_CLIENT_SECRET=...
AUTHWALL_DISCORD_REDIRECT_URL=https://myapp.test/auth/discord/callback
```

---

## Limiting OAuth sign-in to specific users

OAuth registration is open by default — anyone with an account at the provider
can sign in. To restrict access, combine a provider with the
[access rules](config.md#access-rules). For example, allow only two named
addresses to sign in with Google:

```sh
AUTHWALL_ALLOWED_EMAILS=alice@example.com,bob@example.com
```

Because access rules are checked against the provider's *verified* emails, this
also means a provider that reports no verified email cannot be used to sign in
while any access rule is active.

## Troubleshooting

- **Provider not offered on the sign-in page** — one of the three variables is
  missing. Authwall logs a warning naming the provider at startup.
- **"redirect_uri mismatch" from the provider** — the URL registered with the
  provider does not exactly match `AUTHWALL_<PROVIDER>_REDIRECT_URL` (scheme,
  host, port, and path must all match).
- **"Invalid OAuth state"** — the sign-in was not completed in the same browser
  session it started in, or the session cookie was lost. Check
  [cookie settings](config.md#session-cookie) when Authwall runs behind another
  proxy.
- **"A verified email is required"** — an access rule is configured but the
  provider returned no verified email for this account.
