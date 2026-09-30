# Wrong codes have a budget per address and per IP

Authwall admits anyone at `corp.test`. Nobody reads `nobody@corp.test`. An
attacker asks for a sign-in code at that address, guesses five times, waits
out the one-minute cooldown, asks for another code and guesses again, from
as many browsers and IP addresses as it takes.

## Expected

An address gets 10 wrong codes per hour, counted across all its codes. After
that, every code for it is refused with "Too many attempts. Try again later.",
even the right one, until the wrong guesses are more than an hour old.
Sign-in codes and email-verification codes each count this way.

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
