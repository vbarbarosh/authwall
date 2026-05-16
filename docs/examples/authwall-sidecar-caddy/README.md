# authwall-sidecar-caddy

Several domains behind Caddy, with Authwall as a sidecar auth checker. Caddy
serves each domain's app directly and consults Authwall only for an auth
decision, using Caddy's `forward_auth` directive. Authwall is **not** in the
data path.

```
client → caddy → { apps, notes, echo }
            ↑ auth check
         authwall
```

Use this topology when you want Authwall out of the request path — for
performance or isolation — and only need it to answer "is this user signed
in?" on each request.

## Set up local hostnames

The example uses three domains, so add them to your hosts file — `/etc/hosts`
on Linux/macOS, `C:\Windows\System32\drivers\etc\hosts` on Windows:

```
127.0.0.1 apps.mydomain.test
127.0.0.1 notes.mydomain.test
127.0.0.1 echo.mydomain.test
```

## Run it

```sh
docker compose up
```

Then open any of the three domains on port 3000:

- <http://apps.mydomain.test:3000>
- <http://notes.mydomain.test:3000>
- <http://echo.mydomain.test:3000>

You are redirected to Authwall's sign-in page, served under `/auth` on the same
domain; sign up, and you are sent back to the app you started from. Because the
session cookie is scoped to `mydomain.test` (`AUTHWALL_COOKIE_DOMAIN`), that one
sign-in is valid across all three domains. Each `echo-server` response shows the
`X-Auth-User` header Caddy attached from Authwall's auth decision.

## How it works

`Caddyfile` is mounted over `/etc/caddy/Caddyfile`. A `(gate)` snippet holds the
shared logic, and each domain is a site block that imports it with its own
backend app:

- **`/auth/*`** is proxied to Authwall — its sign-in UI, OAuth callbacks, and
  the `/auth/sidecar` endpoint.
- **everything else** is the protected app. `forward_auth` makes a subrequest
  to Authwall's `/auth/sidecar`; on **200** Caddy copies `X-Auth-User` and
  proxies to the app; on **401** it redirects the browser to the sign-in page
  with a relative `return` path so the user comes back.

`AUTHWALL_COOKIE_DOMAIN=mydomain.test` scopes the session cookie to every
`*.mydomain.test` domain, so one sign-in covers all of them.

## Security notes

- `X-Auth-User` is taken from the auth subrequest's trusted response — the app
  can rely on it.
- The apps are reachable only through Caddy — do not publish the `apps` /
  `notes` / `echo` services directly, or requests would bypass the auth check.

## What to change for your app

- Replace the `apps` / `notes` / `echo` services with your own apps.
- Add or edit the per-domain site blocks in the `Caddyfile` to match your
  domains.
- The `/auth/` path prefix is reserved for Authwall on every domain — if an app
  has its own routes under `/auth/`, route them more specifically.
- For HTTPS, give the domains real names and drop the `http://` prefix — Caddy
  then obtains certificates automatically; set `AUTHWALL_PUBLIC_URL` to match.
