# Authwall project audit

Date: 2026-07-10  
Scope: repository at `/app`, version `1.14.0`, commit `39c145926ee569cb5d444be9a861dc90aec8e0a5`  
Review type: inconsistencies, incomplete behavior, and security flaws

## Executive summary

The core design has several strong controls: server-side revocable sessions, session regeneration,
per-session CSRF tokens, timing-safe secret comparison, hashed one-time tokens, OAuth state and PKCE,
and stripping of client-supplied `x-auth-*` headers on HTTP and WebSocket proxy paths.

The project is not ready to be treated as a hardened authentication boundary without remediation.
The most important confirmed problems are:

1. `/auth/sidecar` authorizes users that the normal proxy rejects for missing email verification.
2. One-time login/reset credentials and OAuth codes are written to local logs in cleartext URLs.
3. The installed production dependency tree has 13 known vulnerable packages: 4 high and 9 moderate.
4. The default daily logger can terminate the process on a filesystem stream error.
5. Microsoft and Facebook emails are treated as verified without an explicit verification signal.
6. Password recovery, password change, and "revoke all sessions" leave personal access tokens active.
7. OAuth account connection can be initiated by an unauthenticated, CSRF-less GET request.

Several security guarantees in `docs/security.md` are therefore stronger than the implementation.
Separately, OAuth login does not preserve the protected URL that originally sent the browser to
sign-in, so a successful Google (or other configured OAuth-provider) login lands at `/` instead.

## Verification baseline

- `npm run test:unit`: **136 passing**.
- `npm run test:api`: **372 passing**.
- `npm run test:e2e`: **not executed successfully**. All 54 cases failed before application testing
  because the Chromium, Firefox, and WebKit binaries are absent from the environment.
- `npm audit --omit=dev --json`: **13 vulnerable packages** (4 high, 9 moderate, 0 critical).
- `npm outdated --json`: patched versions are available for each vulnerable direct dependency listed
  in finding H3.

Passing tests do not contradict the findings below. Some insecure behavior is explicitly covered as
current behavior, while concurrency, filesystem-failure, recovery, and hostile-rendering cases are
mostly absent.

## High severity

### H1. Sidecar mode bypasses required email verification

**Evidence:** `src/routes/status.js:168-185` checks only that a session/PAT maps to a user and then
returns `200` plus `X-Auth-User`. It never calls `email_verification_required`. The normal HTTP proxy
does so at `src/create_app.js:371-378`, PAT authentication does so at `src/create_app.js:419-423`,
and browser WebSocket authentication does so at `src/create_app.js:580-582`.

**Impact:** In nginx/Caddy `auth_request` sidecar deployments, a signed-in user with an unverified
email reaches the protected application even when `AUTHWALL_CONFIRM_EMAIL_REQUIRED=true`. This is a
direct authorization bypass.

**Reproduction:**

1. Configure a mailer and set `AUTHWALL_CONFIRM_EMAIL_REQUIRED=true`.
2. Sign up with an email/password account but do not verify its email.
3. Request a normal protected upstream path with the session cookie; observe a redirect to the email
   verification page.
4. Request `GET /auth/sidecar` with the same cookie; observe `200` and `X-Auth-User`.

**Recommendation:** Apply the same authorization predicate to sidecar, browser proxy, PAT, and
WebSocket paths. Return `403` for an authenticated but unverified identity and add `Cache-Control:
no-store`.

### H2. Secret-bearing request URLs are logged in cleartext

**Evidence:** `src/create_app.js:66` logs `req.url` on every request. The proxy/error paths also log raw
URLs at lines 270, 304-310, 490, and 503. GET routes carry raw magic-link, email-verification,
email-change, OAuth `code`, and OAuth `state` values in the query string. The default daily logger
writes these records to disk.

**Impact:** Anyone with access to application logs, shipped log archives, or backups can replay an
unconsumed one-time token. A magic-link token is a login credential. OAuth codes and state also should
not be retained in plaintext operational logs.

**Reproduction:**

1. Run Authwall with the daily or stdout logger and a configured mailer.
2. Request a magic link and open `/auth/magic-link/confirm?token=TEST_SECRET`.
3. Run `rg 'TEST_SECRET|magic-link/confirm' data/logs` or inspect stdout.
4. Observe the complete query string in a `[req_begin]` record. Error and WebSocket logging can expose
   the same value on their respective paths.

**Recommendation:** Centralize URL sanitization and redact at least `token`, `code`, `state`,
`secret`, and `password` before any local log call. Prefer logging the path and a safe allow-list of
query parameters.

### H3. Production dependencies contain known vulnerabilities

