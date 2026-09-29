# A link planted from a borrowed session survives the owner's recovery

Mocha has an account with a password, the verified address
`mocha@authwall.test`, and no Google account linked.

1. Mocha leaves the laptop unlocked for five minutes. Someone else opens the
   profile in Mocha's signed-in session, clicks "Connect Google", and signs in
   to Google as their own account. Authwall links that Google account to
   Mocha's account; no password is asked for.
2. Authwall mails Mocha "Google account connected … If you did not connect a
   Google account, reset your password immediately".
3. Mocha does exactly that and completes a password reset.
4. The next day, the attacker opens the sign-in page and chooses "Continue
   with Google" with the same Google account.

## Expected

Step 1 links nothing: Authwall mails a code to `mocha@authwall.test` and waits
for it. The attacker cannot read that mailbox, so the attacker's Google sign-in
never reaches Mocha's account, before or after the reset.

## Why

A linked provider account is a sign-in method of its own. The reset kills
sessions, reset, email-change and verification links, and personal access
tokens, but it never touches linked provider accounts, so the attacker's
Google link outlives the recovery and signs the attacker in as Mocha. The
"connected" mail sends Mocha to exactly the step that does not help.

## Undoing links at recovery does not work

Say the reset undid every provider linked after some date. One borrowed
session connects Google, another connects Microsoft, and Mocha gets two
"connected" mails with the same wording. Following the first undoes Google and
keeps Microsoft, or undoes both; neither is what Mocha can tell from the mail.
Cleaning up after the fact leaves the owner guessing which link is whose.

## Solution: the owner's mailbox approves the link

Stop the link before it exists. When a provider account is connected from the
profile and it does not carry the account's own verified address, Authwall
does not link it yet: it mails a code to the account's primary address, and
the link is made only once that code is typed in. A borrowed session cannot
read Mocha's mailbox, so step 1 ends with nothing linked, and there is nothing
for the reset to miss.

A provider account that returns Mocha's own verified address proves the same
mailbox and links at once, as today.

This story fails until the solution is built: AW-24, step 10 of
`notes/audit-2026-09-28.md`.
