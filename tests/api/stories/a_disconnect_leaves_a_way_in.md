# A disconnect leaves a way in

Bea signs up with Google, which gives no address, and sets no password.
In her profile she adds `bea@authwall.test` and never opens the
confirmation mail. Later she disconnects Google.

## Expected

The disconnect is refused: "Cannot disconnect Google: it is your only
sign-in method", and Google stays linked. Her unconfirmed address is no way
in: a magic link for it is refused when opened, "registered but not yet
verified. Sign in with your password and verify it first", and she has no
password; no reset goes to it.

Had she signed up with her address and a password instead, never
confirming it, and linked Google later, the disconnect goes through: she
signs in with her address and that password.

## Why

The disconnect refused only when the provider was the last identity row,
so her unconfirmed address counted as a way in. It went through, and Bea
was left with an account no sign-in could reach: the magic link for her
address was mailed and refused when opened, and a reset sent nothing
(M-02).
