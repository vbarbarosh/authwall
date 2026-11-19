# Authwall restarts with new access rules, then without them

Ann is signed in as `ann@corp.test`, a confirmed address, and has a personal
access token for a script. The admin adds `ann@corp.test` to
`AUTHWALL_DENIED_EMAILS` and restarts Authwall. Later the rule turns out to be
a mistake: the admin removes it and restarts again.

Carol signs in with Google only and keeps no address of her own: she removed
it in the profile, or Google gave none. The admin drops her from
`AUTHWALL_ALLOWED_EMAILS`, or sets a list after she signed up, and restarts.

## Before

Run on `43572c2` (AW-120): with her address removed, Carol's session, token,
sidecar and WebSocket all went on after the restart that dropped her, while a
fresh sign-in was refused. Every door admitted an account at an enabled
provider without asking which address that provider had vouched for.

## Expected

While the rule stands, Ann's browser session and token are refused at every
door: a page of the app sends the browser to sign in, `/auth/status` answers
as signed out with *"Email is not allowed"*, the sidecar answers 401, a
WebSocket is refused, and the token gets 403. Ann's account pages refuse
everything but signing out, so the denied address cannot be removed to get
back in. Nothing is deleted: the session and the token stay stored.

Once the rule is removed, the same session and the same token work again, with
nothing to sign in to or make anew.

Carol's doors are judged by the addresses Google vouched for at her last
Google sign-in, as that sign-in was (AW-120). Dropped from the list, she is
refused at all four doors as Ann is, and so is a fresh sign-in; with no
address from Google, a list set later refuses her the same way, with *"A
verified email is required"*. Back on the list, her session and token work
again. An account from before these addresses were kept signs in with Google
once more.

## Why

Access rules were checked at sign-in only, so a denied account kept its
session for up to 30 days and its tokens until they expired (AW-80). Deleting
them at the restart was the other way; it would turn a mistyped rule into a
new sign-in for everyone it touched and a new token for every script. The
author picked "refused while denied" on 2026-10-25; `notes/decisions.md` has
both.
