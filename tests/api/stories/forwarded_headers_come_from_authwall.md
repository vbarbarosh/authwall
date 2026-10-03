# The upstream's forwarded headers come from Authwall, not the client

Authwall runs in proxy mode, in front of a routing proxy that trusts it as its
only hop. A client sends its own `X-Forwarded-For: 6.6.6.6`,
`X-Forwarded-Host: evil.test`, `X-Forwarded-Proto: https`, `X-Real-IP` and
`X-Forwarded-Prefix`, over HTTP and over a WebSocket upgrade.

## Expected

The upstream receives `X-Forwarded-For`, `-Host`, `-Proto` and `-Port` as
Authwall set them: the client address Authwall resolved under
`AUTHWALL_TRUST_PROXY`, and the host and protocol of the request Authwall
received. No other `X-Forwarded-*` header and no `X-Real-IP` reaches it. In
direct mode none of them reaches the upstream.

## Why

The proxy filled these headers only where the client had left them out, and
passed `X-Real-IP` untouched (AW-20). The routing proxy behind Authwall then
took the client's word for its address and host, in both modes.
