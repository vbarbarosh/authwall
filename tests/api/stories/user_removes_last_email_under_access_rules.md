# User removes their last email under access rules

Authwall allows only email addresses in `authwall.test`, and
`AUTHWALL_CONFIRM_EMAIL_REQUIRED` is off. Mocha's account holds two
identities — the username `mocha` and the verified address
`mocha@authwall.test` — and Mocha removes the address from the profile page,
meaning to sign in by username from then on.

## Expected

Authwall refuses with *"Cannot remove email: a verified email is required to
sign in"*. The identity stays attached, and Mocha can still sign in.

## Why

Email access rules make a verified address the thing that authorizes a username
sign-in: an account without one is turned away, and turned away with the same
*"Invalid username or password"* a wrong password gets, so nothing tells the
account holder that removing the address is what locked them out. Password
reset cannot recover them either — it looks up a verified email identity that
no longer exists — leaving an account only an operator with database access can
restore.

Authwall already refuses this removal when `AUTHWALL_CONFIRM_EMAIL_REQUIRED`
holds the account at a verification step it cannot leave. Access rules create
the same dead end by a different route, so the guard has to cover both. The
`last_identity` check does not: a username account has a second identity, so it
sees nothing worth stopping.
