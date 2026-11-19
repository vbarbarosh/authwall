# Changelog

## Unreleased

### Security

- Every session ends once, at this upgrade, and everyone signs in again:
  1.17 renamed the cookie but kept the sessions, so an old `connect.sid`
  value, sent back as `authwall.sid`, still signed in, and an app behind
  the nginx or Caddy sidecar was still sent that value.
- A seed no longer joins the account that holds its address unconfirmed:
  anyone can sign up with anyone's address. It takes the address from that
  account, as a sign-up takes one nobody confirmed in time, but at once, and
  makes its own user with the seed's password. A confirmed address still
  names the user.
- A seed no longer joins the account found by its username alone: with
  sign-up open, anyone can take a username before the seed runs. An account
  holding the seed's username and none of its addresses confirmed gets none
  of them, and the log says `seed_user_left_alone`: rename or remove a
  stranger's; to your own, add the address from its profile.
- With `AUTHWALL_SIGN_UP=off`, a magic-link request is answered before the
  account lookup and the mail, so neither tells who has an account; a failed
  mail is logged. A repeat within the cooldown costs the same bcrypt work as
  a fresh request, so it does not show that someone asked a minute ago.
- A failing query's error, in the log and in Sentry, no longer carries the
  values bound to it: a session id, a CSRF token, an IP, an email. It names
  the query, with placeholders, and the database's reason.

### Added

- `AUTHWALL_SEED_FILE`: the seed users from a CSV or JSON file instead of
  `AUTHWALL_SEED`, each password kept as its bcrypt hash; both set stops
  startup. A CSV's header row names its columns; a missing or unknown column,
  a plain password or a bad hash stops startup.
- `bin/password-hash`, formerly `bin/bcrypt`, makes such a hash, and the image
  has it: `docker run --rm vbarbarosh/authwall bin/password-hash '…'`.

### Changed

- `bin/build` ends with `bin/self-check`: the image is started as a fresh
  deployment starts it and probed, and one that fails is never pushed.
  Trivy scans that image, not the checkout.
- With `AUTHWALL_SIGN_UP=off` the sign-in page no longer says registration
  is closed: it only leaves out the **Create one** link.

### Fixed

- The documentation works from the keyboard: Enter and Space press the
  theme switch, the Copy buttons and the links, Shift+Tab goes back, and
  Space, the arrows and End scroll. Every key but Tab jumped into the
  search box. A character typed outside a field still starts a search.
  Escape or Tab out of the search results closes them, and a link focused
  going back up the page is no longer hidden under the header.
- A form whose post never reaches Authwall says so, and its button comes
  back: no connection, or a proxy's error page such as a 502 or a 413. It
  showed success ("Profile saved.", the profile after a confirmation that
  failed), showed nothing, or stayed on "Please wait…". Sign-out says so
  too, rather than leaving you where you were.
- An account with no password, signed in by a link or a provider, sets its
  first one from the profile: the form is **Set a password**, with no
  current password asked; it always asked for one, and refused without it.
  An account with no confirmed email or username is told a password needs
  one.
- `bin/migrate` and `bin/migrate-rollback` work on the database
  `AUTHWALL_DB` names, the one the server migrates when it starts, and print
  which one first; they always worked on `data/db.sqlite3`, making it if it
  was missing. `bin/activity-summary` is in the image, so it runs in the
  container as the docs say. `bin/run_knex.js`, which never ran, is gone.
- Two sign-ups for the same new username or email at the same moment, on
  PostgreSQL or SQLite, answer the slower one "Identity already exists", as
  on MySQL; it got "An error occurred", and the error went to Sentry.
- A sign-in by a magic link or its code, by a provider, or a sign-up reached
  from the sign-in page lands on the page it was asked for (`return`), as the
  password form always did; each landed on `/`.
- A confirmed email change is answered at once, and a notice to the old
  address that fails is logged instead of undoing the change: the notice
  went out inside the change's transaction, before its commit.