**Evidence:** On 2026-07-10, `npm audit --omit=dev --json` reports 13 vulnerable package nodes: 4 high
and 9 moderate. Direct vulnerable dependencies and installed versions are:

| Package | Installed | Audit severity | Patched candidate observed |
|---|---:|---:|---:|
| `axios` | 1.15.0 | high | 1.18.1 |
| `http-proxy-middleware` | 3.0.5 | high | 3.0.7 |
| `multer` | 2.1.1 | high | 2.2.0 |
| `express` | 4.22.1 | moderate | 4.22.2 |
| `@sentry/node` | 10.50.0 | moderate | 10.64.0 |

The tree also contains vulnerable transitive versions of `form-data`, `qs`, `body-parser`, and
OpenTelemetry packages. Relevant high advisories include Axios resource exhaustion/proxy and
prototype-pollution issues, `http-proxy-middleware` multipart injection, and Multer upload DoS.

**Impact:** These libraries sit on outbound OAuth/mailer requests, all proxied upstream traffic, HTTP
parsing, and authenticated avatar uploads. Exact exploitability varies by advisory, but known fixed
versions are available.

**Reproduction:**

1. Run `npm ls axios express http-proxy-middleware multer @sentry/node --depth=0`.
2. Run `npm audit --omit=dev --json`.
3. Confirm metadata totals `high: 4`, `moderate: 9`, `total: 13` and compare package ranges with the
   installed versions.
4. Run `npm outdated --json` to see the patched candidates above.

**Recommendation:** Upgrade direct dependencies and regenerate the lockfile, then rerun all unit,
API, proxy, multipart, and WebSocket tests. Review Axios advisories against all calls that accept
provider-controlled response data.

### H4. Daily logger filesystem errors can terminate Authwall

**Evidence:** `src/services/logger/make_logger_daily.js:27-34` creates a write stream and writes to it
without an `error` listener. An unhandled Node stream `error` event terminates the process.

**Impact:** `ENOSPC`, `EACCES`, `EROFS`, `EMFILE`, a removed log directory, or a failed rotation can
bring down the authentication gateway. The daily logger is the production default and is used on
every request.

**Reproduction:**

1. Start Authwall with `AUTHWALL_LOGGER=daily` and identify `AUTHWALL_LOGS_DIR`.
2. After startup, make that directory unwritable or replace it with a read-only mount.
3. Cross a daily rotation boundary or otherwise force creation/writing of a new stream.
4. Send a request and observe an unhandled write-stream `error` followed by process exit.

An isolated Node reproduction is also possible by creating a daily logger, deleting or making its
destination unwritable before the first `write`, and observing the uncaught stream event.

**Recommendation:** Attach an `error` listener immediately when each stream is created, degrade to
stderr or a disabled-file state, and make rotation/disposal idempotent. Add tests for open, write,
rotation, and shutdown failures.

### H5. Microsoft and Facebook OAuth emails are accepted as verified without proof

**Evidence:** `src/oauth_providers/oauth_provider_microsoft.js:57-62` and
`src/oauth_providers/oauth_provider_facebook.js:53-58` copy `user_info.email` directly into
`verified_emails`. Google, GitHub, and Discord condition inclusion on explicit verification fields.
The resulting array is trusted by `authorize_oauth_verified_emails` and access allow-lists.

Microsoft also uses the multi-tenant `common` endpoint and does not validate a tenant/domain-owner
verification claim.

**Impact:** When one of these providers and an email/domain allow-list are enabled, an email claim not
actually proven by the provider can pass Authwall's access gate and be stored with `verified_at`.

**Reproduction:**

1. Enable Microsoft or Facebook OAuth and set `AUTHWALL_ALLOWED_DOMAINS=allowed.test`.
2. In the existing provider mock, return `email: attacker@allowed.test` without a verification flag.
3. Complete the OAuth callback.
4. Observe sign-up succeeds and the created email identity has `verified_at` populated. Existing API
   tests also describe Microsoft/Facebook sign-up emails as verified without testing proof.

**Recommendation:** Define one provider-neutral contract: `verified_emails` may only contain values
with an explicit, documented provider guarantee. For Microsoft, validate tenant and appropriate
verified-domain claims rather than trusting the `common` user-info `email` field.

## Medium severity

### M1. OAuth connect initiation is vulnerable to login CSRF / forced linking

**Evidence:** `src/helpers/make/make_oauth_flow.js:31-52` exposes `GET /auth/<provider>?connect=1`
without `auth_middleware` or `csrf_middleware`. Only the callback later checks whether the session is
authenticated. The profile SPA uses these GET links at `design/public_html/spa.html:1545-1561`.

