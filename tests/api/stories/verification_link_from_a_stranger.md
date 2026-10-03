# A stranger signs up with your address

Authwall admits `corp.test` and requires a confirmed address.
`victim@corp.test` belongs to Vera. A stranger, who is not at corp.test,
signs up with `victim@corp.test` and a password of their own. Authwall holds
the stranger at "confirm your email" and mails Vera a "Welcome, confirm your
email" link.

Vera did not sign up, but the mail looks like any other. She clicks the
link, on her phone.

## Before

The link verified the account that asked for it, in whatever browser it was
opened. Run on `c4ddeee`:

```
stranger's browser, before the click:  302 /auth/email-verify   (held)
Vera's click, no session there:        302 /auth/email-verify/success
stranger's browser, after the click:   200, X-Auth-User set      (let in)
stranger signs in later with the password they chose: authenticated
```

The stranger now holds a verified `victim@corp.test` account and passes the
allow list as a corp.test user. If Vera later signs in with a magic link,
she lands in the stranger's account.

## Expected

Vera's tap never lets the stranger in. Opened outside the browser that
signed up, the link verifies the address and hands the account to whoever
reads the mailbox: every session of the account ends, the stranger's
password stops working, and Vera's phone goes to "set a new password". The
account is hers.

## Why

A verification link proves that whoever clicks it reads that mailbox. It
proves nothing about who signed up. Today the click hands its proof to the
browser that signed up (AW-25).
