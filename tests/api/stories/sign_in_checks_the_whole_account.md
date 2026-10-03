# Sign-in checks every address on the account

Authwall admits `corp.test`, and the operator denies `bad@corp.test`, a
person who left. Their account still holds the verified addresses
`bad@corp.test` and `good@corp.test`, a password, and GitHub id 777. At
GitHub they change the address to `new@corp.test`.

## Expected

Each way in is refused: GitHub, email and password with
`good@corp.test`, and a magic link to `good@corp.test`. Email and password
answers as a wrong password does, so the refusal does not confirm the
password; GitHub and the magic link say "Email is not allowed". Without the
deny rule, the same account signs in through each of them.

## Why

Sign-in checked only the address presented this time: the one typed, or
the ones the provider returned. The account's other addresses were never
looked at, so a denied person kept signing in with any other address or
provider they had linked (AW-28). Username sign-in already checked every
verified address on the account; now every method does.
