# Email change preserves the entered address

A user signed up as `Old.Email@Gmail.com`, then decides to change their email
to `New.Email@Gmail.com`.

## Expected

The profile shows `New.Email@Gmail.com`, exactly as it was typed.

The normalized form, `newemail@gmail.com`, is stored beside it and remains the
key used for uniqueness checks and sign-in. Signing out and back in as
`newemail@gmail.com` must not change the address the profile displays.

## Why

An email identity is stored twice, for two different jobs:

- `value` — the form the user typed, shown back to them.
- `value_normalized` — the canonical form used for lookups and uniqueness.