**Impact:** An attacker can initiate a provider-connect flow in a victim's Authwall session. If the
provider flow completes as the attacker's provider identity, that identity becomes a persistent
sign-in method for the victim's account.

**Reproduction:**

1. Sign in to Authwall as the victim in one browser.
2. Navigate that browser to `/auth/google?connect=1` from an attacker-controlled page; no CSRF token is
   required.
3. Complete Google authentication using a provider account not yet linked to Authwall.
4. Observe the provider identity is inserted for the victim's `user_id` and can subsequently sign in
   to that account.

**Recommendation:** Start connect flows with authenticated POST routes protected by CSRF. Bind OAuth
state to provider, intent, and initiating `user_id`, then recheck all three in the callback.

### M2. PATs survive password recovery and session revocation

**Evidence:** PAT deletion occurs on account deletion at `src/routes/account.js:34`. Password reset
deletes sessions only (`src/actions/complete_password_reset_confirm.js:18-22`), password change
deletes other sessions/reset tokens only (`src/actions/complete_password_change.js:26-30`), and
"revoke all" deletes browser sessions only (`src/routes/sessions.js:52-66`). PAT lifetime can be as
long as 3650 days.

**Impact:** An attacker with temporary session access can mint a long-lived token. Normal incident
response actions presented to the user do not revoke it, so upstream access persists after recovery.

**Reproduction:**

1. Enable PATs, sign in, and create a PAT through `POST /auth/personal-access-tokens`.
2. Verify it reaches a protected upstream path using `Authorization: Bearer <token>`.
3. Change/reset the password or use "revoke all sessions".
4. Repeat the bearer request; it still succeeds.

**Recommendation:** Revoke all PATs on password reset. Make password change and "revoke all" semantics
explicit in the UI/API, with an option to revoke PATs. Require recent authentication before creating
long-lived PATs.

### M3. `trust proxy: true` permits spoofed limiter and audit IPs in direct deployments

**Evidence:** `src/create_app.js:53` trusts every proxy hop. Limiters key on `req.ip`, and session/audit
metadata stores it. Meanwhile, the quick start and direct Compose example publish Authwall directly
on port 3000 (`docs/getting-started.md:20-30` and
`docs/examples/authwall-direct/docker-compose.yaml:3-12`). Security documentation says direct
exposure is unsafe, contradicting these examples.

**Impact:** A directly connected client can rotate `X-Forwarded-For` to evade sign-in, sign-up,
reset, magic-link, PAT creation, and bearer-miss limits. Stored IP/audit data becomes attacker-chosen.

**Reproduction:**

1. Start the documented direct deployment with rate limiting enabled.
2. Send invalid sign-ins until the limiter returns `429`.
3. Repeat while changing `X-Forwarded-For` on every request.
4. Observe each value receives a new bucket and appears as `req.ip` in session/audit metadata.

**Recommendation:** Make trusted proxies configurable. Default to `false` in direct mode and to a
specific hop count/CIDR in proxy mode. Align every example with the chosen safe behavior.

### M4. Operator header configuration can override the authenticated identity

**Evidence:** HTTP and WebSocket handlers set `X-Auth-User`, then apply
`AUTHWALL_SET_HEADERS`, then `AUTHWALL_UNSET_HEADERS` (`src/create_app.js:245-267`). Parsers do not
reserve `x-auth-*`. `docs/config.md:459-463` explicitly documents the override even though
`docs/security.md:7-21` calls the header trustworthy.

**Impact:** A typo or copied configuration can make every request appear as one static user, or
silently remove identity. The core trust-boundary guarantee becomes configuration-dependent.

**Reproduction:**

1. Set `AUTHWALL_SET_HEADERS='X-Auth-User=admin-uid'`.
2. Sign in as any non-admin user and request the upstream.
3. Observe the upstream receives `X-Auth-User: admin-uid`.
4. Alternatively set `AUTHWALL_UNSET_HEADERS=X-Auth-User` and observe the authenticated header is
   removed. `tests/api/proxy/proxy.test.js` currently asserts removal as supported behavior.

**Recommendation:** Reject all `x-auth-*` names in both configuration parsers and apply Authwall's
identity header last as defense in depth.

### M5. Stored values are interpolated into SPA HTML without escaping

**Evidence:** The SPA uses `innerHTML` for `avatar_url`, identity values, session IP/metadata, session
UID attributes, and parsed user-agent output at `design/public_html/spa.html:1486`, 1588, and
1685-1703. An `escape_html` helper exists and is used in the PAT renderer, but not these paths.
`normalize_username` permits arbitrary non-empty text, and `trust proxy: true` lets a direct client
control the stored session IP.

