# The app behind Authwall never sees its session cookie

Authwall and the app it protects share one origin, so every cookie the
browser holds for it rides along on every request. Authwall's session cookie
was `connect.sid`, the default name of express-session.

## Before

Run on `3f84274` (AW-19): a signed-in request to `/private/page` reached the
app with `Cookie: connect.sid=s%3A…`, Authwall's live session. The app could
log it, leak it or replay it against Authwall. An app that is itself built on
Express uses the same name for its own session, and the two overwrote each
other.

## Expected

Authwall's cookie is `authwall.sid`, and it never leaves Authwall: neither on
a proxied request, in proxy or direct mode, nor on a WebSocket. A
`connect.sid` that Authwall signed before the rename is dropped too; a
`connect.sid` of the app's own passes untouched.

A browser that still holds only the old cookie signs in once (the author's
pick, 10-25 18:32).

Every session from before the rename ends at the upgrade that brings this:
its old value, sent back under the new name, signs in no more. Everyone signs
in once more (the author's pick, 11-19 03:48).

## Why

The app is told who the user is by `X-Auth-User`. It has no use for the
credential behind it, and holding it is a risk.

1.17 renamed the cookie but kept the sessions, and a session row knows no
cookie name: an old `connect.sid` value, sent back as `authwall.sid`, still
signed in for up to 30 days. Behind the nginx or Caddy sidecar the app was
still sent that value, since the examples cannot tell it from an Express
app's own `connect.sid`; before 1.17 every app was sent it (AW-19).
