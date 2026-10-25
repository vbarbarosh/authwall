# A mail scanner opens every link in the mail

Ann's mailbox sits behind a link-scanning filter (Safe Links, Proofpoint,
Mimecast, a webmail preview). Before she sees a mail, the filter fetches
every link in it: one GET, no cookies, nothing pressed. Authwall mails four
links: the sign-in link, the confirmation link of a new account, the
approval of a move to a new address, and the new address's confirmation.

## Before

Each link acted on the GET itself (AW-78, AW-11). Run on `7cf218e`, the
scanner's GET alone:

```
sign-in link:        the scanner is signed in as Ann
confirmation link:   Mark's password is gone (password_hash null), his
                     session ends, a reset token goes to the scanner (AW-79)
approval link:       approved_at set; the new address gets its link
new address's link:  the account's address is now ann-new@authwall.test
```

The approval is the one an attacker wants: from a borrowed session they ask
to move the account to their own address, and the owner's scanner approves
it for them.

## Expected

A link opens a page that names the address and changes nothing; only its
button acts, with a POST that carries the token and the CSRF token. The
scanner's GET leaves every row as it was and signs nobody in. The owner
presses the button, and the link works as before.

## Why

A scanner reads no advice. "If it was not you, do not open the link" in a
mail protects nobody whose filter opens it first.
