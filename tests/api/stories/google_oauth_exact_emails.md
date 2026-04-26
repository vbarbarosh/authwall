# Google OAuth With Exact Email Allow-List

Authwall can restrict Google OAuth sign-in to a fixed set of user email
addresses with `AUTHWALL_ALLOWED_EMAILS`.

## Story

An Authwall deployment enables Google OAuth and sets:

```text
AUTHWALL_ALLOWED_EMAILS=alice@authwall.test,bob@authwall.test
```

Alice signs in with Google and Google returns the verified email
`alice@authwall.test`.

Another user signs in with Google and Google returns the verified email
`mallory@authwall.test`.

A third user signs in with Google and Google does not return a verified email.

## Expected Behavior

Alice is signed in and an email identity is attached to the new account.

Mallory is rejected even though the email is verified and uses the same domain.
Exact email allow-lists do not imply domain access.

The third user is rejected because exact email allow-lists require a verified
provider email to check.
