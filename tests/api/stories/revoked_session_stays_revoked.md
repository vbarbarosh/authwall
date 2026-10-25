# A revoked session stays revoked, whatever was in flight

Ann is signed in on a laptop and starts connecting Google; the provider takes
its time to answer. Meanwhile, from the phone, Ann revokes the laptop's
session (or a password reset signs every browser out). Then the laptop's
request finishes, with an error, and saves its session as every failed
request does.

## Expected

The laptop's session row stays gone: the late save changes nothing, and the
laptop's cookie is signed out on its next request.

## Why

The session store upserted on every save, so a request that had loaded the
session before the revocation wrote the row back when it ended, with a fresh
30-day lifetime, and the revoked cookie was signed in again (M-01). A session
read from its row now only updates that row; only a session made in the
request inserts one.
