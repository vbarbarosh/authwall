# The primary address

Every account has one primary address: the first verified address it comes
in with. It is stored, not guessed, and `/auth/status` shows it as
`primary_at` on that identity.

1. Mocha signs up with `mocha@authwall.test` and a password. The address is
   not primary until Mocha confirms it; then it is.
2. Alice signs up through a magic link sent to `alice@authwall.test`, or
   through Google with a verified address. That address is primary at once.
3. Mocha later connects a Google account with another verified address. The
   new address joins the account; the primary stays `mocha@authwall.test`.
4. Mocha changes the account's email to `mocha@new.test`. The primary moves to
   the new value, since it replaced the primary.

Accounts that existed before the primary address get their oldest verified
address as primary when the migration runs.

## Why

The primary address decides whether a newly connected provider account links
at once or asks the owner to confirm (`oauth_link_survives_reset.md`). A rule
like that must not depend on which of several addresses happens to come
first in a query: the account holds one primary, the profile will show it,
and changing it will be a workflow of its own.