**Impact:** A user can execute stored script in their own authenticated SPA (self-XSS). The same sink
becomes cross-user stored XSS if an admin/session view later renders another user's data. Attribute
interpolation for OAuth avatar URLs is also unsafe by construction.

**Reproduction:**

1. Sign up with username `<img src=x onerror=alert(1)>` (submit it URL-encoded).
2. Open `/auth/profile`.
3. Observe it is inserted through `${p.value}` into `p-connections.innerHTML` and executes.
4. A second path is signing in with a hostile `X-Forwarded-For` value in a direct deployment, then
   opening `/auth/sessions` where `${meta}` is inserted into `innerHTML`.

**Recommendation:** Use `textContent`, DOM property assignment (`img.src`), and event listeners rather
than HTML string construction for untrusted data. Escape every remaining interpolated value and add
browser tests with hostile identity, IP, UA, URL, label, and UID values.

### M6. OAuth subject identifiers are not validated or consistently normalized

**Evidence:** `src/helpers/make/make_oauth_flow.js:76-79` looks up the raw `user_info.sub`, while writes
use `String(user_info.sub)` at lines 99-100, 126-127, 199-200, and 229-230. GitHub returns a number.
Twitter converts a missing ID into the literal string `"undefined"`. No common validation rejects
missing, compound, or unexpected identifiers. OAuth `code` is likewise only checked for truthiness,
so `?code[]=a` passes local validation.

**Impact:** Behavior depends on database coercion. Malformed provider responses can collapse multiple
identities onto `"undefined"` and potentially sign a later user into the wrong account.

**Reproduction:**

1. Change a provider mock user-info response to omit `id`/`sub`.
2. Complete one sign-up, then repeat with another provider account using the same malformed response.
3. Observe writes use `value_normalized='undefined'` or another coerced value, and lookup can resolve
   the first identity.
4. Run the GitHub flow on SQLite/MySQL/PostgreSQL and compare numeric lookup against the stored text
   value to expose engine-dependent coercion.

**Recommendation:** Validate `sub` centrally as a non-empty scalar string before DB access and use
that one normalized value everywhere. Type-check `code` and `state` as strings and validate provider
response shapes consistently.

### M7. Guess counters and one-time token consumption are not atomic

**Evidence:** Magic-link and email-verification code handlers read `attempts`, then write
`attempts + 1` (`src/routes/magic_link.js:145-149`, `src/routes/email_verify.js:130-134`). Token
handlers select an unused row and later update by `id` without retaining `used_at IS NULL`, including
password reset, magic link, email verification, and email change.

**Impact:** Concurrent requests can lose attempt increments, exceeding the configured guess cap.
Concurrent redemption can perform a nominally single-use action more than once. Magic-link code
success grants a full session, and code length can be configured down to four digits.

**Reproduction:**

1. Create a code-mode magic link and note its database row ID/current `attempts`.
2. Send multiple wrong-code POSTs concurrently, synchronized to begin before the first bcrypt compare
   completes.
3. Read the row and observe `attempts` can increase by fewer than the number of requests on DB engines
   that allow overlapping reads/writes.
4. For token consumption, send two valid confirm requests concurrently and observe both can pass the
   initial `whereNull('used_at')` read before either unconditional-by-ID update commits.

**Recommendation:** Use a guarded atomic increment and require an affected-row count of one. Consume
tokens with `UPDATE ... WHERE used_at IS NULL AND expires_at > now`, then perform the protected action
only for the winning request, ideally in one transaction with appropriate locking/isolation.

### M8. Sensitive account actions lack step-up authentication

**Evidence:** Email change, email removal, account deletion, provider connection, and PAT creation need
only an existing session plus CSRF. Password change separately verifies `current_password`.

**Impact:** A stolen/borrowed session can change the recovery email, delete the account, add a provider
backdoor, or mint a ten-year PAT without recent proof of account control. CSRF protects against
cross-site form submission but not session theft.

**Reproduction:**

1. Capture a valid session cookie and CSRF token from `/auth/status`.
2. POST `/auth/email-change/request`, `/auth/account/remove`, or
   `/auth/personal-access-tokens` without a password or recent-auth credential.
3. Observe the sensitive operation is accepted (subject only to its ordinary confirmation fields).
4. Compare `/auth/change-password`, which rejects a request without `current_password`.

**Recommendation:** Track recent authentication and require step-up for recovery identity changes,
provider linking, account deletion, and long-lived PAT creation. Use current password where available
and an OAuth/magic-link reauthentication path otherwise.

