# Authwall — Full Project Review (bugs, security, consistency, gaps)

_Date: 2026-07-05 · Scope: whole repo at `/app` (v1.14.0, commit `bc3b160`)._
_Method: manual read of the core proxy / WebSocket auth / session store / middleware, plus five
parallel deep-dive reviews (OAuth, credential & token flows, config/parsing, SPA frontend, service
layer). Every claim below was checked against current source. Findings are cross-referenced with the
two prior reviews (`notes/project-audit-2026-07-02.md`, `notes/project-audit-2026-07-04.md`) and
tagged **[NEW]** (not in either prior review, or materially deeper), **[OPEN]** (previously reported,
still present in current code), or **[FIXED]**._

No test suite was executed for this pass (static review). Prior reviews recorded 136 unit + 372 API
green.

---

## Executive summary

The core design remains sound: server-side revocable sessions, per-session synchronizer CSRF tokens
on every state-changing POST, session regeneration on privilege change, SHA-256/bcrypt token hashing
at rest, timing-safe sign-in against a dummy hash, OAuth state+PKCE, inbound `x-auth-*` stripping on
both the HTTP and WS paths, and a same-origin check on cookie-authenticated WebSocket upgrades. The new
WebSocket cookie-auth feature (commit `bd6b750`) is implemented carefully — signature verification,
Origin check, and email-verification enforcement are all present and correct.

The highest-priority items are:

1. **`/auth/sidecar` still bypasses email-verification enforcement** — and now stands out because its
   sibling WS-session path enforces it correctly. **[OPEN, HIGH]**
2. **One-time login/reset tokens and OAuth codes are logged in cleartext** via the raw request URL in
   the local (stdout/daily) loggers. **[OPEN, HIGH]**
3. **Microsoft OAuth trusts the unverified `email` claim** (nOAuth-class) → allow-list bypass + email
   squatting; Facebook has the same shape. **[OPEN, HIGH/MED]**
4. **The daily file logger has no stream `error` handler** → an `ENOSPC`/`EACCES` can crash the whole
   gate. Only async *disposal* was fixed (`f623f3f`); the write path was not. **[OPEN, HIGH-avail]**
5. **PATs survive password reset / change / "sign out everywhere"** — a transiently-stolen session can
   mint a 10-year bearer token that account recovery does not revoke. **[NEW, MED]**
6. **`trust proxy: true`** leaves all IP rate-limiters and audit IPs client-spoofable when directly
   exposed, and is the shared root cause of a stored-in-DB self-XSS vector. **[OPEN, MED]**

### Status of previously-reported items

* **Fixed since the prior reviews:** rate limiting is now routed through `config.rate_limiting.enabled`
  and the magic-link cap is configurable; the dead CSRF secret was dropped (`4d5ebe4`); the daily
  logger's async *disposal* leak was fixed (`f623f3f`).
* **Still open (verified in current code):** sidecar email-verification bypass; token-bearing URLs in
  local logs; daily-logger write-path crash; MS/Facebook unverified-email trust; `trust proxy: true`;
  sibling password-reset tokens; email-change step-up; WS-vs-HTTP limiter key mismatch; avatar temp-file
  orphan; `AUTHWALL_SET_HEADERS` X-Auth-User override; non-atomic single-use token consumption; email
  normalization accepts invalid addresses; return-URL subdomain trust; `bin/run_knex.js` broken require;
  `knexfile.js` `db/seeds` missing; `get_user_email_and_name` `is_verified`; connect.sid forwarded
  upstream; no expiry-purge job; `amx` 3-arg bypass; sign-up enumeration; mailer log typo.

---

## HIGH

### H1. `/auth/sidecar` bypasses enforced email verification — [OPEN]
`src/routes/status.js:169-185`

