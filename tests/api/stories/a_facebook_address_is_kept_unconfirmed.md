# A Facebook address is kept unconfirmed

Ann signs up with Facebook, Bea with Google. Facebook gives Ann's address
and never says whether it confirmed it; Google says it did for Bea's.

## Before

Run on `9923a34` (AW-170): both identities kept their address in
`user_identities.provider_emails`, the list the code calls what the provider
vouched for: `["ann@corp.test"]` and `["bea@corp.test"]`, alike. Ann's own
address row was not confirmed. Nobody got in through it, but code reading
the list would take Ann's address as confirmed by Facebook.

## Expected

`provider_emails` holds only what the provider confirmed: `[]` for Ann,
`["bea@corp.test"]` for Bea. What Facebook gave unconfirmed is kept apart,
in `provider_unconfirmed_emails`: `["ann@corp.test"]`. So at sign-up, at
every later sign-in, and when Facebook is linked to an account. A Facebook
row made before is moved there by the migration.

Who gets in stays as it was: the email access rules read both lists. Under
a deny list with confirmation off, Ann is let in as before; under an allow
list she waits at Authwall's mailed link, as before.

## Why

A list should say what it holds. Keeping only the confirmed addresses, as
the audit proposed, would refuse every Facebook user of a deny-list setup
with confirmation off: the rules would find no address to judge.
