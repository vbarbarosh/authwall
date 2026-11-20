# A header typo never prints its value

The operator gives the upstream a credential of its own through
`AUTHWALL_SET_HEADERS`, and writes the entry the way HTTP shows it:

```
AUTHWALL_SET_HEADERS='X-Team=notes;Authorization: Basic S3CRET'
```

Authwall runs under `restart: unless-stopped`, its log collected.

## Before

Run on `d7311b8` (AW-173): the start failed with
`AUTHWALL_SET_HEADERS entry must contain "=": "Authorization: Basic S3CRET"`,
the credential in stderr at every restart. A space for the `=` put it in
Node's own error instead, which quotes the header name.

## Expected

The start still fails, and names the entry by its number and the form
expected: `AUTHWALL_SET_HEADERS entry 2 must contain "=": Header-Name=value`.
Neither stdout nor stderr holds any part of the entry.

## Why

A header set for the upstream is often its password or token. The error
tells where the mistake is, and the operator has the text in front of them.
