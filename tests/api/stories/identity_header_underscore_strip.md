# An underscore identity header must not reach the upstream

Mocha is signed in and browses the protected app through Authwall. On one
request Mocha's client attaches its own identity headers: `X-Auth-User:
somebody-else` and, in the underscore spelling, `X_Auth_User: somebody-else`.
The same is tried on a WebSocket upgrade.

## Expected

The upstream receives exactly one `X-Auth-User`, set by Authwall to Mocha's
own account uid. Neither the dash form nor the underscore form the client sent
survives; no `x_auth_user` (or any other `x-auth-*` / `x_auth_*` variant)
reaches the app. The WebSocket upgrade behaves the same.

## Why

Authwall's whole guarantee is that the upstream can trust `X-Auth-User`
because Authwall strips every inbound copy and sets that header itself. The
strip matched a literal `x-auth-` prefix, but Node keeps a client's
`X_Auth_User` as `x_auth_user`, which does not start with `x-auth-` and so was
forwarded untouched. Several upstreams fold `_` onto `-` when they expose
headers — PHP's CGI/FPM mapping turns both `X-Auth-User` and `X_Auth_User`
into the one `HTTP_X_AUTH_USER`, and Apache `mod_php` does the same — so an
unstripped underscore header could reach the app as an `X-Auth-User` Authwall
never set, letting a request carry a forged identity through the gateway.

Both the HTTP proxy and the WebSocket upgrade now decide with
`is_inbound_identity_header`, which reads underscores as dashes before testing
the `x-auth-` prefix, so every spelling is removed and only Authwall's own
header remains (`src/create_app.js`,
[`identity_header_underscore_strip.test.js`](identity_header_underscore_strip.test.js)).
