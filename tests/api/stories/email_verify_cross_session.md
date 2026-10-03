Alice is signed in with a verified email.

Bob signs in separately with an unverified email and requests a verification
link.

When Bob's verification link is opened in Alice's signed-in browser, Bob's
email should be verified, but Alice's session email fields must not change.
Alice's browser is then asked to set Bob's password, and Bob's own session
ends: the link went to whoever reads Bob's mailbox (AW-25).
