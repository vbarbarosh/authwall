# User adds a disallowed email

Authwall allows only email addresses in `authwall.test`. Mocha signs in by
username with the verified address `mocha@authwall.test`, then tries to add
`outsider@example.com` from the profile page.

## Expected

Authwall rejects the request with **“Email domain is not allowed”**. Mocha
stays signed in, all existing identities remain unchanged, and the account
still has exactly one email address. No verification email is sent.

## Why

Being signed in does not bypass email access rules when adding an address.
