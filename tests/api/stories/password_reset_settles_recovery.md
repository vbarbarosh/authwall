# A completed reset settles the recovery

Mocha's account has a password and the verified address `mocha@authwall.test`.
Two reset links are requested for it within the ten-minute window: one by
Mocha, one by an attacker who can read the mailbox for a moment. Mocha
completes the reset with one of them.

Separately, a reset link is issued for Mocha's old address, and Mocha then
changes the account's email to a new address, or removes the address from the
profile.

## Expected

After a completed reset, the other link answers *"Invalid reset token"* and
the new password signs in. After an email change or an email removal, the link
issued to the old address answers the same, and the existing password still
works.

## Why

A reset link is scoped to the account, not to the address it was sent to, and
it lives for ten minutes. Marking only the submitted link used left every
other link out for the account valid: whoever held a second one could reset
the password again, straight after the owner had recovered, and a link mailed
to an address the account no longer has could still finish a recovery for it.

Recovery ends when it succeeds, so a completed reset now kills the sibling
links in the same transaction that writes the new password, deletes the
sessions, and revokes the personal access tokens. An address that leaves the
account takes the links delivered to it along. The profile password change
already did this (`password_reset_after_change.md`); the reset path and the
two identity changes now match it.