`sidecar_get` returns `200` + `X-Auth-User` for any session/PAT that maps to a user, with **no**
`email_verification_required` check. The normal proxy path (`create_app.js:374`), the PAT path
(`create_app.js:419`), the management path (`auth_middleware.js:23`), and — notably — the **new
WS-session path** (`create_app.js:580`) all enforce it. In an nginx/Caddy `auth_request` deployment
the sidecar *is* the authorization decision, so a signed-in-but-unverified session reaches the
protected app.

*Repro:* set `AUTHWALL_CONFIRM_EMAIL_REQUIRED=true` with an unverified email identity; a normal path
redirects to `/auth/email-verify`, but `GET /auth/sidecar` with the same cookie returns `200` +
`X-Auth-User`.
*Fix:* have `sidecar_get` share the proxy predicate — reject browser sessions with `401/403` when
`email_verification_required(req)` (and keep PAT parity, which already 403s upstream). Add a
regression test. While here, set `Cache-Control: no-store` on the sidecar response as `status_get`
does (**L-min**).

### H2. One-time tokens & OAuth codes written to local logs in cleartext — [OPEN]
`src/create_app.js:66` (also `270`, `304-305`, `310`, `490`, `503`)

`[req_begin]` logs `JSON.stringify(req.url)` — the full URL including the query string — to whatever
logger is active (default **daily file**, or stdout). Secret-bearing GET routes:
`GET /auth/magic-link/confirm?token=…` (`magic_link.js`), `…/email-verify/confirm?token=…`,
`…/email-change/confirm?token=…`, and OAuth `…/callback?code=…&state=…`. The magic-link `token` is the
raw login secret (DB stores only its SHA-256). Anyone who can read the log file (ops, shipping,
backups, an LFI/SSRF that reaches `config.logs_dir`) can replay an unconsumed, unexpired token and log
in as the victim. Note the asymmetry: Sentry redacts these (`sentry.js:109-116`), the local loggers do
not.

*Repro:* trigger a magic link, open it, then `grep req_begin data/logs/app-$(date +%F).log` → the raw
`?token=` is present; replay it before it is consumed.
*Fix:* redact query-string secrets before logging URLs (reuse/extract `sentry.js`'s `sanitize_url`, or
log only `req.path`) at all six sites; filter at least `token|code|state|secret|password`.

### H3. Microsoft (and Facebook) OAuth treat the provider `email` as verified — [OPEN]
`src/oauth_providers/oauth_provider_microsoft.js:61`, `src/oauth_providers/oauth_provider_facebook.js:57`

Both do `verified_emails: [user_info.email].filter(Boolean)` with **no** verification signal, unlike
Google (`email_verified`), GitHub (`v.verified`), Discord (`verified`), Twitter (`confirmed_email`).
The Microsoft `email` claim from the `common` endpoint is mutable and unverified (the documented
"nOAuth" problem). This "verified" email flows straight into `authorize_oauth_verified_emails` →
`authorize_email`, the access gate.

*Repro:* with `AUTHWALL_ALLOWED_DOMAINS=company.com`, set any Entra account's email attribute to
`attacker@company.com`, complete `GET /auth/microsoft`; the callback accepts it as verified, passes the
allow-list, creates a user, and proxies you in — and writes `attacker@company.com` as a `verified_at`
identity (email squat).
*Fix:* only accept the email with a verification signal — Microsoft: require the ID-token `xms_edov`
(email-domain-owner-verified) claim or `email_verified===true`, else `verified_emails: []`; Facebook:
require/verify a confirmation field or document the Graph guarantee. Unify all six providers on "must
have an explicit verified flag." (Facebook alone is **MED**; Microsoft's `common`-endpoint case is
**HIGH** when MS OAuth + allow-list are both enabled.)

### H4. Daily file logger crashes the proxy on a stream error — [OPEN, availability]
`src/services/logger/make_logger_daily.js:31-34`

