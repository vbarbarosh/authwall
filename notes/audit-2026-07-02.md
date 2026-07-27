# authwall — Safety Review

_Date: 2026-07-02 · Scope: full-project consistency & security review (auth flows, proxy/session/transport, config/docs, missing parts)_

## Verdict

The core auth design is genuinely solid — safe to use once the crash risk (#1) and the two
access-control gaps (#2, #3) are addressed. Test suites pass at review time: **136 unit + 372 API
green**. (Playwright could not run here — browsers not installed in the review environment — that is
environmental, not a code fault.)

**What's done well (on record):** all reset/magic/verify/PAT tokens are SHA-256 hashed (never
plaintext); sessions are server-side and regenerated on every login (no fixation); sign-in is
timing-safe against a dummy bcrypt hash; CSRF uses per-session synchronizer tokens compared
constant-time; inbound `x-auth-*` headers are stripped before proxying; the cookie-WS path enforces a
strict Origin check + signature; OAuth uses session-bound single-use state + PKCE.

---

## Worth fixing before relying on it

### 1. Daily logger can crash the whole proxy — HIGH
`src/services/logger/make_logger_daily.js:32-34`

`fs.createWriteStream(...)` / `stream.write(...)` have no `'error'` listener anywhere. If the logs
dir disappears, permissions change, or the disk fills, the stream emits `error` with no handler →
uncaught exception → process exit. This is the **production default** logger (`AUTHWALL_LOGGER=daily`)
and sits on the hot path of every request — a single point of failure for a gatekeeper. Commit
f623f3f fixed disposal but not the write path.

**Fix:** attach an `'error'` handler to the stream (log-and-continue, or degrade to stdout).

### 2. Rate limiters are bypassable — MED (high-leaning)
`src/create_app.js:53` (`app.set('trust proxy', true)`) + `src/helpers/middleware/rate_limit_middleware.js:20` (`const key = req.ip`)

With all hops trusted, `req.ip` resolves to the client-supplied left-most `X-Forwarded-For`. Rotating
that header per request lands each request in a fresh counter bucket, defeating the sign-in /
password-reset / magic-link / PAT-create limiters and the PAT brute-force miss limiter
(`create_app.js:401`). The WS path is unaffected (it uses `req.socket.remoteAddress`).

**Fix:** set `trust proxy` to a fixed hop count / trusted-proxy list matching the real deployment
(e.g. `trust proxy: 1`), not `true`.

### 3. Two OAuth providers trust unverified emails — MED
`src/oauth_providers/oauth_provider_microsoft.js:61`, `src/oauth_providers/oauth_provider_facebook.js:57`

Both push the raw `email` claim straight into `verified_emails`. The other four providers gate on an
explicit verified flag: Google (`oauth_provider_google.js:61`, `email_verified`), Discord (`verified`),
GitHub (`filter(v => v.verified)`), Twitter (`confirmed_email`). Because
`authorize_oauth_verified_emails` → `authorize_email` treats whatever lands in `verified_emails` as
verified, a configured domain/email allowlist (`AUTHWALL_ALLOWED_DOMAINS`, etc.) can be bypassed: an
attacker asserts any `@allowed-domain` address via Microsoft (whose `email` claim is not guaranteed
verified on the `common` endpoint) and passes the access gate.

Not an account-merge takeover — login matches by provider `sub` (`make_oauth_flow.js:76-79`) and email
identities insert with `onConflict().ignore()` (`make_oauth_flow.js:207-217`); "same email → same
user" only happens in the explicit authenticated *connect* flow. The allowlist bypass is the real
risk, and only when those providers **and** access rules are both enabled.

**Fix:** only add Microsoft/Facebook emails to `verified_emails` when the provider confirms
verification (Facebook Graph `email` is generally the verified account email; Microsoft needs care on
multi-tenant `common`).

---

## Medium

### 4. Password-reset confirm doesn't invalidate sibling reset tokens
`src/routes/password.js:302` marks only the consumed token `used_at`; other outstanding reset tokens
for that user stay valid for their full 10-min TTL. The profile password-change path purges them
(`src/actions/complete_password_change.js:30`), so this is an inconsistency — request two reset
emails, use one, the other still works.

**Fix:** in `complete_password_reset_confirm.js`, add
`db('password_reset_tokens').where({user_id}).whereNull('used_at').del()`.

### 5. Email change has no step-up re-authentication
`src/routes/email_change.js` (request POST) is gated by session + CSRF only, unlike password change
which requires `current_password` (`password.js:338`). Mitigated — the confirmation link goes to the
new address and the old address is notified — and bounded by the single-user assumption, but a
deliberate decision worth making rather than defaulting into.

### 6. `bin/run_knex.js` is broken
Line 4 requires `../db/get_database_env`, which doesn't exist (`db/` has only `index.js`,
`migrations/`, `utf8mb4_bin.js`). Any invocation crashes. Nothing calls it.