### M9. A successful reset leaves sibling password-reset tokens valid

**Evidence:** `src/routes/password.js:299-303` marks only the presented row used.
`complete_password_reset_confirm` does not invalidate other tokens. Profile password change does
delete all pending reset tokens, making the reset path inconsistent.

**Impact:** If two reset emails were requested, using one does not invalidate the other during its
ten-minute lifetime. Anyone holding the sibling link can change the password again.

**Reproduction:**

1. Request two password-reset emails for the same account, waiting only as required by any request
   limiter.
2. Complete a password reset with the first token.
3. Complete another reset with the second token before expiry.
4. Observe both succeed.

**Recommendation:** In the successful reset transaction, invalidate every unused reset token for the
user. Add a two-token regression test.

### M10. Failed avatar requests leave temporary files behind

**Evidence:** Multer writes a file before CSRF middleware at `src/routes/profile.js:21-40`. Cleanup is
only after successful Sharp processing at lines 73-77; there is no `finally` or error middleware.

**Impact:** An authenticated client can fill disk with up to 5 MiB per request by sending an invalid
CSRF token or image data that Sharp cannot decode. The installed Multer version also has cleanup/DoS
advisories.

**Reproduction:**

1. Sign in and record the contents of `data/temp-uploads`.
2. Send a multipart `POST /auth/profile` with an `image/*` MIME type, a corrupt body, and a missing or
   invalid `_csrf` value.
3. Observe the request fails after Multer has written the upload.
4. List `data/temp-uploads`; the temporary file remains. Repeat to demonstrate unbounded accumulation.

**Recommendation:** Delete `req.file.path` in a `finally`/central error handler for every downstream
outcome. Prefer a CSRF header that can be checked before multipart parsing and add field/count limits.

### M11. Sentry URL redaction fails open for relative URLs and ignores breadcrumbs

**Evidence:** `src/services/sentry.js:79-96` calls `new URL(url)` without a base and returns the
original value on parse failure. Relative request URLs therefore retain secret query parameters.
`sanitize_sentry_event` does not sanitize breadcrumb URLs. This contradicts
`docs/security.md:129-135`.

**Impact:** Magic-link tokens, verification tokens, OAuth codes/state, and reset-related values can be
sent to Sentry even though documentation promises redaction.

**Reproduction:**

1. In a Node test, call the exported `sanitize_sentry_event` with
   `{request:{url:'/auth/magic-link/confirm?token=SECRET'}}`.
2. Observe the output URL still contains `SECRET`; the internal `new URL` throws and the catch returns
   the input.
3. Add `{breadcrumbs:[{data:{url:'https://host/path?token=SECRET'}}]}` and observe it is untouched.

**Recommendation:** Parse with a safe dummy base, never return an unsanitized query string after a
parse failure, and recursively sanitize known breadcrumb/request URL fields. Add relative, absolute,
malformed, encoded-name, repeated-key, and mixed-case tests.

### M12. State-changing confirmation links execute on GET

**Evidence:** Magic-link, email-verification, and email-change GET handlers consume tokens and mutate
account/session state. Email-change confirmation also performs SMTP notification inside its DB
transaction (`src/routes/email_change.js:122-143`).

**Impact:** Mail scanners and link-preview bots can consume a link before the user. A magic-link bot
receives a signed-in session cookie. Slow/failing SMTP can also hold or roll back an email-change DB
transaction.

**Reproduction:**

1. Generate any confirmation link.
2. Fetch it once with `curl -I`/a preview scanner that follows GET requests, or perform an ordinary GET
   without user confirmation.
3. Fetch it again in the intended browser and observe the token is already used.
4. For email change, make the mailer delay or throw and observe transaction duration/rollback is tied
   to notification delivery.

**Recommendation:** Make GET display an interstitial that does not consume the token; perform the
action with a deliberate POST. Commit identity changes before best-effort notification delivery.

### M13. WebSocket and HTTP bearer limits use different client IP identities

**Evidence:** HTTP PAT authentication keys on `req.ip` (`src/create_app.js:401-414`), while WebSocket
upgrades use `req.socket.remoteAddress` (`src/create_app.js:470-540`).

**Impact:** Behind a reverse proxy, all WebSocket clients share the proxy address and can lock each
other out, while an HTTP block does not necessarily apply to WebSocket attempts. Recorded PAT IPs are
also inconsistent.

**Reproduction:**

1. Put Authwall behind a proxy that sets `X-Forwarded-For` and forwards upgrades.
2. Send invalid HTTP bearer requests and invalid WebSocket bearer upgrades from multiple logical
   clients.
