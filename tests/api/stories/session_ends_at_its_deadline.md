# A session ends 30 days after sign-in, however often it is used

Ann signs in on the laptop and uses the app every day. Mallory copied the
laptop's session cookie on day one and replays it every day too, from a script
that ignores the cookie's `Expires`.

## Expected

The session ends at its deadline, sign-in plus `cookie.max_age_days` (30): a
request on day 29 leaves the deadline where it was, and the first request past
it is signed out, Mallory's as well as Ann's. A WebSocket admission neither
extends it nor admits past it. When a reloaded session re-issues its cookie,
the cookie carries the deadline and the configured `HttpOnly`, `SameSite`,
`Path`, `Domain` and `Secure`.

## Why

Every request pushed the stored expiry to now plus 30 days, while the
browser's cookie kept the expiry it got at sign-in: Ann was signed out on day
30, a copied cookie used now and then never was (AW-29). The store rebuilt
the cookie with its expiry only, so express-session dropped it and could not
re-issue the cookie with its attributes (L-01).
