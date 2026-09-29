# Changing the primary address needs both addresses

Mocha's primary address is `mocha@authwall.test`. Changing the account's email
changes the primary.

1. Someone else, in Mocha's signed-in session for a few minutes, asks to
   change the email to `attacker@evil.test`.
2. They wait for a confirmation link at `attacker@evil.test`.

## Expected

No link reaches `attacker@evil.test`. The current primary approves first:
Authwall mails `mocha@authwall.test` a request to approve moving the account
to `attacker@evil.test`, and the new address hears nothing until that link is
opened. Mocha does not approve, so the primary stays `mocha@authwall.test`.

When Mocha really moves to a new address, Mocha opens the approval at the old
address; only then does the new address get its confirmation link, valid for
30 minutes. Once it is opened, the new address replaces the old one and stays
primary, and the old address gets a notice that the change was made. An
approval link works once.

An account without a primary (its address was never verified) has no one to
ask: the owner confirms it is them (`confirm_it_is_you.md`) before the change,
and the link then goes straight to the new address.

## Why

The primary address decides who may link a provider account
(`oauth_link_survives_reset.md`), and it is where codes and reset links go.
When only the new address confirmed a change, a borrowed session could move
the primary to an address it reads: then it connected its own Google account,
which now "used the primary", and a password reset went to it too. The old
address was told only afterwards, in a mail that suggested a password reset,
whose link could no longer reach it, because it had already left the account.

The old primary proves the owner agrees to leave it; the new address proves
the mailbox the account moves to. A borrowed session has neither, and with
the approval first the attacker's address never receives anything.

Recovering an account whose primary mailbox is lost is a separate story.
