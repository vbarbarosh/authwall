# A WebSocket follows the account's verification, as HTTP does

Confirmation is required. Ann signs up on the laptop, which waits at email
confirmation, and opens the confirmation link on the phone. Later an operator
clears the address's confirmation in the database while Ann's laptop holds a
WebSocket open; Ann also has a personal access token whose socket is open.

## Expected

Once the address is confirmed, the laptop's WebSocket opens at once, as its
pages do: the upgrade asks the account's addresses when the session's
snapshot says "not yet", and heals the snapshot. When the address stops being
confirmed, the open sockets, the session's and the token's, close within the
WebSocket lease, as the pages are held.

## Why

The upgrade read only the session's snapshot, written at sign-in: a session
confirmed elsewhere was refused on WebSockets until it signed in again (M-03).
The lease checked only that the session row or the token still existed, so a
socket outlived the verification its pages had lost (AW-97). Both now ask the
live decision the pages and tokens ask.
