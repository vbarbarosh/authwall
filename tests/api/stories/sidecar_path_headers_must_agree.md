# The sidecar's two path headers must agree

Authwall runs as a sidecar with `/favicon.ico` public. Behind Caddy
`forward_auth`, the proxy sets `X-Forwarded-Uri` to the path the client asked
for; behind the nginx recipe, `auth_request` sets `X-Original-URI`. Each
passes the other header through as the client sent it. An anonymous client
asks for `/private/admin` and adds the other header, naming `/favicon.ico`.

## Expected

`/auth/sidecar` answers **401**, behind either proxy: the two headers name
different paths, so the path is unknown and the request is protected. One
header alone, or two that name the same path, is judged as before, so
`/favicon.ico` is still admitted anonymously.

## Why

The sidecar read `X-Original-URI` first. Caddy does not set it, so a
client's copy reached Authwall: a public path in it made Authwall answer 200
without an identity, and Caddy let the private request through (H-02).
Reading only `X-Forwarded-Uri` would open every nginx config that sets
`X-Original-URI` in the same way, from the other side. Each header is
trusted only where its proxy sets it, so a disagreement means a client
wrote one of them.