3. Observe HTTP counters use forwarded client IPs while all WS counters use the proxy socket address.
4. Confirm an HTTP-blocked forwarded IP can still have a distinct WS limiter state.

**Recommendation:** Derive client identity once from a configurable trusted-proxy policy and share it
across HTTP, WebSocket, rate-limit, audit, and last-used paths.

## Low severity and hardening gaps

### L1. Boolean environment value `0` enables security-sensitive features

**Evidence:** `config/make_config.js:401-404` maps words such as `off` but not `0`; the downstream bool
conversion treats the non-empty string as true.

**Reproduction:**

```sh
node - <<'NODE'
const make_config = require('./config/make_config');
let c = make_config({...process.env, AUTHWALL_PERSONAL_ACCESS_TOKENS: '0'});
console.log(c.personal_access_tokens.enabled); // true
c = make_config({...process.env, AUTHWALL_WEBSOCKETS: '0'});
console.log(c.websockets.enabled); // true
NODE
```

**Recommendation:** Parse `0/1` explicitly and reject unknown boolean strings instead of applying
truthiness.

### L2. Runtime email validation accepts malformed identities and disagrees on domain parsing

**Evidence:** `normalize_email` returns `not-an-email` and `foo@bar@evil.com` unchanged.
`authorize_email` uses the first `@` segment for the domain while normalization uses the last `@`.
Routes generally reject only a falsy normalized value.

**Reproduction:**

```sh
node - <<'NODE'
const n = require('./src/helpers/normalize/normalize_email');
console.log(n('not-an-email'));       // not-an-email
console.log(n('foo@bar@evil.com'));   // foo@bar@evil.com
NODE
```

Then submit either value to a magic-link request or an email-enabled sign-up and observe it passes
local "Invalid email" checks until a later subsystem rejects it or stores it.

**Recommendation:** Separate normalization from validation, enforce a consistent practical address
grammar at every boundary, and derive the domain from the last `@` only after validation.

### L3. Password-reset request remains an existence/timing oracle

**Evidence:** The existing-user branch writes a token and awaits email delivery; the nonexistent-user
branch records an event and redirects immediately (`src/routes/password.js:230-262`). A mailer error
also affects only the existing-user path.

**Reproduction:**

1. Configure a deliberately slow or failing mailer.
2. Submit `/auth/password-reset/request` for one registered and one unregistered email.
3. Compare response time and outcome; only the registered address waits for/fails with mail delivery.

**Recommendation:** Make both visible paths equivalent. Queue/best-effort email after a uniform
response and apply timing equalization where account privacy matters.

### L4. Authwall's session cookie is forwarded upstream by default

**Evidence:** Proxy header cleaning strips `x-auth-*` and bearer authorization, but not `Cookie`.
Operators can manually configure `AUTHWALL_UNSET_HEADERS=cookie`; the secure default does not.

**Reproduction:**

1. Sign in and proxy a request to an echo upstream.
2. Inspect received headers.
3. Observe the signed `connect.sid` cookie is present upstream unless explicitly unset.

**Recommendation:** Remove only Authwall's session cookie before proxying while preserving unrelated
application cookies. Document an opt-in only if an upstream genuinely requires it.

### L5. Expired security records have no cleanup mechanism

**Evidence:** Reads filter expired sessions/tokens, but no route, scheduled task, or CLI purges expired
sessions, magic links, reset/verify/change tokens, revoked/expired PATs, or old auth events.

**Reproduction:**

1. Generate expired sessions and one-time tokens in a long-running instance.
2. Run the service's available maintenance commands and inspect the tables.
3. Observe rows remain indefinitely; `rg` finds no purge command for these tables.

**Recommendation:** Add an idempotent maintenance CLI with configurable retention and deployment
guidance for scheduling it. Index cleanup predicates and test all supported databases.

### L6. Return URLs trust every subdomain

**Evidence:** `src/helpers/redirect.js:44-47` accepts any hostname ending in
`.${AUTHWALL_PUBLIC_URL.hostname}`.

**Reproduction:**

1. Set `AUTHWALL_PUBLIC_URL=https://example.com`.
2. Complete sign-in with `?return=https://untrusted-user-content.example.com/path`.
3. Observe Authwall redirects there.

**Recommendation:** Default to exact-origin returns. Add an explicit allow-list for additional origins
or subdomains when a multi-application deployment needs them.

### L7. Public-prefix authorization uses raw path prefix matching

**Evidence:** `src/create_app.js:460-467` uses `startsWith` for `/*` paths without canonicalizing
encoded separators or dot segments. Whether this becomes a bypass depends on how the upstream
normalizes the forwarded URL.

**Reproduction:**

