# One-time tokens are consumed exactly once

Two requests carrying the same reset link, magic link, or verification link
arrive at the same instant — one browser double-submitting, or an attacker
replaying a link the moment its owner uses it. Separately, five wrong
magic-link codes arrive at once against a cap of three.

## Expected

Exactly one request consumes the link: one password is set, one account is
created, one address is verified. The other answers as it would for a used
link. The five guesses leave the counter at three, not five and not one, and
the correct code is refused afterwards.

## Why

Each of these routes read the row, found it unused, and only then marked it
used with an update keyed on the id alone. Two requests that both read before
either wrote both went on to the effect: the audit reproduced two
`password_reset_completed` events from one reset link on SQLite. The guess
counters were read-modify-write in the same way, so a burst of concurrent
guesses each read the same count and each got one more.

Consumption is now the conditional update itself — mark used *where not yet
used* — and the effect follows only when exactly one row changed. For the
password reset that claim is the first statement of the transaction that
writes the new password, so a loser rolls back and touches nothing. Guess
counters are incremented in the database *where below the cap*, so the cap
holds however many arrive.