`stream = fs.createWriteStream(file, {flags:'a'})` and `stream.write(...)` have **no** `'error'`
listener (grep-confirmed none in `src/services/logger/`). A writable stream emitting `'error'` with no
listener throws → uncaught exception → process exit. Triggers: `ENOSPC` (disk full), `EACCES`/`EROFS`
(unwritable/read-only `logs_dir`), `EMFILE`, or a missing dir. This is the **production default**
logger, written on *every* request — a single point of failure for the gate. `f623f3f` fixed only the
async-disposal path.

*Repro:* run with the daily logger; `chmod 000` (or fill) `logs_dir`; next request → uncaught stream
error → exit.
*Fix:* attach `stream.on('error', …)` at creation (degrade to stderr / disable file logging after
first failure), guard the rotation `end()`, and verify/create `logs_dir` at startup.

---

## MEDIUM

### M1. Personal access tokens survive password reset, password change, and "sign out everywhere" — [NEW]
Deletion of PATs happens **only** in `account.js:34` (account removal). Neither
`complete_password_reset_confirm.js` nor `complete_password_change.js` nor the revoke-all session path
(`sessions.js`) touches `personal_access_tokens`. PAT expiry can be up to 3650 days
(`personal_access_tokens.js:157`) and creation needs only session+CSRF (no password step-up). So an
attacker with transient session control mints a long-lived bearer token; the victim's normal
remediation (change/reset password, sign out everywhere) does **not** revoke it, and it keeps
authenticating proxied upstream traffic — the whole point of the gate.

*Repro:* with a session, `POST /auth/personal-access-tokens {label, expires_days:3650}`, save the
token; reset/change the account password; the `Authorization: Bearer awp_…` still proxies in.
*Fix:* revoke the user's PATs inside `complete_password_reset_confirm` and `complete_password_change`
(and/or expose it in the revoke-all UX).

### M2. `trust proxy: true` → spoofable rate-limits & audit IPs when directly exposed — [OPEN]
`src/create_app.js:53`, `rate_limit_middleware.js:20`, `create_app.js:401/409/414`, `create_app.js:110`

With all hops trusted, `req.ip` = the client-supplied left-most `X-Forwarded-For`. Rotating that header
lands each request in a fresh limiter bucket, defeating the sign-in/sign-up/reset/magic-link/PAT and
bearer-miss limiters; the audit/session IP (`session.ip = req.ip`) is likewise attacker-chosen. The
quick-start/direct examples publish authwall on `:3000` directly, where this bites.

*Repro:* loop invalid sign-ins varying `X-Forwarded-For` → the cap never trips.
*Fix:* set `trust proxy` to the real hop count / trusted CIDR (e.g. `1`), or `false` for direct mode
and key limiters on `req.socket.remoteAddress`. Make it configurable per deployment mode.

### M3. OAuth "connect" flow is an unauthenticated, CSRF-less GET → forced account linking — [NEW]
`src/helpers/make/make_oauth_flow.js:39-52` (vs. the protected `disconnect` at `:34`)

`GET /auth/<provider>?connect=1` starts the connect flow with **no** CSRF token and **no** session
check at *initiation* (the callback checks `req.session.user_id` at `:89`, but initiation is wide
open). This is the classic login-CSRF / forced-linking pattern: an attacker triggers a top-level
navigation to `…?connect=1` in the victim's session; if the victim's browser completes provider auth as
the attacker's identity, the attacker's provider account gets linked to the victim's authwall account
(`:122-131`) — a permanent backdoor sign-in.
*Fix:* require an authenticated session + CSRF at connect initiation (POST + `csrf_middleware`, like
`disconnect`); optionally bind `state` to `req.session.user_id` and re-check on callback.

### M4. `sub` not validated for presence/type → wrong-account sign-in; engine-fragile lookup — [NEW]
`src/helpers/make/make_oauth_flow.js:76-79` (lookup binds raw `user_info.sub`; writes use `String(...)`
at `:99-100,126-127,199-200,230-231`)

