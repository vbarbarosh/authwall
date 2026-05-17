# Getting started

Authwall is an authentication proxy. It sits in front of your app, handles
sign-in, and forwards authenticated requests with an optional `X-Auth-User`
header:

```
client → authwall → your app
```

There are two paths below: a one-command **Quick start** to see Authwall
running immediately, and a **full Docker Compose setup** that puts it in front
of a real app with a persistent database.

## Quick start

The fastest way to see Authwall. This needs only Docker and a free port `3000`:

```sh
docker run --rm -p 3000:3000 \
    -e AUTHWALL_TARGET_URL=http://localhost:8080 \
    vbarbarosh/authwall
```

Open <http://localhost:3000>, choose **Sign up**, and create the first account.

What this gives you:

- **Storage:** SQLite — Authwall's default whenever `AUTHWALL_DB` is not set. No
  database to install or configure. Here it lives inside the container and is
  **discarded when the container stops** (`--rm`); mount a volume at `/app/data`
  to keep it.
- **Sign-in:** username + password, with open registration.
- **Email features:** disabled, since no mailer is configured.

Point `AUTHWALL_TARGET_URL` at your own app to see authenticated requests
proxied through it. For a lasting setup, continue with the Compose walkthrough
below.

## Full setup with Docker Compose

The rest of this guide uses the `docker-compose.yaml` shipped in this
repository. By the end you will have three containers running — Authwall, a
MySQL database, and a demo upstream app — and you will have signed in and seen
a request reach the upstream with the `X-Auth-User` header attached.

## Prerequisites

- Docker with the Compose plugin (`docker compose version` should work).
- Ports `3000` free on the host.

## 1. The Compose file

The repository ships a ready-to-run `docker-compose.yaml` with three services:

| Service       | Image                 | Role                                                  |
|---------------|-----------------------|-------------------------------------------------------|
| `authwall`    | `vbarbarosh/authwall` | The auth proxy, published on host port `3000`         |
| `mysql`       | `mysql:8.4.8`         | Persistent storage for users and sessions             |
| `echo-server` | `jmalloc/echo-server` | A stand-in upstream app that echoes each request back |

The `authwall` service is configured entirely through environment variables:

```yaml
environment:
  AUTHWALL_PUBLIC_URL: http://localhost:3000
  AUTHWALL_TARGET_URL: http://echo-server:8080
  AUTHWALL_DB: mysql://authwall:authwall@mysql/authwall
```

- `AUTHWALL_PUBLIC_URL` — the URL users reach Authwall on. Used to build links
  and redirects.
- `AUTHWALL_TARGET_URL` — the upstream app. Here it points at the `echo-server`
  service by its Compose name. Swap this for your own app's URL.
- `AUTHWALL_DB` — the database connection. When it is unset, Authwall falls
  back to a local SQLite database (as in the Quick start above); the Compose
  file sets it to MySQL instead, with a commented-out PostgreSQL alternative if
  you prefer it.

See the [configuration reference](config.md) for every available variable.

## 2. Create the `.env` file

The `authwall` service declares `env_file: .env`, so Compose expects that file
to exist. For this first run it can be empty:

```sh
touch .env
```

Later, secrets and OAuth credentials go here — for example:

```sh
# .env
AUTHWALL_RESEND_KEY=re_xxx
AUTHWALL_RESEND_FROM=Authwall <noreply@myapp.test>
AUTHWALL_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
AUTHWALL_GOOGLE_CLIENT_SECRET=GOCSPX_xxx
AUTHWALL_GOOGLE_REDIRECT_URL=http://localhost:3000/auth/google/callback
```

## 3. Start the stack

```sh
docker compose up -d
```

On first boot Authwall waits for MySQL to accept connections, then applies its
database migrations automatically — no manual migration step is needed. Watch
the progress with:

```sh
docker compose logs -f authwall
```

You are ready once the log shows the database is ready and the HTTP server is
listening.

## 4. Sign in

Open <http://localhost:3000> in a browser.

With no mailer and no OAuth credentials configured, Authwall starts in its
simplest mode:

- sign-in is **username + password**
- registration is **open** — the first visitor signs up to create the first account
- email-based features are **disabled**

Choose **Sign up**, create a username and password, and you will land on the
proxied upstream app.

## 5. Confirm the proxy works

Because the demo upstream is `echo-server`, the page you see after signing in
is the echo of your own request. Look for the `X-Auth-User` header in that
echoed output — Authwall adds it to every authenticated request so your real
app can identify the signed-in user without implementing sign-in itself.

Requests from a signed-out browser never reach the upstream; they are redirected
to the Authwall sign-in page instead.

## 6. Where data lives

The Compose file mounts host volumes so nothing is lost on restart:

```yaml
volumes:
  - ./data/authwall:/app/data   # Authwall's data dir (incl. the generated secret)
  - ./data/mysql:/var/lib/mysql # MySQL data files
```

`./data/authwall` holds `secret.key`, the root secret Authwall derives session
and CSRF keys from. Keep this directory across restarts, or existing sessions
will be invalidated. See [Secret management](overview.md#secret-management).

## Stopping and resetting

```sh
docker compose down                 # stop the stack, keep all data
docker compose down && rm -rf data  # stop and wipe users, sessions, secret
```

## Next steps

- [Configuration reference](config.md) — every environment variable.
- Point `AUTHWALL_TARGET_URL` at your own app instead of `echo-server`.
- Add a mailer to unlock magic-link sign-in and email confirmation
  (see the `AUTHWALL_MAILER` section of the configuration reference).
- Add OAuth providers (Google, GitHub, Microsoft, Facebook, X, Discord) via
  their `*_CLIENT_ID` / `*_CLIENT_SECRET` / `*_REDIRECT_URL` variables.
- Restrict who may sign in with `AUTHWALL_ALLOWED_EMAILS` /
  `AUTHWALL_ALLOWED_DOMAINS`.
