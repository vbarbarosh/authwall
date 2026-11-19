# A planted cookie behind the nginx sidecar

Bob is signed in to an app that runs behind the nginx sidecar example, or the
nginx recipe of `docs/recipes.md`. The app's own page runs a script, and the
script plants a second session cookie for a public path of its choosing:
`document.cookie = 'authwall.sid=planted; path=/robots.txt'`, then fetches
`/robots.txt`. Bob's browser sends both cookies, the planted one first.

## Before

Run on `f013019` (AW-131): nginx asked `/auth/sidecar`, which admitted the
public path, and took one `authwall.sid` out of the Cookie header with its
pattern, the planted one. The app received Bob's real HttpOnly session
cookie, good on every app behind the same Authwall until the session ends.

## Expected

`/auth/sidecar` refuses a request that carries `authwall.sid` twice, on a
public path too, before it looks at the path: nginx answers it as any
refused request, and the app receives nothing. One cookie is judged as
before. The Caddy example removes every copy with its own expression and
needs no change.

## Why

One pattern in an nginx `map` removes one copy, and a script of the app can
add as many copies as it likes, for any path. Authwall sees the whole Cookie
header, so it refuses what the proxy cannot clean. Sending a cleaned header
back for nginx to set was the other way; it would let a script of the app read
the app's own HttpOnly cookies through `/auth/sidecar`, which the recipes pass
through to Authwall.
