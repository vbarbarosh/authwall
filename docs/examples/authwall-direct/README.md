# authwall-direct

Authwall is the entrypoint. Clients connect to Authwall directly; it handles
sign-in and proxies authenticated requests to the upstream app.

```
client → authwall → app
```

This is the simplest topology — no reverse proxy involved. It matches the
`docker-compose.yaml` shipped at the repository root, minus the external
database (this example uses SQLite).

## Run it

```sh
docker compose up
```

Then open <http://localhost:3000>, choose **Sign up**, and create an account.
After signing in you land on the `echo-server` upstream, which echoes your
request back — look for the `X-Auth-User` header Authwall added.

## What to change for your app

- `AUTHWALL_TARGET_URL` — point it at your own app instead of `app:8080`.
- `AUTHWALL_PUBLIC_URL` — set it to the URL users actually reach Authwall on.
- `AUTHWALL_TARGET_MODE` — leave it `direct` while one app sits behind
  Authwall. Switch to `proxy` only when the upstream is a reverse proxy serving
  several domains (see the [`authwall-proxy-nginx`](../authwall-proxy-nginx/)
  example).

## Notes

- Storage is SQLite, kept in `./data` along with the generated session secret.
- This example serves plain HTTP. For HTTPS, terminate TLS at a cloud load
  balancer in front of Authwall, and set `AUTHWALL_PUBLIC_URL` to the `https://`
  address.
