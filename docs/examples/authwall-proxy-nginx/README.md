# authwall-proxy-nginx

Several domains behind a single Authwall. Authwall authenticates every request,
then forwards it to an nginx reverse proxy that routes each domain to its own
app.

```
client → authwall → nginx → { apps, notes, echo }
```

Authwall always has exactly one upstream. Here that upstream is the nginx
router, and `AUTHWALL_TARGET_MODE=proxy` makes Authwall preserve the client's
original `Host` header so nginx can tell the domains apart.

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

Open any of the three domains on port 3000:

- <http://apps.mydomain.test:3000>
- <http://notes.mydomain.test:3000>
- <http://echo.mydomain.test:3000>

Choose **Sign up** on any one of them and create an account. Because the
session cookie is scoped to `mydomain.test` (`AUTHWALL_COOKIE_DOMAIN`), that one
sign-in is valid across all three domains.

Each app is a `jmalloc/echo-server` that echoes the request back. The echoed
`Host` header shows which domain reached which app — proof that Authwall
preserved the `Host` and nginx routed on it.

## How it works

- `authwall` is the only published service (port 3000); all three domains
  resolve to it.
- `AUTHWALL_TARGET_MODE=proxy` tells Authwall to keep the client's original
  `Host` header when forwarding to its single upstream, `http://nginx`.
- `nginx.conf` is the router: a `map` turns the request `Host` into the
  matching upstream, and a single `server` block proxies to it — or returns
  `404` for an unknown domain. It is the whole nginx config, mounted over
  `/etc/nginx/nginx.conf`.
- `AUTHWALL_COOKIE_DOMAIN=mydomain.test` shares the session across the
  subdomains, so users sign in once.

## What to change for your app

- Replace the `apps` / `notes` / `echo` services with your own apps.
- Edit the `map $host $upstream` entries in `nginx.conf` to match your domains.
- For production, give the domains real DNS records, and terminate TLS at a
  load balancer in front of Authwall; set `AUTHWALL_PUBLIC_URL` to the
  `https://` address.
