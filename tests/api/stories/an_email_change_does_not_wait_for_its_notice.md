# An email change does not wait for its notice

Bea changes her address from `old@authwall.test` to `new@authwall.test`.
The old address approves, and she opens the link that came to the new one.
Authwall then tells the old address that it is no longer hers. The mail
server is slow at that moment, or down.

## Expected

The change is made and committed first. Bea lands on the success page at
once, while the notice is still on its way. If the notice fails, the
failure is logged and the change stands: the old address had already
approved it.

## Why

The notice was sent inside the transaction that swapped the addresses,
before its commit, and so was the answer to the browser. A slow mail server
held the transaction open, and with it the database's write lock on
SQLite. A failing one undid the change, and Bea got an error for a mail she
never asked for. The browser could also be told of a change that its
commit then lost (M-06).
