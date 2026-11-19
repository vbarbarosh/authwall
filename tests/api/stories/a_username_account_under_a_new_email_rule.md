# A username account under a new email rule

Sam signed up as `sam`, with a password and no email, before Authwall had
access rules. He is signed in, keeps a personal access token for a script and
an open WebSocket. The admin sets `AUTHWALL_ALLOWED_DOMAINS=corp.test` and
restarts Authwall; later the rule is lifted again.

Ann's account holds a username and her Google account, but no stored address:
she removed it, as the rules let an account at a provider do. Pat signed up
with `pat@corp.test` and has not confirmed it yet.

## Expected

While the rule stands, Sam is refused everywhere a new sign-in of his would
be: his username and password answer as a wrong password, a page of the app
sends his browser to sign in, `/auth/status` answers as signed out with *"A
verified email is required"*, the sidecar answers 401, the token gets 403 and
a WebSocket is refused. Nothing is deleted, and once the rule is lifted the
same session and token work again.

Ann keeps her session while Google is enabled: Google's verified addresses are
checked at each of her Google sign-ins. She cannot disconnect Google while it
is her only way to meet the rule, as an address that is cannot be removed.
With Google disabled she has no way to meet it and is refused as Sam is.

Pat is not refused: she waits at email confirmation, where she can still ask
for the link, and reaches the app once the address is confirmed.

## Why

A fresh username sign-in required a verified address under the rules, but the
check for credentials already held asked only that every verified address
pass, and an account with none passed. Sam's session and token outlived the
rule that refused him at the sign-in form (AW-106). Both now take one answer,
`access_refusal_from_identities`, and it is asked each time rather than kept,
since an account's addresses and providers change as well as the rules.