1. Configure `/public/*` as public and place a protected upstream route outside that prefix.
2. Request variants such as `/public/..%2fprotected` and `/public/%2e%2e/protected` anonymously.
3. Observe Authwall selects the public prefix before proxying.
4. If the upstream decodes/canonicalizes the path to `/protected`, the protected resource is returned
   without Authwall authentication.

**Recommendation:** Canonicalize once, reject ambiguous encoded separators/dot traversal, and ensure
the exact canonical path is used for both authorization and forwarding.

### L8. Operator-provided root secrets receive only a length check

**Evidence:** `config/make_config.js:394-399` accepts any value of 32 characters or more. For example,
32 repeated `a` characters become the HKDF root used for session signing.

**Reproduction:**

1. Set `AUTHWALL_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`.
2. Start Authwall.
3. Observe configuration accepts the predictable secret and issues sessions normally.

**Recommendation:** Require a documented randomly generated encoding and reject obvious low-entropy
values. Do not attempt to estimate arbitrary human password entropy as the only defense; provide and
promote `bin/random-secret` and secret-manager usage.

### L9. Sign-up responses enumerate existing accounts

**Evidence:** Password sign-up reports distinct `Email already exists` and `Username already exists`
errors, while sign-in/reset otherwise attempt uniform behavior.

**Reproduction:**

1. Submit sign-up with a known registered username/email.
2. Submit it with an unregistered value.
3. Compare responses; the existing identifier is explicitly disclosed.

**Recommendation:** Decide and document whether enumeration is an accepted usability tradeoff. If not,
use a generic response and send recovery guidance to the registered address.

## Incompleteness and consistency issues

### I1. `bin/run_knex.js` is unusable

**Evidence and reproduction:**

```sh
node bin/run_knex.js --version
```

It exits with `Cannot find module '../db/get_database_env'`. No such file exists.

**Recommendation:** Delete the unused wrapper or restore/test the database-environment resolver. Add a
CLI smoke test.

### I2. Seed parsing corrupts colon-containing passwords and crashes on malformed JSON

**Evidence:** `src/helpers/parse/parse_authwall_seed.js:17-36` uses unguarded `JSON.parse` and splits
compact records on every colon.

**Reproduction:**

```sh
node - <<'NODE'
const p = require('./src/helpers/parse/parse_authwall_seed');
console.log(p('alice:pa:ss:alice@example.com'));
try { p('[bad'); } catch (e) { console.log(e.name, e.message); }
NODE
```

The password becomes `pa`, `ss` becomes the email, and malformed JSON throws a boot-time syntax error.

**Recommendation:** Use a structured-only format or a delimiter-aware parser, wrap parse failures with
the setting name, and validate seeded usernames, emails, and password policy before bootstrapping.

### I3. Schema, docs, and test inventory have stale entries

**Evidence:**

- `src/helpers/models/get_user_email_and_name.js:12` returns `ident.is_verified`, but the schema uses
  `verified_at`; the value is always undefined.
- `knexfile.js:21-23`, 117-119, and 137-139 point to missing `db/seeds`.
- `docs/sign-in-flows.md:78` describes `/auth/change-password` as a page, while the GET handler is
  commented out and only POST behavior exists.
- `/auth/password-reset/sent` is not in the route table in the same document.
- `bin/build-docs` exists but is absent from `docs/cli.md`.
- `tests/playwright/auth-anon.spec.js:113` names a MySQL compatibility case but duplicates the failed
  sign-in flow and does not use its `request` fixture or a MySQL endpoint.

**Reproduction:**

1. Run `rg -n 'is_verified|verified_at' src db/migrations` and compare the model with the schema.
2. Run `test -d db/seeds; echo $?`; it reports missing.
3. Compare registered routes in `src/routes/password.js` with `docs/sign-in-flows.md`.
4. Compare the two neighboring failed-sign-in Playwright tests around line 86 and line 113.

**Recommendation:** Remove/repair stale fields and directories, generate route documentation from a
single inventory where practical, and replace the mislabeled browser test with a real database
compatibility test or delete it.

### I4. Browser tests are not self-provisioning in the current environment

**Evidence:** `npm run test:e2e` discovered 54 cases but every case failed at browser launch because
Playwright browser executables were absent.

**Reproduction:**

```sh
npm run test:e2e
```

Observe `browserType.launch: Executable doesn't exist` for Chromium, Firefox, and WebKit.

**Recommendation:** Document `npx playwright install --with-deps` as a prerequisite and ensure CI or a
container target provisions the exact browsers pinned by the lockfile. Distinguish infrastructure
launch failures from application test failures in CI reporting.

