# Recipes

Runnable setups, ordered from the smallest possible start to a deliberate
deployment with API tokens and WebSockets. Every command works as-is — swap
the example values for your own. For what each variable does, see the
[configuration reference](config.md).

## Just run it (one line)

```sh
docker run --rm -p 3000:3000 vbarbarosh/authwall
```

Open <http://localhost:3000>, choose **Sign up**, and create the first
account.

- sign-in: **username + password**, open registration
- storage: **SQLite inside the container** — discarded on stop (`--rm`)
- upstream: **none yet** — after sign-in, proxying fails until
  `AUTHWALL_UPSTREAM_URL` points at a real app (next recipe)

## Protect an app and keep its data

The first real setup: point Authwall at your app and mount a volume so users,
sessions, and the generated secret survive restarts.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- every request not under `/auth` is proxied to the upstream; authenticated
  requests carry [`X-Auth-User`](security.md#the-x-auth-user-trust-boundary)
- `./data/authwall` holds the SQLite database and `secret.key` — keep it, or
  every restart signs everyone out
  (see [Secret management](overview.md#secret-management))
- the upstream must be reachable **only** through Authwall, or the header can
  be forged

## Bootstrap an admin user

[`AUTHWALL_SEED`](config.md#authwall_seed) creates users at startup, so an
instance comes up with a known account instead of relying on whoever signs up
first.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_SEED='admin:change-me:admin@myapp.test' \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- the `admin` user exists on first boot; sign in with `admin` / `change-me`
  and change the password from the profile
- already-existing users are left alone, so the variable is safe to keep set
  across restarts

## Team sign-in with Google

Everyone at one domain signs in with their Google account; nobody else gets
in. Needs a [Google OAuth client](oauth-providers.md#google) with
`https://myapp.test/auth/google/callback` as an authorized redirect URI.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_PUBLIC_URL=https://myapp.test \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
    -e AUTHWALL_GOOGLE_CLIENT_SECRET=GOCSPX_xxx \
    -e AUTHWALL_GOOGLE_REDIRECT_URL=https://myapp.test/auth/google/callback \
    -e AUTHWALL_ALLOWED_DOMAINS=myapp.test \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- only Google is offered — in `auto` mode, configuring an OAuth provider
  [turns the password flows off](sign-in-flows.md#auto-mode)
- the [access rules](config.md#access-rules) admit only verified
  `@myapp.test` Google accounts; everyone else is rejected
- ban a single address on top of the domain rule with
  `AUTHWALL_DENIED_EMAILS=fired@myapp.test`

## API clients with personal access tokens

Browser sessions don't help a script or a CI job.
[`AUTHWALL_PERSONAL_ACCESS_TOKENS`](config.md#authwall_personal_access_tokens)
lets signed-in users mint bearer tokens from the profile page.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_PERSONAL_ACCESS_TOKENS=true \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

An API client sends the token on every request and reaches the upstream as
its owner:

```sh
curl -H 'Authorization: Bearer awp_…' https://myapp.test/api/things
curl -H 'Authorization: Bearer awp_…' https://myapp.test/auth/status
```

- the raw token is shown once at creation; Authwall stores only a hash
- a token authenticates upstream requests and `/auth/status`, but
  [cannot manage the account](config.md#what-bearer-tokens-cannot-do) —
  no creating tokens, changing passwords, or deleting the account

## WebSockets behind Authwall

The deliberate setup: a real-time app whose non-browser clients (desktop
apps, workers) hold WebSocket connections through Authwall.
[`AUTHWALL_WEBSOCKETS`](config.md#authwall_websockets) proxies upgrades, and
since upgrades authenticate with a bearer token, personal access tokens must
be enabled too.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_PUBLIC_URL=https://myapp.test \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_PERSONAL_ACCESS_TOKENS=true \
    -e AUTHWALL_WEBSOCKETS=true \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

A client authenticates the upgrade with the `Authorization` header on the
handshake:

```js
const ws = new WebSocket('wss://myapp.test/realtime', {
    headers: {Authorization: 'Bearer awp_…'},
});
```

- upgrades are accepted on any path not under `/auth/`; Authwall validates
  the token, strips the credential, and forwards the upgrade with the same
  trusted `X-Auth-User` header it sets on HTTP requests
- the browser `WebSocket` API cannot set the `Authorization` header, so this
  path is for non-browser clients; there is no cookie-based WebSocket
  authentication yet
- failed upgrade attempts share the
  [bearer-token rate limiter](security.md#rate-limiting) with HTTP requests

## Going further

- [Getting started](getting-started.md) — the same progression as a Docker
  Compose walkthrough with MySQL.
- [Deployment](deployment.md) — HTTPS, production databases, health checks,
  and the production checklist.
- [Deployment examples](examples/) — runnable Compose setups for the direct,
  reverse-proxy, and sidecar topologies.
