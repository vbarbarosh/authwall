# A pending address yields to the person who reads the mailbox

Mallory signs in with GitHub and adds `vera@corp.test` to Mallory's account.
The address stays pending there: Mallory cannot confirm it, and Authwall mails
its link to Vera.

## Expected

Vera proves the mailbox and the address moves to Vera, at once:

- Vera's magic link signs Vera in to a new account holding the address,
  confirmed;
- Vera's Google, which vouches for the address, does the same;
- the link Authwall mailed to Vera, opened outside Mallory's browser, offers
  *Not my account* beside *Sign in to confirm*: pressed, it frees the address
  and sends Vera to sign up with it.

Mallory's account keeps GitHub and loses the address; the auth log records the
release against it.

With no proof, a pending address nobody confirmed within the confirmation
window (15 minutes by default, and no link still open) stops blocking a
sign-up, an added address or an email change. Within the window it still
does. An account whose only way in is the pending address and its password
keeps it until then: its mailed link hands that account over instead (AW-25).
A confirmed address never moves.

## Why

A pending row never expired and nothing displaced it, so a provider-backed
account could hold a colleague's address and lock the colleague out of
signing up, of magic links and of the address on a Google account (AW-82,
AW-06). The author picked "Vera's proof wins" on 2026-10-25.
