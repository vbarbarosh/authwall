# Adding an address asks "confirm it is you"

Ann leaves her laptop signed in. Her account has no confirmed address: a
username and a password, a username and an address she never confirmed, or a
GitHub sign-in that gave none. Someone at the laptop adds their own address.

## Before

Run on `72e8883` (AW-119): the address was added on the session alone. Its
code, mailed to the borrower, was typed in the same browser; the address
became the primary, and a password reset went to it and took the account:
Ann's password stopped working, and no mail reached Ann, who has no address.
A pending address was removed first without asking. On the GitHub account,
the next "confirm it is you" code, for a first password, went to the
borrower.

## Expected

Adding an address is refused until the session confirms it is the owner, as
removing a verified one is: the password, or a fresh sign-in with a linked
provider (an account with no address has no code to mail). Nothing is added
and nothing is mailed; the session keeps where to come back, and once
confirmed, the owner adds it again.

A user held at the verify step fixes a mistyped address without asking,
within ten minutes of signing in: the confirmation is shut to them, and the
sign-in stands for it. A held session older than that signs in again first.

## Why

A confirmed address is a way in and the way back: a password reset goes to
it, and so does every later "confirm it is you" code. The code mailed to it
proves the mailbox, not whose account it joins.