Two issues: (1) the login lookup binds `user_info.sub` **unconverted** (a JS *number* for GitHub —
`github.js:67`) against a text column, while inserts store `String(...)`; it works only by DB
type-coercion, which is fragile across the three supported engines. (2) `sub` is never checked for
emptiness: Twitter (`String(tmp.id)`, `twitter.js:61`) and Discord produce the literal `"undefined"`
if the provider response lacks an id, so two such users both key on `value_normalized="undefined"` and
the second sign-in resolves to the first user's identity → **wrong-account login**.
*Fix:* normalize `sub` to `String(...)` once inside each provider's `fetch_user_info` (lookup and write
agree), and reject empty/`undefined`/non-scalar `sub` before any DB access in `callback_get`.

### M5. Non-atomic code attempt-counter → brute-force cap bypass — [NEW]
`src/routes/magic_link.js:145-149`, `src/routes/email_verify.js:130-134`

Both read `record.attempts` then `update({attempts: record.attempts + 1})` — a read-modify-write.
Concurrent confirms read the same value and overwrite (lost updates), so effective guesses exceed
`max_attempts` (default 5). Safe at the default 6-digit code (10⁶), but `code_length` is configurable
down to 4 (`make_config.js:124` → 10⁴); with concurrency the cap is defeated within the 10-min TTL, and
a magic-link code guess is a full sign-in.
*Fix:* atomic guarded increment — `where({id}).where('attempts','<',max).increment('attempts',1)` and
treat 0 affected rows as "too many attempts."

### M6. `AUTHWALL_SET_HEADERS` / `AUTHWALL_UNSET_HEADERS` can override/strip `X-Auth-User` — [OPEN]
`src/create_app.js:245-255` (HTTP), `:257-267` (WS); parsers `parse_set_headers.js`,
`parse_unset_headers.js` (no reserved-name denylist)

`X-Auth-User` is set first, then operator `set_headers` are applied (can pin a static identity for
every request), then `unset_headers` (can drop the real one). CRLF injection is *not* possible
(`http.validateHeaderName/Value`), but the trust-boundary override is.
*Repro:* `AUTHWALL_SET_HEADERS='X-Auth-User=admin-uid'` → upstream sees every request as `admin-uid`.
*Fix:* reject `x-auth-*` names in both parsers (or set `X-Auth-User` *after* the set/unset loops so
operator config cannot clobber it).

### M7. Self-XSS in the SPA (username, session IP, avatar) — escaping applied inconsistently — [refined from prior "HIGH stored XSS"]
`design/public_html/spa.html:1588` (`${p.value||''}`), `:1696` (`${meta}` incl. `sess.ip`), `:1486`
(`<img src="${s.avatar_url}">`)