**Fix:** delete it, or restore the missing helper.

---

## Lower / hardening

- **Single-use tokens aren't consumed atomically** — `email_verify.js`, `magic_link.js`,
  `email_change.js` do SELECT-then-UPDATE without re-asserting `whereNull('used_at')`; tightly
  concurrent requests with the same token can redeem twice. Needs the secret + ms timing. Fix:
  `update().where('used_at', null)` and treat 0 rows affected as already-used.
- **No cleanup job** for expired sessions/tokens/`auth_events` — filtered on read
  (`SessionStore.js:22`) but never purged, so tables grow unbounded. Fine for single-user; there is no
  purge path at all (not even a bin script).
- **Avatar temp-file leak** — `src/routes/profile.js:73-79`: multer writes to `data/temp-uploads`
  before the handler; `fs_rm` runs only on the success path, so any earlier throw (validation, corrupt
  image via sharp) orphans the file, and nothing sweeps that dir.
- **Rate-limit asymmetry on confirm endpoints** — request-POSTs have IP limiters; the sibling
  `*/confirm` POSTs (password-reset, magic-link, email-verify) don't. Defense-in-depth only (tokens are
  256-bit; codes cap guesses via per-row `attempts`), but the asymmetry is real.
- **Schema/code drift** — `src/helpers/models/get_user_email_and_name.js:12` returns
  `is_verified: ident.is_verified`, but the migration only has `verified_at` — always `undefined` (no
  live consumer today).
- **Docs drift** — `docs/sign-in-flows.md:78` lists `/auth/change-password` as a navigable page but
  only `POST` exists (GET commented out at `password.js:47`); `bin/build-docs` is absent from
  `docs/cli.md`; `knexfile.js` points at a `db/seeds/` dir that doesn't exist;
  `docs/sign-in-flows.md:74-78` omits `/auth/password-reset/sent` (its magic-link sibling is
  documented).
- **Stale test** — `tests/playwright/auth-anon.spec.js:113`: the test titled
  `compatibility: (chromium) MySQL 8.0 accessed over http://172.17.0.1:36060` is a byte-for-byte
  duplicate of the "failed sign-in" test (destructures `request`, never uses it); nothing in the config
  touches MySQL or that address. Debugging leftover — misleading title, redundant coverage.
- **Minor:**
  - authwall's own `connect.sid` cookie is forwarded upstream by default (strip via
    `AUTHWALL_UNSET_HEADERS=cookie`).
  - `async` 3-arg middleware bypasses the `amx` rejection wrapper (`express_routes.js:16`) — latent
    unhandled-rejection trap the day someone adds an `await` to `csrf_middleware`/`auth_middleware`.
  - User enumeration on sign-up (`password.js:151-160`) returns distinct "Email/Username already
    exists", and the existence check precedes `authorize_email`. Reset/magic-link flows are correctly
    non-revealing.
  - Multipart body parsed (temp file written) before CSRF check on `POST /auth/profile`
    (`profile.js:40`) — authenticated-only, bounded by 5 MB + mime filter; documented as intentional.
  - Dead code: `src/helpers/format/format_date_pretty_12.js` (no consumer); `src/routes/dev.js` stale
    and disabled (dump predates `email_verify_tokens`, `email_change_tokens`, `auth_events`,
    `personal_access_tokens`).
  - OAuth `sub` coercion inconsistency: Discord/Twitter wrap in `String(...)`; GitHub returns numeric
    id bare (`oauth_provider_github.js:68`).
  - `src/index.js:92` log typo "Settings" → "Setting"; unreachable `default: fake mailer` branch.

---

## Coverage notes

- **Actions (11/11):** all covered indirectly via API tests; none has a colocated unit test.
- **Routes:** every registered route is exercised by mocha API tests (status/sidecar/health, PATs,
  sessions, all six OAuth flows). Gaps: `GET /auth` root redirect has no direct test; GitHub lacks the
  dedicated route-test pair the other five providers have (covered indirectly); `GET /auth/dev` is
  unregistered by design (smoke asserts 404).
- **Config/docs:** env-var inventory is in three-way parity
  (`config/authwall_env_vars.txt` == `settings.yaml` == `docs/config.md` table), enforced at boot
  (unknown `AUTHWALL_*` rejected). Rate-limit numbers, defaults, Dockerfile/compose ports & volumes,
  email templates (28), and PAT/cookie/version naming all match docs.

---

## Suggested fix order

1. Logger `error` handler (#1) — prevents crashes.
2. `trust proxy` hop count (#2) — restores brute-force protection.
3. Microsoft/Facebook email verification gating (#3) — closes allowlist bypass.
4. Password-reset sibling-token purge (#4).
5. Docs / dead-code / stale-test sweep (#6 and lower items) — separate batch.
