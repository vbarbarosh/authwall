# Wrong codes have a budget per address and per IP

Authwall admits anyone at `corp.test`. Nobody reads `nobody@corp.test`. An
attacker asks for a sign-in code at that address, guesses five times, waits
out the one-minute cooldown, asks for another code and guesses again, from
as many browsers and IP addresses as it takes. Or it signs up with that
address and guesses at its verification codes, resetting what it can.

## Before

Run on `a11c583` (AW-124): the budget counted the wrong guesses kept on the
codes still unused. Removing the pending address marked them used, removing
the account or releasing a stale address deleted them, and a sign-up mailed
a new code with no cooldown: each brought ten new guesses.

## Expected

An address gets 10 wrong codes per hour, counted across all its codes. After
that, every code for it is refused with "Too many attempts. Try again later.",
even the right one, until the wrong guesses are more than an hour old.
Sign-in codes and email-verification codes each count this way.

Nothing the guessing account does to its own codes gives it new guesses:
removing the address and adding it again while held at the verify step,
removing the account and signing up again, or a new sign-up once the pending
address is stale. The wrong guesses are events of the address, which outlive
the codes and the account. A sign-up with an address another sign-up mailed
waits out the resend cooldown, as a resend does.

One IP address gets 20 wrong codes per 15 minutes, across addresses. After
that it is refused the same way, for any address. Like the other per-IP
limits, this one is kept in memory and is off with `AUTHWALL_RATE_LIMITING=0`.

## Why

Each code allowed five guesses, but nothing counted guesses across codes. A
new code every minute brought five new guesses, so an address nobody reads
could be guessed at 300 times an hour. A right guess makes a verified
address at an allowed domain, and so admits the attacker past the allow list
(AW-02). The address budget is kept in the database: it holds across
processes and restarts, and against guesses spread over many IP addresses.

A stranger can use up an address's budget and block code sign-in for it for
up to an hour. That is the cost of a per-address limit; the link in the mail
still works where the mode sends one.
