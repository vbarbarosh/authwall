# Confirm it is you

Some actions must come from the owner, not from whoever holds a signed-in
session for a moment: linking a provider account that does not use the
primary address (`oauth_link_survives_reset.md`), and later the other
sensitive changes of AW-04. Before such an action, Mocha confirms it is them.

Mocha has a password and the primary address `mocha@authwall.test`.

1. Mocha asks for a code. Authwall mails a 6-digit code to the primary
   address, valid for 10 minutes. Mocha types it in.
2. Or Mocha types the account's password instead.

## Expected

Either way the session is marked confirmed (`confirmed_at`). The mark lives in
this session only: a new sign-in starts without it.

- A wrong code or password is refused, and so is the sixth attempt within 15
  minutes, even with the right answer. Wrong codes and wrong passwords count
  together, and the count survives a restart.
- A code allows 5 guesses; after them even the right code is refused.
- An account with no primary address cannot ask for a code; it confirms with
  its password. An account with no password confirms with a code.

## Why

A borrowed session can do anything the owner can do in the profile. The code
proves control of the primary mailbox and the password proves knowledge of
the secret; the borrower has neither. Counting failures in the database, per
account, keeps the budget across codes, across processes and across restarts,
unlike the in-memory throttles.
