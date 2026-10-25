# Facebook's address is pending until Authwall confirms it

Ann signs in with Facebook for the first time. Facebook returns
`ann@corp.test`, the primary email on Ann's profile, and nothing beside it to
say whether Facebook ever confirmed it. In one run the instance is open; in
another `AUTHWALL_ALLOWED_DOMAINS=corp.test` is set, and confirmation is
required, as Authwall resolves it there.

Mallory has a Facebook account too, under `boss@corp.test`, an address they
do not read.

## Expected

Ann's account is created with `ann@corp.test` pending, not verified, and the
welcome mail carries Authwall's confirmation link. On the open instance Ann is
signed in at once; under the allow list the session waits at email
confirmation and reaches the app only once the link is opened. A later
Facebook sign-in finds the account and admits Ann as before, with no new mail.

Mallory gets the same wait under the allow list, and the link goes to
`boss@corp.test`, never to them: Mallory is not admitted. An address another
account already holds stays with it; the new account is made without it and
nothing is mailed. An address outside the allow list, or none at all, is
refused before any account is made, as a verified one is.

Connecting Facebook from the profile does not bring its address along; the
confirmation page still names it.

## Why

Every other provider says, per address, whether it confirmed it: Google's
`email_verified`, GitHub's `verified`, Discord's flag, X's `confirmed_email`,
Microsoft's `xms_edov`. Facebook says nothing, and its documentation promises
nothing (AW-05). Taken on trust, a Facebook account under someone else's
address passed an allow list and took that address from its owner. Authwall's
own link proves who reads the mailbox, once, the first time.
