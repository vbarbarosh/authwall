# A sidecar decision is never cached

nginx asks `/auth/sidecar` before each request to the app, as the sidecar
examples do. Ann is signed in; anonymous visitors come too, to public,
optional and private paths.

## Before

Run on `abab04f` (AW-172): a signed-in `200` carried Ann's `X-Auth-User` and
no `Cache-Control`, as did every other decision. `/auth/status` already said
`no-store`. A cache put in front of the check, keyed by its URL, could have
handed Ann's answer to the next visitor.

## Expected

Every answer says `Cache-Control: no-store`: the signed-in `200`, the
anonymous `200` of a public or optional path, the `401` of a private one,
the `403` of an unconfirmed account, and the `401` of a cookie sent twice.

## Why

A decision holds for one request, its credential and its path; nothing in
it is worth keeping.
