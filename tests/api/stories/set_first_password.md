# Setting a first password

A user with no password — signed up through an OAuth provider, or through a
magic link — decides they want one, so they are not dependent on that provider
to get in.

## Expected

The profile accepts a new password without a `current_password`: there is no
existing password to verify against. Afterwards the account can sign in with
email and password like any other.

## Why

`bcrypt.compare(x, null)` throws rather than returning false, so comparing
against an absent password turns into a generic `An error occurred [req_…]`
instead of a useful message — and the account can never gain a password at all.
Both entry points (`POST /auth/change-password` and `POST /auth/profile`) have
to treat "no password yet" as a distinct case from "wrong password".

This is the mirror of [`oauth_no_password.md`](oauth_no_password.md): there,
signing in with a password *before* one is set must fail; here, it must succeed
once the user has set one.
