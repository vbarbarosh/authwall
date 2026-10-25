# Connecting a provider confirms the account's pending address

Ann signs up with `ann@gmail.test` and a password and never opens the
confirmation mail, so the address stays pending. Later Ann connects Google
from the profile; Google returns `ann@gmail.test` with `email_verified`.

## Expected

After Ann confirms it is them for the connect, Google is linked and
`ann@gmail.test` counts as verified, and as the account's primary address. A
Google account under another address leaves the pending one as it was.

## Why

The connect inserted the provider's address and ignored the conflict with
Ann's own pending row, so the address Google vouched for stayed unconfirmed
and the account had no primary (AW-51).
