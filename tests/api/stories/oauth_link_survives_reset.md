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

After Mocha's reset, the attacker's Google sign-in no longer reaches Mocha's
account.

## Why

A linked provider account is a sign-in method of its own. The reset kills
sessions, reset, email-change and verification links, and personal access
tokens, but it never touches linked provider accounts, so the attacker's
Google link outlives the recovery and signs the attacker in as Mocha. The
"connected" mail sends Mocha to exactly the step that does not help.

How the reset deals with linked accounts (remove the ones linked since the last
password sign-in, remove all, or keep them and notify) is open: AW-24, step 10
of `notes/audit-2026-09-28.md`. Until it is decided, this story fails.
