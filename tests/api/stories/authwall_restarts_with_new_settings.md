# Authwall restarts with new access rules, then without them

Ann is signed in as `ann@corp.test`, a confirmed address, and has a personal
access token for a script. The admin adds `ann@corp.test` to
`AUTHWALL_DENIED_EMAILS` and restarts Authwall. Later the rule turns out to be
a mistake: the admin removes it and restarts again.

## Expected

While the rule stands, Ann's browser session and token are refused at every
door: a page of the app sends the browser to sign in, `/auth/status` answers
as signed out with *"Email is not allowed"*, the sidecar answers 401, a
WebSocket is refused, and the token gets 403. Ann's account pages refuse
everything but signing out, so the denied address cannot be removed to get
back in. Nothing is deleted: the session and the token stay stored.

Once the rule is removed, the same session and the same token work again, with
nothing to sign in to or make anew.

## Why

Access rules were checked at sign-in only, so a denied account kept its
session for up to 30 days and its tokens until they expired (AW-80). Deleting
them at the restart was the other way; it would turn a mistyped rule into a
new sign-in for everyone it touched and a new token for every script. The
author picked "refused while denied" on 2026-10-25; `notes/decisions.md` has
both.
