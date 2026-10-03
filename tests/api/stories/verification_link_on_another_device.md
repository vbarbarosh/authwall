# You sign up on the laptop and confirm on the phone

Authwall admits `corp.test` and requires a confirmed address. Mark signs up
on his laptop with `mark@corp.test` and a password. The laptop shows
"confirm your email". He reads his mail on the phone and clicks the link
there.

## Before

Run on `c4ddeee`, the requests were exactly the ones of
[a stranger signs up with your address](verification_link_from_a_stranger.md):

```
laptop, before the click:  302 /auth/email-verify   (held)
the click on the phone:    302 /auth/email-verify/success
laptop, after the click:   200, X-Auth-User set      (let in)
Mark signs in later with his password: authenticated
```

Authwall cannot tell Mark from the stranger: in both, one browser signed up
and another clicked. Whatever stops the stranger also touches Mark.

## Expected

Mark finishes with one extra step. The phone goes to "set a new password";
he sets one and signs in there. His laptop was signed out and signs in again
with that password.

Clicked on the laptop itself, in the browser that signed up, nothing changes:
the address is verified and the laptop is let in, as before.

## Why

A link opened on another device is the common case. The fix for the
stranger has to leave Mark a way through without help.
