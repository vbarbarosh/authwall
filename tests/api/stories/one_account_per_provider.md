# One account per provider

Mocha's account has a password and a Google account linked from the profile.
An attacker gets hold of a signed-in session for a few minutes, from an
unattended laptop or a leaked cookie, and links the attacker's own Google
account from Mocha's profile.

## Expected

The second Google account is refused with *"A Google account is already
connected; disconnect it first"*, and the account keeps exactly the Google
account Mocha linked. The database refuses a second account of one provider
for one user as well; a user may still hold several email addresses.

## Why

Identities were unique per provider account, not per user, so one user could
hold two Google accounts at once. The attacker's link survived the owner's
password reset and signed the attacker back in as Mocha, and "Disconnect
Google" removed whichever of the two came first, which could be the owner's
own.

So a user holds at most one account per provider: the connect route refuses a
second one, and a unique index on `user_identities` backs it. Email identities
stay out of the index, since connecting a provider may add its verified address
next to the account's. What a password reset does to accounts linked from a
borrowed session is a separate decision (AW-24, step 10 of
`notes/audit-2026-09-28.md`).