- Two copies seeding the same user at the same moment, on one fresh
  database, no longer leave a second, empty user: the slower one keeps
  nothing and takes the user the other made, and only one of them logs
  `Created user`. A seed that adds an identity to a user already there logs
  `Added identities`; it said `No changes`.
- Disconnecting a provider is refused when only an unconfirmed address
  would remain and the account has no password: a magic link for that
  address is refused until it is confirmed, so the account was left with no
  way in. With a password, the address stays a way in.

## 1.17.0

### Breaking

- `AUTHWALL_TRUST_PROXY` is written in words: `none`, `hops/N`, a comma list
  of addresses, subnets and presets, or `any`. Unset is still `hops/1`. The
  earlier values stop startup with their replacement: `false` and `0` are now
  `none`, a number `N` is `hops/N`, `true` is `any`. A bad list entry stops
  startup too, naming the variable.
- Startup refuses an email allow list (`AUTHWALL_ALLOWED_EMAILS`,
  `AUTHWALL_ALLOWED_DOMAINS`) with the email flow on and
  `AUTHWALL_CONFIRM_EMAIL_REQUIRED=false`: a typed address would pass the
  list unverified.
- A WebSocket follows the account's verification as pages do: a session
  confirmed elsewhere opens one at once, and an open one, a session's or a
  token's, closes within the lease once its account loses verification or is
  refused by the access rules.
- A session ends 30 days after sign-in, however often it is used, as the
  browser's cookie always did: a copied cookie no longer outlives it. A
  reloaded session re-issues its cookie with the configured attributes and
  that deadline. Sessions older than 30 days end at the upgrade.
- A revoked session stays revoked: a request that loaded it before the
  revocation no longer writes its row back when it ends.
- The proxy recipes and the root `docker-compose.yaml` set
  `AUTHWALL_TRUST_PROXY: none`, as the direct recipe does: Authwall is
  published there with no proxy in front, so a client's `X-Forwarded-For` is
  not its address. The recipes say `hops/1` once a TLS terminator is in front.
- The upstream no longer gets a client's `X_Forwarded_*` or `X_Real_IP`
  (underscore spellings), `Forwarded`, `X-Original-URL`, `X-Rewrite-URL`,
  `X-Original-Host`, `X-Host` or a vendor client-address header
  (`X-Client-IP`, `True-Client-IP`, `CF-Connecting-IP`,
  `X-Cluster-Client-IP`, `X-ProxyUser-Ip`), in either mode, over HTTP and
  WebSockets.
- A pending address yields to its owner: a magic link or a provider that
  vouches for it takes it from another account that has another way in, the
  mailed confirmation link offers *Not my account*, and a pending address
  nobody confirmed within the confirmation window no longer blocks a sign-up,
  an added address or an email change.
- Connecting a provider that vouches for an address still pending on the
  account confirms it, and makes it the primary if there was none.
- Access rules hold existing sessions and tokens, not only new sign-ins: after
  a restart that adds a rule refusing an account, its sessions are sent to
  sign in, its tokens get 403 and its WebSockets are refused. They stay
  stored, and work again once the rule is removed.
- A sign-in or sign-up from the SPA lands on its `return` once: the page no
  longer fetches the landing before it opens it. A `return` on a subdomain of
  `AUTHWALL_PUBLIC_URL`'s host now works from the sign-in form and the SPA;
  the sign-in page's `form-action` lists those subdomains.
- A Facebook address is stored pending, never verified: Facebook does not say
  it confirmed it. A new account gets Authwall's confirmation link with the
  welcome, and the address counts once it is opened. With an allow list and
  Facebook, an unset `AUTHWALL_CONFIRM_EMAIL_REQUIRED` resolves to enabled, so
  the sign-in waits at confirmation, and `false` refuses to start. Connecting
  Facebook from the profile no longer adds its address.
- `AUTHWALL_MAGIC_LINK` is enforced: `link` issues no code and refuses one,
  `code` refuses the link. `link_and_code` works as before.
- The proxy answers 400 to a request target with `#` or one not in origin
  form, before any auth decision.
