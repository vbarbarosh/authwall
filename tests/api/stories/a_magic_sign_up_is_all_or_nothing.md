# A magic sign-up is all or nothing

Bea asks for a magic link to `bea@authwall.test`, an address no account
holds yet. She opens the link, or types the code, and the database fails
halfway: her user row is written, then her address is refused.

## Expected

Nothing of the sign-up stays: there is no user without an address, and the
link or code is not spent. Bea sees an error, opens the same link or types the
same code again, and her account is made with her address, once.

## Why

The link or code was spent first, then the user row, its address and its
primary mark were written as separate statements. A failure between them
left a user with no way to sign in and a spent link, so the retry could only
answer that the link was invalid (AW-112). The password sign-up already wrote
the user and its identities in one transaction; the link and the code now do
the same, and their spending goes with it.