`escape_html()` exists (`:1349`) and is applied throughout PAT rendering, but the connections, sessions,
and avatar renderers interpolate raw. Reachable values: the **username** identity value
(`normalize_username` has no charset allow-list, `normalize_username.js`), and **`sess.ip`** (under
`trust proxy: true`, `session.ip` is the attacker's `X-Forwarded-For`, and `normalize_ip.js` only strips
`::ffff:` — it does not validate). `avatar_url` is a latent attribute-breakout sink (current providers
don't emit `"`).

Severity nuance: the SPA renders **only the authenticated user's own** `/auth/status`, so today these
are **self-XSS** (Medium). I verified the server-side `render_activity_summary`/`render_log_summary`
reports emit **plain text to stdout** (not HTML), so they do **not** currently escalate this. It becomes
genuine cross-user stored XSS the moment any of these fields is rendered in another user's HTML context
(e.g. a future admin "view sessions" page).

*Repro (username):* sign up with `username=<img src=x onerror=alert(document.cookie)>`; open
`/auth/profile` → fires at `:1588`. *Repro (IP):* sign in sending
`X-Forwarded-For: "><img src=x onerror=alert(1)>`; open `/auth/sessions` → fires at `:1696`.
*Fix:* apply `escape_html` uniformly (`p.value`, `meta`, `sess.uid`, `avatar_url`); build the avatar via
`img.src=` not string HTML. Server-side hardening: add a `normalize_username` charset allow-list and
make `normalize_ip` validate a real IPv4/IPv6 (or `n/a`) before persisting.

### M8. Email change / email removal / account deletion lack step-up re-auth — [OPEN]
`src/routes/email_change.js:23` (session+CSRF only), vs. password change which re-verifies
`current_password` (`password.js:338`, `profile.js:90`). A borrowed/stolen session can start an email
change to an attacker address; confirmation goes to the new address and the old one is notified, but
notification cannot *stop* it, and a swapped email enables a full password-reset takeover.
*Fix:* require `current_password` (or recent-auth) for email change/removal and account deletion.

### M9. Password reset leaves sibling reset tokens valid — [OPEN]
`src/actions/complete_password_reset_confirm.js` marks only the consumed token used; other outstanding
`password_reset_tokens` (10-min TTL) stay redeemable. Profile password-change already purges them
(`complete_password_change.js:30`) — an oversight, not an intended asymmetry.
*Fix:* add `db('password_reset_tokens').where({user_id}).whereNull('used_at').del()` on reset confirm.

### M10. WebSocket bearer-miss limiter uses a different IP key than HTTP — [OPEN]
`src/create_app.js:473` (`req.socket.remoteAddress`) vs. the HTTP path (`req.ip`, `:401`). Behind a
proxy these differ, so a client blocked over HTTP is not blocked over WS (and neither is run through
`normalize_ip`, so `::ffff:x` and `x` are distinct keys).
*Fix:* derive the client IP once via a shared helper and use it in both paths.

### M11. Avatar upload temp files survive failed CSRF or Sharp decode — [OPEN]
`src/routes/profile.js:21-33,73-77` — multer writes to `data/temp-uploads` *before* `csrf_middleware`
(necessary to parse multipart), and `fs_rm(req.file.path)` runs only on the success path. A bad `_csrf`
or a corrupt image (Sharp throws) orphans the temp file; nothing sweeps that dir. Repeated 5 MiB
uploads → disk fill (and current `multer` has DoS advisories).
*Fix:* remove `req.file.path` in a `finally`/error middleware on any downstream failure.

### M12. User-supplied `AUTHWALL_SECRET` accepted with a length-only check — [NEW]
`config/make_config.js:394-399` `validate_secret` enforces only `length >= 32`, no entropy/charset
check. A 32-byte constant (`"aaaa…"`) is accepted and becomes the HKDF root for the express-session
signing key → deterministic, guessable session cookies. (Auto-generation via `crypto.randomBytes` is
fine; the gap is operator-supplied secrets.)
*Fix:* reject low-entropy operator secrets (distinct-byte / Shannon threshold) and document the
requirement.

### M13. Sentry URL redaction fails open on relative URLs; breadcrumbs unsanitized — [NEW]
`src/services/sentry.js:79-97` — `sanitize_url` does `new URL(url)` with no base; a path-only URL
(`/auth/magic-link/confirm?token=…`) throws and the `catch` returns the **original unredacted** string.
`sanitize_sentry_event` (`:61-77`) also never touches `event.breadcrumbs[].data.url`, which can carry
the same `?token=`/`?code=`.
*Fix:* parse with a dummy base (`new URL(url,'http://x')`) or regex the query string, never return an
unfiltered URL when a query is present, and sanitize breadcrumb URLs in `beforeSend`.

---

## LOW

* **L1. Non-atomic single-use token consumption** — [OPEN] `password.js:299-303`, `magic_link.js:79-88`,
  `email_change.js:105-123`, `email_verify.js:72-82` SELECT-then-UPDATE by `id` without re-asserting
  `used_at IS NULL`. Bounded in practice (256-bit tokens, better-sqlite3 serializes writes, unique
  constraints), but should be `UPDATE … WHERE id=? AND used_at IS NULL` + affected-row check.
* **L2. `authorize_email` derives the domain with `split('@')[1]`** — [NEW, flagged by 2 reviewers]
  `authorize_email.js:5` uses the *first* segment; `normalize_email` uses `lastIndexOf('@')`. For
  `foo@bar@evil.com` they disagree, so `allowed/denied_domains` match the wrong string. Chains with
  H3. Fix: derive domain from the last `@` in both places and validate email shape.
* **L3. Runtime email inputs accept malformed addresses** — [OPEN] `normalize_email.js` returns
  non-`@` strings unchanged; routes reject only falsy values, so identity rows that aren't emails can be
  created (config access-list parsing is stricter). Fix: split normalize vs. validate; add a
  `validate_email_normalized` used by all email-input routes, seed parsing, and OAuth.
* **L4. Boolean env `"0"` parses as `true` (fail-open)** — [NEW] `make_config.js:401-404`
  `parse_bool_flag` doesn't map `"0"`, and `safe_bool` is `!!input`, so
  `AUTHWALL_PERSONAL_ACCESS_TOKENS=0` / `AUTHWALL_WEBSOCKETS=0` **enable** those features. Fix: map
  `'0'/'1'` and treat unknown strings as the default, not truthy.
* **L5. `parse_authwall_seed` fragility** — [NEW] `parse_authwall_seed.js:19` unguarded `JSON.parse`
  (a bad `[` seed crashes boot); compact form splits on every `:` so passwords containing `:` are
  truncated; no seed-password validation. Fix: guard `JSON.parse`, limit the compact split, validate.
* **L6. Public-path prefix match on raw `req.path` may allow traversal bypass** — [NEW, deployment-
  dependent] `create_app.js:460-468` `startsWith('/prefix/')` on an un-normalized path; `/lib/..%2fx`
  can satisfy a `/lib/*` public prefix, skip `sign_in_required`, and rely on the upstream to resolve
  the traversal. Fix: normalize/canonicalize `req.path` before matching.
* **L7. `resolve_yaml_vars` interpolates any process env var** — [NEW] `resolve_yaml_vars.js:14-20`
  substitutes `${NAME}` from the *whole* `process.env` (e.g. `${HOME}`, `${AWS_SECRET_ACCESS_KEY}`),
  broader than the `AUTHWALL_*` allow-list implies. Operator-controlled (low), but should be scoped to
  `AUTHWALL_*`.
* **L8. Password-reset request is an existence oracle** — [NEW] `password.js:230-262`: the existing
  branch calls a *throwing* `send_email` (SMTP round-trip → slower, and a mailer error surfaces an error
  page), the non-existent branch just redirects → boolean + timing oracle. Fix: use
  `send_email_nothrow` and/or send after the redirect.
* **L9. Confirmation links act on GET** — [NEW] `magic_link.js`, `email_verify.js`, `email_change.js`
  confirm handlers mutate state (and magic-link *issues a session*) on GET. Mail scanners / link-preview
  bots prefetch the URL → consume the single-use token before the user, and for magic-link the bot
  receives the session cookie. Fix: interstitial POST-confirm page.
* **L10. Email-change confirm holds a DB transaction across SMTP + redirect** — [NEW]
  `email_change.js:122-143` awaits `complete_email_change_confirm` (which sends email and redirects)
  *inside* `db.transaction`. A mailer hang stalls the write lock; an SMTP failure rolls back the
  identity swap. Fix: commit DB writes first, notify/redirect after.
* **L11. Confirm endpoints lack IP rate limiting** — [OPEN] `password.js:44` `/password-reset/confirm`
  (and the magic/verify confirms) have no IP limiter, unlike their `/request` siblings. Bounded by
  256-bit tokens / per-row attempt caps; add for symmetry.
* **L12. Sign-up account enumeration** — [OPEN] `password.js:153/159` return distinct "Email already
  exists" / "Username already exists" (sign-in and reset are correctly uniform). Product tradeoff, but a
  confirmed oracle.
* **L13. OAuth `state`/PKCE not bound to the provider** — [NEW] shared `req.session.oauth_state`
  keys (`make_oauth_flow.js:47-48`); provider B's callback accepts state minted for provider A.
  Defense-in-depth; namespace/tag per provider.
* **L14. Connect flow not transactional; identity insert lacks `onConflict`** — [NEW]
  `make_oauth_flow.js:121-131` (login flow at `:189-218` does both) → half-linked account on partial
  failure and a raw 500 on the check→insert race.
* **L15. OAuth `code` not type-checked** — [NEW] `make_oauth_flow.js:57` `?code[]=a&code[]=b` makes it
  an array that passes `if(!code)` and is forwarded to the token exchange. Assert `typeof===string`.
* **L16. Microsoft `display_name` becomes `"undefined undefined"`** — [NEW]
  `oauth_provider_microsoft.js:59` reads `user_info.givenname`/`familyname`; the OIDC claims are
  `given_name`/`family_name`. Always yields `"undefined undefined"`, stored as the name.
* **L17. Recipient PII + full provider response logged** — [NEW] `send_email.js:30,34` logs recipient
  address, subject, and `JSON.stringify(response)`. No secret token, but PII/flow-metadata in plaintext
  logs. Mask the recipient / drop the body.
* **L18. Mailer provider inconsistencies** — [NEW] Mailjet's `parse_mailjet_email_address` treats a
  comma-separated `to` as one address (SES splits, Resend passes through); Resend omits `{cause}`
  chaining that Mailjet/SES include. Standardize recipient parsing + error chaining.
* **L19. No CR/LF sanitization at the mailer boundary** — [NEW, mitigated] `format_email_name` escapes
  `"` but not CR/LF; safe *only* because all three providers take JSON over HTTPS and validate
  addresses. A future raw-SMTP mailer would make this header injection. Strip control chars now.
* **L20. Return-URL policy trusts all subdomains** — [OPEN, by design] `redirect.js:44-47` allows any
  `*.public_url-host`. Fine if every subdomain is trusted; otherwise add
  `AUTHWALL_RETURN_URL_SUBDOMAINS`.
* **L21. `connect.sid` forwarded upstream by default** — [OPEN] strip via `AUTHWALL_UNSET_HEADERS=cookie`
  or default-strip authwall's own cookie.
* **L22. No purge job for expired sessions / one-time tokens / `auth_events`** — [OPEN] reads filter
  expiry but nothing deletes; tables grow unbounded. Add a maintenance CLI / scheduled cleanup.
* **L23. `amx` skips 3-arg middleware** — [OPEN] `express_routes.js:16` registers `fn.length>=3` raw;
  today's async 3-arg middlewares all `next(err)` (safe), but the day one `throw`s/awaits-and-rejects
  it becomes an unhandled rejection. Wrap async middleware too.
* **L24. First-request dummy-hash timing** — [NEW, informational] `password.js:103-107` computes the
  dummy bcrypt hash lazily; the first sign-in for a non-existent user is measurably slower until warm.
  Precompute at startup.

---

## Cleanup / consistency / docs (trivial)

* **`bin/run_knex.js` is broken** — [OPEN] requires `../db/get_database_env`, which does not exist
  (confirmed). Delete it or restore the helper.
* **`knexfile.js` points at `db/seeds/`** — [OPEN] the directory doesn't exist (`:21,117,138`).
* **`get_user_email_and_name` returns `is_verified`** — [OPEN] schema has `verified_at`, so the field is
  always `undefined` (`get_user_email_and_name.js:12`). Harmless (no live consumer of the field).
* **Mailer log typo** — [OPEN] `index.js:83/86/89` "Settings … as mailer" → "Setting".
* **Dead code** — `src/helpers/format/format_date_pretty_12.js` (no consumer), `src/routes/dev.js`
  (disabled + stale, predates newer tables).
* **Stale Playwright test** — a test titled for MySQL over `172.17.0.1` duplicates the "failed sign-in"
  test; misleading title, redundant coverage.
* **Docs drift** — `docs/sign-in-flows.md` lists `/auth/change-password` as a page (POST-only); `bin/
  build-docs` absent from `docs/cli.md`; `/auth/password-reset/sent` undocumented.

---

## Positive controls verified (do not "simplify" away)

* Server-side revocable sessions + regeneration on sign-in / password change (`SessionStore.js`,
  `replace_session.js`).
* Per-session synchronizer CSRF on every state-changing POST; `crypto_equal` is `timingSafeEqual` with a
  length pre-check and fails **closed** on `undefined`.
* Inbound `x-auth-*` stripped on **both** the HTTP proxy path (`clean_headers`) and the WS upgrade
  handler; WS also strips `authorization` and rejects unauthenticated upgrades.
* WS cookie auth: signature verification + strict same-origin Origin check + email-verification
  enforcement (all present and correct); the only gap is the IP-key asymmetry (M10).
* OAuth `state` is session-bound, strict `!==`, single-use; PKCE S256 with a CSPRNG verifier; no SSRF
  (hard-coded endpoints); login matches by `sub` (not email).
* PATs are ~256-bit secrets stored as SHA-256; raw token shown once; owner-scoped revocation (no IDOR).
* Config validation fails **closed** on unknown `AUTHWALL_*`; DB-URL passwords redacted in the boot
  summary; numeric env clamped; `same_site=none` without `secure` rejected. Env-var parity holds across
  `authwall_env_vars.txt` / `settings.yaml` / `make_config`.
* CI: no `pull_request_target`, no obvious script-injection sink; Trivy rootfs scan present.

---

## Fixing plan (suggested order)

**Batch 1 — access-boundary correctness (do first):**
1. H1 — sidecar: enforce `email_verification_required` (+ `Cache-Control: no-store`); add a regression
   test.
2. H3 — gate Microsoft/Facebook emails behind a real verification signal; unify the six providers.
3. M3 — connect-flow: require session + CSRF at initiation.
4. M4 — normalize/validate `sub` in every provider; reject empty `sub` before DB access.
5. M6 — reject `x-auth-*` in `set/unset_headers` (or set `X-Auth-User` last).

**Batch 2 — recovery & availability:**
6. H4 — daily-logger stream `error` handler + startup `logs_dir` check.
7. M1 — revoke PATs on password reset/change.
8. M9 — purge sibling reset tokens.
9. M2 — make `trust proxy` configurable (default to a safe hop count / `false` for direct).
10. M5 — atomic attempt-counter increment.

**Batch 3 — data hygiene & disclosure:**
11. H2 — redact query-string secrets in the request/error/proxy/WS loggers.
12. M13 — fix Sentry `sanitize_url` fail-open + breadcrumb sanitization.
13. M7 — apply `escape_html` uniformly in the SPA; validate `normalize_ip`; allow-list
    `normalize_username`.
14. M11 — avatar temp-file cleanup on any failure.
15. M8/M12 — email-change step-up; entropy check on operator `AUTHWALL_SECRET`.

**Batch 4 — hardening & correctness (low):**
16. L1 (atomic token consume), L2/L3 (email domain/validation), L4 (`"0"` bool), L5 (seed parsing),
    L6 (path normalization), L7 (yaml var scoping), L8–L10 (reset oracle / GET-confirm / txn-across-SMTP).

**Batch 5 — cleanup:** `bin/run_knex.js`, `knexfile` seeds, `is_verified`, log typo, dead code, stale
test, docs drift, dependency bumps (`axios`, `http-proxy-middleware`, `multer`, `express`,
`@sentry/node`) from the July-4 audit + rerun `npm audit`/tests.
