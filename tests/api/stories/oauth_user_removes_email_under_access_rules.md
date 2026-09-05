# OAuth user removes their email under access rules

Authwall allows only email addresses in `authwall.test`. Jonny signs in with
Google as `jonny@authwall.test`, which leaves an account holding two
identities — the Google one and the verified address — and no username. From
the profile page Jonny removes the address.

## Expected

The removal succeeds, and Jonny signs in with Google afterwards exactly as
before.

## Why

Access rules make a verified address load-bearing for *username* sign-in:
Authwall has no other way to decide whether the person behind a username is
someone the rules admit, so it reads the addresses on the account. A Google
sign-in is never asked that question — it is authorized against the verified
addresses the provider reports, not the ones stored locally — so an account
with no username cannot be stranded by removing its address, and keeping it is
worth nothing.

Refusing every removal while access rules exist would be the simpler rule, and
it would be wrong here: it tells a Google user that an address they never sign
in with is required to sign in.