- `/auth/sidecar` reads the path from `X-Original-URI` or `X-Forwarded-Uri`;
  when both arrive and name different paths, the request is protected.
- The upstream gets `X-Forwarded-For`, `-Host`, `-Proto` and `-Port` set by
  Authwall in proxy mode, and none in direct mode. A client's own
  `X-Forwarded-*` and `X-Real-IP` never reach it. `X-Forwarded-For` is the one
  address Authwall resolved, not the chain; on a WebSocket upgrade
  `X-Forwarded-Proto` is `http` or `https`, no longer `ws` or `wss`.
- Under email access rules, every sign-in checks every verified address the
  account holds, as username sign-in already did. An account that holds an
  address the rules refuse, such as one outside an allow list, can no longer
  sign in by any method.
- A confirmation link opened outside a browser signed in to its account
  hands an account whose only way in is its password to whoever presses its
  page's button, a page that says so first: every session and token ends,
  the password stops working, and that browser sets a new password. An account with a linked provider or a confirmed
  address is not handed over: the link asks to sign in first. In a browser
  signed in to the account nothing changes.
- The session cookie is `authwall.sid`, no longer `connect.sid`: every
  browser signs in once after the upgrade. The app behind Authwall never
  receives it; behind nginx or Caddy, add the cookie filter of the sidecar
  examples.
