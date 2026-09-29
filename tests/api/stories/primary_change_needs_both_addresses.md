# Changing the primary address needs both addresses

Mocha's primary address is `mocha@authwall.test`. Changing the account's email
changes the primary.

1. Someone else, in Mocha's signed-in session for a few minutes, asks to
   change the email to `attacker@evil.test`.
2. The confirmation link goes to `attacker@evil.test`, and they open it.

## Expected

Nothing changes yet. The change also needs the approval of the current
primary: Authwall mails `mocha@authwall.test` a request to approve moving the
account to `attacker@evil.test`. Mocha does not approve it, so the primary
stays `mocha@authwall.test`.

When Mocha really moves to a new address, Mocha opens both links, the one
sent to the new address and the approval sent to the old one, in either
order, within 30 minutes. Then the new address replaces the old one and stays
primary.

## Why

The primary address decides who may link a provider account
(`oauth_link_survives_reset.md`), and it is where codes and reset links go.
Today only the new address confirms a change, so a borrowed session can move
the primary to an address it reads: then it connects its own Google account,
which now "uses the primary", and a password reset goes to it too. The old
address is told only afterwards, in a mail that suggests a password reset,
whose link can no longer reach it, because it has already left the account.

The new address proves the mailbox the account moves to; the old primary
proves the owner agrees to leave the old one. A borrowed session has neither.

Recovering an account whose primary mailbox is lost is a separate story.
