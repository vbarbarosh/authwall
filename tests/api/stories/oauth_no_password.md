# OAuth User With No Password

## Story

A user signs up using Google with verified email `foo@authwall.test`.

Later, the same user tries to sign in using `foo@authwall.test` and a password.

## Expected Behavior

The sign-in attempt fails with `Invalid username or password` because no password was set.

Authwall should not reveal that the account exists or that it has no password.
