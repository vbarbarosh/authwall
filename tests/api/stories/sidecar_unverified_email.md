# Sidecar auth check and an unverified email

Authwall is deployed as a sidecar auth checker: nginx `auth_request` (or Caddy
`forward_auth`) asks `/auth/sidecar` on every request and, on **200**, copies
`X-Auth-User` onto the upstream request. Authwall is not in the data path.

A user signs up with email and password while
`AUTHWALL_CONFIRM_EMAIL_REQUIRED` is on, and does not confirm the address yet.
Later they click the verification link and retry.

## Expected

While the email is unconfirmed, `/auth/sidecar` answers **403** and sends no
`X-Auth-User` — the same decision the proxy path makes when it redirects the
user to the confirmation step. Once the email is confirmed, `/auth/sidecar`
answers **200** with the header, and the reverse proxy lets the request through.

## Why

`AUTHWALL_CONFIRM_EMAIL_REQUIRED` is an authorization rule, not a UI detail, so
it has to hold in every topology Authwall supports. A sidecar deployment that
admitted users the proxy path holds back would silently weaken the gate for
exactly the operators who chose to keep Authwall out of the data path — and the
weaker check is invisible from the reverse-proxy side, which only sees a status
code.
