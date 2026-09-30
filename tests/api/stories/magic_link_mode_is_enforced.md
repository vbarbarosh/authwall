# The magic-link mode decides what signs in

Authwall is started with `AUTHWALL_MAGIC_LINK=link`: the sign-in mail carries
only a link. Someone who knows Mocha's address requests a magic link for it
and posts codes to `/auth/magic-link/confirm`, hoping to guess one.

## Expected

No code is issued, so there is nothing to guess: Authwall stores no code for
the request and refuses every code with "Sign-in by code is disabled".

With `AUTHWALL_MAGIC_LINK=code` the mail carries only a code, and the link
is refused the same way ("Sign-in by link is disabled"). The refused link
does not use up the request: the code from the mail still signs in.

With `link_and_code` both work, as before.

## Why

Every request stored a code and a link, whatever the mode, and both confirm
routes accepted them. In link mode the code was mailed to no one, yet it
could still be guessed, five tries per request. Link-only mode is the advice
for shutting out code guessing (AW-02), and for magic links it did not shut
anything out (AW-26). Email verification already refuses a code in link mode.