- The mailed links (the magic link, the confirmation link, the email-change
  approval and the new address's link) act only on a `POST` to their path
  plus `/open`, with the token and the CSRF token. A `GET` of the link serves
  a page that names the address and changes nothing; links in mails already
  sent open that page.

### Upgrading

- Running Authwall from source needs Node 26 (`engines`); the Docker image
  carries its own.
- Eight migrations: `utf8mb4_bin` on the magic-link, reset, verify and
  email-change token tables (MySQL), one OAuth account per provider per user,
  the primary address, confirm codes, and the email-change approval token.
- The OAuth migration adds a unique index and fails if a user already has two
  accounts of one provider. Find them first:

  ```sql
  SELECT user_id, type, COUNT(*)
  FROM user_identities
  WHERE type LIKE 'oauth%'
  GROUP BY user_id, type
  HAVING COUNT(*) > 1;
  ```

- Existing accounts get a primary address: their first verified address on
  record.

### Security

- A `#` in the request line no longer makes a public path an anonymous route
  to any file; public paths are judged on the raw target, in the sidecar too
  (AW-22).
- Public and optional-auth paths refuse `..;` segments and percent-encoding
  that survives one decode, such as `%252e` (AW-03).
- On MySQL, a magic-link code works only for the exact address it was sent to;
  addresses and token hashes compare byte for byte (AW-23).
- A password reset kills pending email-change and verify links; a password
  change does the same and revokes personal access tokens; an email change or
  removal kills the account's other change links (H-01, M-05, AW-27).
- One account per OAuth provider per user. A provider that does not use the
  primary address, or a connect from a borrowed session, waits until the owner
  confirms with a code to the primary address or the password (AW-24).
- Changing the email needs the current primary address's approval before the
  new address gets its link.
- Codes: 10 wrong per address per hour, 20 per IP per 15 minutes, across all
  codes of an address; a code works only in the browser that asked for it
  (AW-02, AW-36).
- Sidecar mode: a client's `X-Original-URI` can no longer name a public path
  for a private request behind Caddy (H-02).
- Sentry: the signed session cookie no longer reaches it; span URLs, query
  strings and the Referer are scrubbed like event URLs.
- An account that holds a denied address no longer signs in through another
  address, a linked provider or a magic link; email and password answers as a
  wrong password (AW-28).
- A stranger who signs up with someone else's address no longer gets in when
  its owner clicks the confirmation link: the account becomes the owner's
  (AW-25).
- A client that drops its connection while a WebSocket upgrade is being
  authenticated no longer ends the process (AW-30).
- An open WebSocket ends with its credential: revoking the session or token,
  signing out, a password reset or change, or removing the account closes it
  at once; a revocation made elsewhere closes it within
  `websockets.recheck_seconds`, 30 by default (M-04).
- An upstream that drops its connection after its headers no longer ends the
  process: that answer is cut short, and the next request is served (AW-76).
- A mail scanner that fetches every link in a message no longer signs it in,
  approves an email change for whoever asked, or takes over an account from
  its confirmation link: each link opens a page, and only its button acts
  (AW-78, AW-11).
- A confirmation link opened in another browser says, before its button is
  pressed, that the account will change hands: its password stops working,
  every browser signed in to it is signed out (AW-79).
- A borrowed session can no longer swap the account's address: removing a
  verified address asks "confirm it is you" first, as do disconnecting a
  provider, creating a token, setting a first password and removing the
  account (AW-77, AW-04).
- A confirmation no longer covers every action for ten minutes: it is spent
  by the one that asked for it, so a borrower at a confirmed session cannot
  link a provider in the owner's name (AW-81).
- The owner hears of a new personal access token, of a removed verified
  address (the mail goes to that address) and of the account's removal
  (AW-92, AW-40).
- Signing in right after signing out, or after a password reset, no longer
  fails with "Invalid CSRF Token": the sign-in form takes the token of every
  status answer (AW-31).
- The app behind Authwall no longer receives Authwall's session cookie,
  over HTTP or a WebSocket, nor an old `connect.sid` Authwall signed; an
  upstream built on Express keeps its own `connect.sid` (AW-19).

### Added

- A primary address per account, shown with a badge in the profile.
- "Confirm it is you": a code to the primary address, the password, or a
  fresh sign-in with a linked provider. It is asked before connecting a
  provider that does not use the primary address, changing the email of an
  account without a primary, removing a verified address, disconnecting a
  provider, creating a personal access token, setting a first password and
  removing the account. A confirmation covers the action that asked for it,
  once, within ten minutes. The ask mails the code to the primary address.
  Removing the account takes two different ways (the password, the code, a
  linked provider) when the account has two.
- Changing the email from the profile.
- `AUTHWALL_SIGN_UP=off` closes sign-up: the sign-up form, a magic link or
  code for an address with no account, and a first OAuth sign-in make no
  account, and the sign-in page says registration is closed. `AUTHWALL_SEED`
  still creates its users. Unset, sign-up stays open.

### Recipes

- Direct: `AUTHWALL_TRUST_PROXY: none`, so a client's `X-Forwarded-For` is
  not trusted (M-08).
- Caddy sidecar: starts again; its `redir` lines lacked a matcher (AW-16).
- nginx sidecar: the sign-in redirect keeps the path encoded (AW-15), the
  auth check sets `X-Forwarded-For` (AW-18).
- Both sidecars: the bearer token stops at the proxy (AW-17).

### Dependencies

- All dependencies at their latest on 2026-11-15; `@sentry/node` 11,
  `dotenv` 18, `markdown-it-anchor` 10, `nock` 15, `express` 5.3,
  `@vbarbarosh/type-helpers` 0.4, `@vbarbarosh/node-helpers` 3.80.1, axios
  1.21.1; `npm audit` clean (follow-redirects 1.16.3, GHSA-mrwp-f3q8-3g9p).
- `@vbarbarosh/express-helpers` removed, and the deprecated `cuid` with it;
  Express's "Promise-like handlers" warning is gone.
- `http-proxy-middleware` removed: Authwall drives `httpxy`, the engine under
  it, directly. `micromatch` and `braces` leave production, and with them
  GHSA-vfj7-8cjw-p6xm, which has no patched `braces`.
- CI actions on their Node 24 majors; Node 26, the LTS since 2026-10, in
  the image (`node:26-alpine`), in CI and in `engines`.
- `body-parser` 2.4.0 and `multer` 2.5.0 close GHSA-27r3-jxmh-p828 and
  GHSA-q7qp-rjg7-q26m, two high advisories of 2026-10; `npm audit` is clean
  again.

## 1.16.0 and earlier

Released before this file; see the git log between the tags.
