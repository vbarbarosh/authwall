# A sign-in sends you back to a subdomain, and the landing loads once

Authwall's public URL is `http://corp.test`; the wiki lives on
`wiki.corp.test`, and its sign-in link carries
`return=http://wiki.corp.test/page`. Ann signs up or signs in from the SPA.

## Expected

The SPA's posts ask for their landing (`X-Authwall-Landing: ask`) and get
`{next}` instead of a redirect: the page goes there itself, once. The sign-in
form posts itself and gets the redirect, which the page's `form-action` lets
through to `*.corp.test`. A return to another site lands on `/`, as before. A
post that fails answers `{next}` to the page it came from, and the SPA shows
the error there.

## Why

Before, the SPA followed the redirect inside `fetch`: a landing on the same
host was loaded twice, once by the fetch and once by the page, and a landing on
a subdomain was refused by the page's own `connect-src 'self'`, so sign-up
stopped at "Please wait…". The sign-in form was stopped by `form-action 'self'`
while the account was already signed in (AW-32). Subdomain returns were kept
by the author's pick; the page rules now say so.
