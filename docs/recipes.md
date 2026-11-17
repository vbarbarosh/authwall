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

## Only the users you name

A fixed set of people and nobody else: the seed makes their accounts, and
[`AUTHWALL_SIGN_UP=off`](config.md#authwall_sign_up) lets no one make
another. No mail service needed.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_SEED='alice:change-me-1;bob:change-me-2;carol:change-me-3' \
    -e AUTHWALL_SIGN_UP=off \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- the sign-in page has no **Create one** link and says nothing of
  registration; a sign-up sent anyway is refused, and no account is made
- alice, bob and carol sign in with their usernames and passwords, and change
  the password from the profile
- to add someone, add them to the seed and restart; the accounts already
  there are left as they are
- taking a name out of the seed leaves its account, which still signs in:
  the person removes it from the profile

### From a file of users

A longer list, or no passwords in plain text:
[`AUTHWALL_SEED_FILE`](config.md#authwall_seed_file) reads the users from a
CSV file, each password kept as its bcrypt hash. `./data/authwall/users.csv`:

```
username,emails,display_name,password_hash
alice,alice@myapp.test,Alice,$2b$12$5L5bc20D5Pw8ojbI/FiwPOih6AI08HsdR71vgglDpTTxe9X0rGX3e
bob,bob@myapp.test,Bob,$2b$12$RGEFicUo.RhlLMoygJs43ebk4hyWYf2VQFTNRNd8X.YF290yPT3km
```

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_SEED_FILE=/app/data/users.csv \
    -e AUTHWALL_SIGN_UP=off \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

The two hashes above are `alice-pass-1` and `bob-pass-1`. A hash for someone
new:

```sh
docker run --rm vbarbarosh/authwall bin/password-hash 'carol-pass-1'
```

- the first line names the columns; one missing, one unknown or a plain
  `password` column stops startup, and the log says why
- the rest is as above: no sign-up; to add someone, add a line and restart

## Sign in by email, no passwords

People type their address and get a one-time link and code by email: no
passwords to choose, forget or leak. Needs a mail service:
[Resend](config.md#authwall_resend_key) here, or one of the
[others](config.md#authwall_mailer).

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_PUBLIC_URL=https://myapp.test \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_RESEND_KEY=re_xxx \
    -e AUTHWALL_RESEND_FROM='Authwall <noreply@myapp.test>' \
    -e AUTHWALL_FLOWS=magic_link_and_code \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- the sign-in page offers only **Send me a magic link**; the email carries a
  link and a 6-digit code, and the code works only in the browser that asked
- [`AUTHWALL_FLOWS`](config.md#authwall_flows) keeps passwords out: with a
  mail service and the default `auto`, the password form and **Create one**
  would be offered too
- an address signing in for the first time gets its account; to let in only
  your team, add `AUTHWALL_ALLOWED_DOMAINS=myapp.test`
  ([access rules](config.md#access-rules))
- the link in the email points at `AUTHWALL_PUBLIC_URL`: set it to the
  address people open

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

## A few Google accounts only

Named people sign in with their Google accounts; any other account is turned
away, even one at the same domain. Needs the same
[Google OAuth client](oauth-providers.md#google) as above.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_PUBLIC_URL=https://myapp.test \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
    -e AUTHWALL_GOOGLE_CLIENT_SECRET=GOCSPX_xxx \
    -e AUTHWALL_GOOGLE_REDIRECT_URL=https://myapp.test/auth/google/callback \
    -e AUTHWALL_ALLOWED_EMAILS=alice@myapp.test,bob@myapp.test,carol@myapp.test \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- the sign-in page shows only **Continue with Google**: no password form, no
  sign-up form; a listed address gets its account at its first sign-in
- any address not in the list is refused, a Google account that signed in
  before the list was set too
- to add or remove someone, edit the list and restart; a removed address is
  refused at its next request ([access rules](config.md#access-rules))

## Team sign-in with Microsoft

Everyone at one company signs in with their Microsoft work account; nobody
else gets in. Needs a [Microsoft Entra app registration](oauth-providers.md#microsoft)
with `https://myapp.test/auth/microsoft/callback` as a redirect URI and the
optional claim `xms_edov` on its ID token.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_PUBLIC_URL=https://myapp.test \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000 \
    -e AUTHWALL_MICROSOFT_CLIENT_SECRET=xxx \
    -e AUTHWALL_MICROSOFT_REDIRECT_URL=https://myapp.test/auth/microsoft/callback \
    -e AUTHWALL_ALLOWED_DOMAINS=myapp.test \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

- only **Continue with Microsoft** is offered: configuring an OAuth provider
  [turns the password flows off](sign-in-flows.md#auto-mode)
- an address counts only when Microsoft vouches that its domain belongs to the
  account's company (`xms_edov`); without that claim the account has no
  verified email, and the domain rule refuses it
- personal Microsoft accounts and other companies' accounts are refused; a
  `@myapp.test` account gets its own account at its first sign-in

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

The deliberate setup: a real-time app whose browser or non-browser clients
hold WebSocket connections through Authwall.
[`AUTHWALL_WEBSOCKETS`](config.md#authwall_websockets) proxies upgrades.

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_PUBLIC_URL=https://myapp.test \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -e AUTHWALL_WEBSOCKETS=true \
    -v ./data/authwall:/app/data \
    vbarbarosh/authwall
```

Browser clients authenticate with the signed session cookie from sign-in. The
browser attaches the cookie automatically, and Authwall checks that the
WebSocket `Origin` matches the configured public URL:

```js
const ws = new WebSocket('wss://myapp.test/realtime');
```

Non-browser clients can authenticate the upgrade with the `Authorization`
header on the handshake when personal access tokens are enabled:

```js
const ws = new WebSocket('wss://myapp.test/realtime', {
    headers: {Authorization: 'Bearer awp_…'},
});
```

- upgrades are accepted on any path not under `/auth/`; Authwall validates
  the session cookie or bearer token, strips client-supplied auth headers, and
  forwards the upgrade with the same trusted `X-Auth-User` header it sets on
  HTTP requests
- failed upgrade attempts share the
  [bearer-token rate limiter](security.md#rate-limiting) with HTTP requests
  when the upgrade uses a bearer token

## With Docker Compose

`docker run` is fine for one container, but once Authwall has a database and an
app of its own to manage, a `docker-compose.yaml` keeps the whole stack in one
declarative file. Save any block below as `docker-compose.yaml` and run:

```sh
docker compose up
```

Each uses `jmalloc/echo-server` as a stand-in upstream so the `X-Auth-User`
header is visible in the echoed response — swap it for your own app. For the
reverse-proxy and sidecar topologies, see the runnable
[deployment examples](examples/).

### Protect an app

The Compose form of [keeping your data](#protect-an-app-and-keep-its-data):
Authwall, your app, and a volume so users, sessions, and the secret survive
`docker compose down`.

```yaml
services:

  authwall:
    image: vbarbarosh/authwall
    restart: unless-stopped
    environment:
      AUTHWALL_PUBLIC_URL: http://localhost:3000
      AUTHWALL_UPSTREAM_URL: http://app:8080
    ports:
      - 3000:3000
    volumes:
      - ./data/authwall:/app/data
    depends_on:
      - app

  app:
    image: jmalloc/echo-server
    restart: unless-stopped
```

- Authwall reaches the upstream as `app:8080` over the Compose network; the app
  is never published, so it is reachable **only** through Authwall
- `./data/authwall` holds the SQLite database and `secret.key` — keep it across
  restarts (see [Secret management](overview.md#secret-management))

### Back it with PostgreSQL

SQLite is fine for a single instance; point [`AUTHWALL_DB`](config.md#authwall_db)
at a real database when you want managed backups or
[more than one Authwall replica](#two-copies-one-database). Authwall waits for the database, then applies its migrations on first
boot — no manual migration step.

```yaml
services:

  authwall:
    image: vbarbarosh/authwall
    restart: unless-stopped
    environment:
      AUTHWALL_PUBLIC_URL: http://localhost:3000
      AUTHWALL_UPSTREAM_URL: http://app:8080
      AUTHWALL_DB: postgres://authwall:authwall@postgres/authwall
    ports:
      - 3000:3000
    volumes:
      - ./data/authwall:/app/data
    depends_on:
      - postgres
      - app

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: authwall
      POSTGRES_USER: authwall
      POSTGRES_PASSWORD: authwall
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  app:
    image: jmalloc/echo-server
    restart: unless-stopped
```

- users and sessions now live in Postgres; `./data/authwall` still holds
  `secret.key`, so keep it too — losing the secret signs everyone out
- for MySQL instead, swap the image and the URL scheme:
  `AUTHWALL_DB: mysql://authwall:authwall@mysql/authwall`
  (the [getting-started walkthrough](getting-started.md) is a full MySQL stack)

### Two copies, one database

Two Authwall containers on one Postgres, behind one Caddy: either copy answers
any request, so one can restart or fail while the other keeps everyone signed
in. Save this `Caddyfile` next to `docker-compose.yaml`:

```
:3000 {
	reverse_proxy authwall-1:3000 authwall-2:3000 {
		health_uri /auth/health
		lb_try_duration 5s
	}
}
```

```yaml
x-authwall: &authwall
  image: vbarbarosh/authwall
  restart: unless-stopped
  environment:
    AUTHWALL_PUBLIC_URL: http://localhost:3000
    AUTHWALL_UPSTREAM_URL: http://app:8080
    AUTHWALL_DB: postgres://authwall:authwall@postgres/authwall
  volumes:
    - ./data/authwall:/app/data
  depends_on:
    - postgres
    - app

services:

  caddy:
    image: caddy:alpine
    restart: unless-stopped
    ports:
      - 3000:3000
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on:
      - authwall-1
      - authwall-2

  authwall-1: *authwall
  authwall-2: *authwall

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: authwall
      POSTGRES_USER: authwall
      POSTGRES_PASSWORD: authwall
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  app:
    image: jmalloc/echo-server
    restart: unless-stopped
```

- sessions, tokens and sign-in links live in Postgres: signed in on one copy
  is signed in on both, and signing out on one ends the session on both
- both copies share `./data/authwall`, so they sign cookies with the same
  `secret.key` and serve the same profile pictures; on two machines, set the
  same [`AUTHWALL_SECRET`](config.md#authwall_secret) on both and share
  `data/uploads`, or a cookie from one copy is refused by the other
- Caddy asks each copy's `/auth/health` and sends a request on to the other
  copy when one does not answer: stop one, and the other answers every request
- each copy counts sign-in tries on its own: with two, an address gets up to
  twice as many before **Too many requests**
- one proxy in front is what the default
  [`AUTHWALL_TRUST_PROXY=hops/1`](config.md#authwall_trust_proxy) expects, so
  the limits and the audit log see each client's own address
- the two copies start together on an empty database: the second waits while
  the first applies the migrations

### The full setup

Everything from the progression above in one file: a seeded admin, personal
access tokens, and WebSockets, on Postgres.

```yaml
services:

  authwall:
    image: vbarbarosh/authwall
    restart: unless-stopped
    environment:
      AUTHWALL_PUBLIC_URL: http://localhost:3000
      AUTHWALL_UPSTREAM_URL: http://app:8080
      AUTHWALL_DB: postgres://authwall:authwall@postgres/authwall
      AUTHWALL_SEED: 'admin:change-me:admin@myapp.test'
      AUTHWALL_PERSONAL_ACCESS_TOKENS: "true"
      AUTHWALL_WEBSOCKETS: "true"
    ports:
      - 3000:3000
    volumes:
      - ./data/authwall:/app/data
    depends_on:
      - postgres
      - app

  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: authwall
      POSTGRES_USER: authwall
      POSTGRES_PASSWORD: authwall
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  app:
    image: jmalloc/echo-server
    restart: unless-stopped
```

- [`AUTHWALL_SEED`](config.md#authwall_seed) creates the `admin` user on first
  boot; sign in with `admin` / `change-me` and change the password from the
  profile
- [personal access tokens](config.md#authwall_personal_access_tokens) let
  signed-in users mint bearer tokens, and
  [`AUTHWALL_WEBSOCKETS`](config.md#authwall_websockets) proxies upgrades that
  authenticate with a browser session cookie or bearer token
- it runs over plain HTTP here; in production set `AUTHWALL_PUBLIC_URL` to your
  `https://` origin and the session cookie becomes `Secure` automatically
  (see [Deployment](deployment.md))

To stop the stack and wipe users, sessions, and the secret:

```sh
docker compose down && rm -rf data
```

## Going further

- [Getting started](getting-started.md) — the same progression as a Docker
  Compose walkthrough with MySQL.
- [Deployment](deployment.md) — HTTPS, production databases, health checks,
  and the production checklist.
- [Deployment examples](examples/) — runnable Compose setups for the direct,
  reverse-proxy, and sidecar topologies.