### I5. OAuth login loses the original protected URL

**Evidence:** A signed-out request to a protected URL is redirected to
`/auth/sign-in?return=<original-url>` by `src/create_app.js:366-369`. The password form explicitly
copies that query parameter into its action at `design/public_html/spa.html:1142-1153`, but all six
OAuth sign-in links use bare provider routes such as `/auth/google` at
`design/public_html/spa.html:453-475`. The shared OAuth initiation code stores only `oauth_state` and
the PKCE verifier in the session (`src/helpers/make/make_oauth_flow.js:39-51`), not the return URL.
After the provider callback, `complete_sign_in` calls the common redirect helper with the callback
request (`src/actions/complete_sign_in.js:23-24`); that request has Google's `code` and `state`, but no
`return`, so `src/helpers/redirect.js:4-6` falls back to `/`. New-account OAuth sign-up has the same
problem through `complete_sign_up`. Because every OAuth provider uses `make_oauth_flow`, this is not
Google-specific.

**Impact:** A user who opens a deep link while signed out and chooses Google authentication is signed
in successfully but is not returned to the requested page. Query strings in the original URL are
also lost. This is especially disruptive for bookmarks, shared links, and applications protected on
subdomains, and it makes OAuth behavior inconsistent with password sign-in.

**Reproduction:**

1. Sign out and open a protected path such as `/projects/123?tab=activity`.
2. Observe the redirect to `/auth/sign-in?return=%2Fprojects%2F123%3Ftab%3Dactivity`.
3. Select **Continue with Google** and complete authentication.
4. Observe that the callback redirects to `/`, not `/projects/123?tab=activity`.

The current callback tests assert authentication state but do not assert the final redirect location
or exercise an OAuth flow that starts with a `return` value.

**Recommendation:** Validate the return URL when OAuth begins, bind it server-side to that specific
OAuth state/intent, and consume it exactly once after a successful callback. Update every OAuth
sign-in/sign-up link to propagate the sign-in page's `return` value to the provider initiation route.
Capture the validated value before session regeneration, use the existing redirect allow-list for the
final redirect, clear it on success/failure, and add API plus browser regression tests for relative
paths, query strings, allowed absolute URLs, rejected external URLs, and all enabled providers.

## Improvement plan

### Phase 1: restore the authorization boundary

1. Enforce email verification in sidecar and add parity tests across HTTP, sidecar, PAT, and WS.
2. Reserve `x-auth-*` headers from operator set/unset configuration and apply identity last.
3. Require authenticated, CSRF-protected POST initiation for OAuth connect and bind state to provider,
   intent, and user.
4. Validate/normalize OAuth `sub`, `code`, `state`, and provider response shapes centrally.
5. Stop treating Microsoft/Facebook email values as verified without a documented proof signal.

### Phase 2: fix secrets, recovery, and availability

1. Redact secret query parameters in every local log and Sentry field before release.
2. Add robust logger stream error handling and filesystem-failure tests.
3. Upgrade vulnerable production dependencies and rerun audit plus all proxy/upload tests.
4. Revoke PATs during password recovery and define revocation semantics for password change and
   "revoke all".
5. Invalidate sibling reset tokens and make all single-use consumption/counters atomic.
6. Add recent-auth step-up for provider linking, email changes, PAT creation, and account deletion.

### Phase 3: close browser, upload, and deployment gaps

1. Replace unsafe SPA `innerHTML` rendering of stored data with DOM-safe assignment and hostile-value
   browser tests.
2. Guarantee temp-upload cleanup on every exit path and upgrade Multer.
3. Replace state-changing GET links with GET interstitial plus POST confirmation.
4. Make trusted-proxy policy explicit/configurable and use one client-IP derivation everywhere.
5. Canonicalize authorized proxy paths and default return URLs to exact origins.
6. Strip the Authwall session cookie before forwarding upstream.
7. Preserve validated return URLs across OAuth initiation/callback and add deep-link regressions for
   every provider.

### Phase 4: validation, maintenance, and consistency

1. Implement strict boolean, email, seed, and secret validation with fail-closed errors.
2. Add an expired-record cleanup CLI and retention documentation.
3. Repair or remove `bin/run_knex.js`, stale schema fields, nonexistent seed directories, docs drift,
   and the mislabeled Playwright test.
4. Provision pinned Playwright browsers in the test environment and add regression cases for every
   finding above.
5. Run the complete acceptance gate: unit, API, all three browser engines, SQLite/MySQL/PostgreSQL,
   `npm audit --omit=dev`, proxy HTTP/WS, multipart failure, logger failure, and concurrent token tests.
