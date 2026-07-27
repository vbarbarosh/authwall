# Repeat GitHub sign-in

A user signs in with GitHub, signs out (or comes back from a fresh browser),
and signs in with GitHub again.

## Expected

The second sign-in resolves to the same account. No new user is created, and
nothing about the flow depends on which provider it was.

## Why

GitHub returns the account id as a JSON **number** (`"id": 583231`), while every
other provider returns a string. The identity is stored as text, so the value
has to be normalized before it is used — both for the lookup and for the
insert.

Skipping that is not a cosmetic inconsistency. SQLite does not apply text
affinity to a bound integer, so `where value_normalized = 583231` matches
nothing even though the row holds `'583231'`. The returning user then falls
through to the sign-up branch, which tries to insert a duplicate identity and
dies on the unique constraint — leaving the user permanently unable to sign in
with GitHub after their first visit, behind a generic "An error occurred".

Fixtures for this flow must use a number. A mock that sends a string tests the
code against itself and cannot catch the regression.
