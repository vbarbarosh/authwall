# A request with Expect gets every header rule

Authwall runs in proxy mode. The operator pins `X-Role=viewer` and a shared
secret with `AUTHWALL_SET_HEADERS`, and drops `Remote-User` with
`AUTHWALL_UNSET_HEADERS`. A client sends its own `X-Forwarded-For`,
`X-Real-IP`, `Forwarded`, `X-Original-URL`, `X-Role: admin` and
`Remote-User: admin`, and adds `Expect: 100-continue`, as curl and .NET
clients do by themselves on a large body.

## Before

Run on `e042d17` (AW-118): the same signed-in POST with `Expect` reached the
app with no `X-Auth-User`, with Authwall's live session cookie, the client's
`X-Forwarded-For`, `X-Role: admin` and `Remote-User: admin`, and without the
operator's secret. An anonymous GET on a public path passed the client's
headers too. A WebSocket upgrade with `Expect` threw "Cannot set headers after
they are sent", and an upstream that was down then ended the process (AW-121).

## Expected

A request with `Expect: 100-continue` reaches the app exactly as the same
request without it, over HTTP and over a WebSocket upgrade, signed in or
anonymous: `X-Auth-User` set, the session cookie and the client's forwarded
headers gone, the operator's headers set and dropped. The app is not sent
`Expect`: Node has already answered it.

## Why

Authwall changed the outgoing headers in the proxy library's `proxyReq` and
`proxyReqWs` events. httpxy does not emit `proxyReq` for a request with
`Expect`, and on an upgrade `proxyReqWs` comes once Node has already written
the headers, so every rule was skipped or failed. The rules are now applied
to the request's own headers before the proxy is called, the Host of direct
mode with them, in the order `docs/config.md` describes.
