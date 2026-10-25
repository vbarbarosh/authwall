# The upstream's forwarded headers come from Authwall, not the client

Authwall runs in proxy mode, in front of a routing proxy that trusts it as its
only hop. A client sends its own `X-Forwarded-For: 6.6.6.6`,
`X-Forwarded-Host: evil.test`, `X-Forwarded-Proto: https`, `X-Real-IP` and
`X-Forwarded-Prefix`, their underscore spellings (`X_Forwarded_For`,
`X_Real_IP`), `Forwarded`, `X-Original-URL`, `X-Rewrite-URL`,
`X-Original-Host`, `X-Host`, `X-Client-IP`, `True-Client-IP`,
`CF-Connecting-IP`, `X-Cluster-Client-IP`, `X-ProxyUser-Ip` and
`X-HTTP-Method-Override`, over HTTP and over a WebSocket upgrade.

## Expected

The upstream receives `X-Forwarded-For`, `-Host`, `-Proto` and `-Port` as
Authwall set them: the client address Authwall resolved under
`AUTHWALL_TRUST_PROXY`, and the host and protocol of the request Authwall
received. No other `X-Forwarded-*` header, no `X-Real-IP` and none of the
others reaches it, whatever their spelling. In direct mode none of them reaches
the upstream. `X-HTTP-Method-Override` passes in both: Authwall never judges a
request by its method.

## Why

The proxy filled these headers only where the client had left them out, and
passed `X-Real-IP` untouched (AW-20). The routing proxy behind Authwall then
took the client's word for its address and host, in both modes. The strip
then left the underscore spellings, which PHP and Apache read as the dashed
ones (AW-83), and the headers other frameworks read for the same purpose:
`Forwarded` (Spring, Symfony, Go), the IIS rewrite headers that route to
another path than the one Authwall judged, and the vendor client-address ones
(AW-84).
