# A borrowed browser signs in again with Google

Ann has a password and has linked her Google account. She leaves her laptop
signed in to Authwall, and to Google in the same browser. Mallory sits down,
does not know the password, and asks for a personal access token.

1. Authwall asks "confirm it is you": the password, or "Sign in again with
   Google".
2. Mallory clicks Google.
3. Google is still signed in, so it asks nothing: one click on "Continue as
   ann@gmail.com", and back.
4. Authwall takes it as Ann, and Mallory leaves with a token that opens
   Ann's account for months.

## Before

Run on `90a31fc` (AW-123): step 4 happened. "Sign in again" sent the browser
to the same address as a sign-in, and the callback asked only that the
provider account be linked to this user.

## Expected

An account with a password confirms with it. The page does not offer "Sign
in again with Google" to Ann, and the provider's answer is refused with
*"Confirm with your password."*: no confirmation, no token.

Gil has only his GitHub account, no password. "Sign in again with GitHub"
still confirms it is him: his GitHub sign-in is his account, and he has no
other way.

Microsoft and Facebook are asked for a new sign-in at a confirmation
(`prompt=login`, `auth_type=reauthenticate`); a sign-in itself is asked as
before.

## Why

Google, GitHub, Discord and X cannot be made to ask again: where the browser
is still signed in to them, the answer is one click, and it proves the
browser, not the person. Where the account has a stronger way, the password,
the provider no longer stands in for it. Where it has none, the provider
stays, so nobody is locked out of creating a token, adding an address or
setting a password. The author picked this on 2026-11-19.
