# A link planted from a borrowed session survives the owner's recovery

Mocha has an account with a password and the verified address
`mocha@authwall.test`, which is the account's primary address. No Google
account is linked.

1. Mocha leaves the laptop unlocked for five minutes. Someone else opens the
   profile in Mocha's signed-in session, clicks "Connect Google", and signs in
   to Google as their own account, `attacker@gmail.test`.
2. Mocha gets a mail about it and completes a password reset.
3. The next day, the attacker opens the sign-in page and chooses "Continue
   with Google" with the same Google account.

## Expected

Step 1 links nothing. The Google account does not return Mocha's primary
address, so Authwall asks for proof that this is the owner: it mails a code to
`mocha@authwall.test` and accepts that code or the account's password. The
attacker has neither. At step 3 the attacker's Google account is not linked to
Mocha's, so it never signs in as Mocha, before or after the reset.

A Google account that returns Mocha's primary address, verified by Google,
links at once, as before.

## Why

A linked provider account is a sign-in method of its own, and a signed-in
session was all it took to add one. The reset kills sessions, one-time links
and personal access tokens, but not linked provider accounts, so the
attacker's Google link outlived the recovery. The "connected" mail told Mocha
to reset the password, the one step that did not help.

## Undoing links at recovery does not work

Say the reset undid every provider linked after some date. One borrowed
session connects Google, another connects Microsoft, and Mocha gets two
"connected" mails with the same wording. Following the first undoes Google and
keeps Microsoft, or undoes both; nothing in the mail tells Mocha which.
Cleaning up after the fact leaves the owner guessing which link is whose.

## Solution: the primary address approves the link

Stop the link before it exists. Every account has a primary address: the
first address it comes in with, verified. It is shown in the profile as
primary and is not inferred from anything else.

- A provider account that returns the primary address, with the provider's
  verification signal, links at once. The signals are Google `email_verified`,
  GitHub `verified`, Microsoft `xms_edov` and X `confirmed_email`. Facebook
  sends none, so a Facebook connect always asks.
- Any other provider account waits for the owner: a code mailed to the
  primary, or the current password. The profile says why: *"The Google account
  you are connecting (me@gmail.com) does not use your primary address
  (mocha@work.test). Confirm it is you: enter the code we sent to
  mocha@work.test, or your password."*
- An account with no primary confirms with its password. An account with
  neither confirms by signing in again with a provider it already has.
- After confirming, the owner goes through the provider once more
  (`/auth/status` names where, as `confirmation.next`) and the account links;
  a confirmation holds for 10 minutes.

Changing the primary address is a workflow of its own, confirmed from both the
old and the new address, and is planned separately. Recovering access to a
lost primary is a separate story.

AW-24, step 10 of `notes/audit-2026-09-28.md`.
