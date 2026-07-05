# Security and Consistency Review - 2026-07-04

Scope: static review of the Node/Express Authwall project in `/app`, focused on auth boundaries, proxy behavior, session/token flows, frontend rendering, configuration, local secrets, and dependency posture.

Commands run:

- `rg --files`, targeted `rg` and source reads
- `npm audit --json`
- `npm audit --omit=dev --json`
- `npm outdated --json`
- Secret-shaped variable scan of `.env` and `.env.example` without printing values
- Reviewed and incorporated `/app/safety-review-2026-07-02.md`

No functional test suite was run for the July 4 review. The July 2 review reports 136 unit and 372 API tests passing at that time, with Playwright unavailable because browsers were not installed in that review environment.

## Executive Summary

The project has good core security structure in several areas: server-side sessions, CSRF on state-changing `/auth` POSTs, OAuth state plus PKCE, hashed one-time tokens, PAT hashes at rest, bearer stripping before proxying, and client-supplied `x-auth-*` header cleanup.

The most important issues to address are:

1. Sidecar auth bypasses email-verification enforcement.
2. The SPA renders some user/OAuth-controlled profile data through `innerHTML` without escaping.
3. Sensitive URL tokens are logged in cleartext by the local logger.
4. The daily file logger can crash the proxy on stream errors.
5. Production dependencies currently include high-severity advisories.
6. Direct/proxy deployment assumptions make IP-based rate limiting spoofable unless the front proxy is configured correctly.
7. Microsoft/Facebook OAuth email handling treats returned emails as verified without an explicit verification signal.

## Findings

### High: `/auth/sidecar` bypasses enforced email verification

Evidence:

- Normal proxied requests enforce email verification in `sign_in_required`: `src/create_app.js:357-379`.
- Bearer/PAT requests enforce email verification in `make_personal_access_token_auth`: `src/create_app.js:401-420`.
- Sidecar auth only checks that a session or PAT maps to a user, then emits `X-Auth-User`: `src/routes/status.js:169-184`.
- Docs state `AUTHWALL_CONFIRM_EMAIL_REQUIRED` holds users until verification before requests reach the app: `docs/security.md:108-110`.

Steps to reproduce:

1. Configure email verification enforcement, for example `AUTHWALL_MAILER=fake`, `AUTHWALL_FLOWS=username,email`, and `AUTHWALL_CONFIRM_EMAIL_REQUIRED=true`.
2. Sign up or sign in as a user whose email identity has `verified_at = null`.
3. Request a normal private upstream path and observe a redirect to `/auth/email-verify`.
4. Request `GET /auth/sidecar` with the same session cookie and observe `200` plus `X-Auth-User`.

Impact:

In nginx/Caddy sidecar deployments, `/auth/sidecar` is the authorization decision for protected upstream apps. A signed-in but unverified session can receive `200` and `X-Auth-User`, even though the normal proxy path would redirect to email verification.

Recommendation:

Make `sidecar_get` share the same authorization predicate as the proxy path. For browser sessions, reject with `401` or `403` when `email_verification_required(req)` is true. Add regression coverage for `AUTHWALL_CONFIRM_EMAIL_REQUIRED=true` and an unverified email session hitting `/auth/sidecar`.

### High: Stored XSS risk in SPA profile rendering

Evidence:

- `normalize_username` accepts any trimmed string: `src/helpers/normalize/normalize_username.js:1-4`.
- `/auth/profile` stores arbitrary `display_name` without HTML constraints: `src/routes/profile.js:64-65`.
- `/auth/status` returns `display_name`, `avatar_url`, `providers`, and sessions to the SPA: `src/routes/status.js:116-131`.
- `frontend_user_identities` forwards identity `value` directly: `src/helpers/models/frontend_user_identities.js:1-12`.
- The SPA interpolates `avatar_url` into an HTML attribute: `design/public_html/spa.html:1485-1488`.
- The SPA interpolates provider `p.value` into `innerHTML` without `escape_html`: `design/public_html/spa.html:1584-1589`.
- `escape_html` exists and is already used for PAT labels and token metadata: `design/public_html/spa.html:1349-1357`, `design/public_html/spa.html:1623-1657`.

Steps to reproduce:

1. In a disposable local environment, create or update an account with an identity value containing HTML, for example an image tag with an event handler.
2. Sign in as that account and open `/auth/profile`.
3. Inspect `#p-connections` and observe the provider `value` is inserted through `innerHTML` without `escape_html`.
4. For the avatar path, seed or mock an OAuth profile response whose avatar URL contains attribute-breaking characters, complete OAuth sign-up, and open `/auth/profile`.

Impact:

Account identity values and OAuth profile data should be treated as untrusted. An attacker-controlled username or provider value can become HTML on the Authwall origin when the profile page renders. The most direct exploitability appears tied to the account whose profile data is rendered, but because this is the authentication origin, any XSS has a high consequence for that user's session, CSRF token, PAT management UI, and account controls.

Recommendation:

Escape all dynamic values before inserting via `innerHTML`, especially `p.value`, `meta.label` if ever made dynamic, `status_label`, `status_cls`, `s.avatar_url`, `sess.uid`, `sess.ip`, and any attribute values. Prefer DOM construction with `textContent` and `setAttribute`. Validate avatar URLs server-side to `https:` or same-origin `/auth/uploads/...`, or avoid rendering external avatar URLs directly.

### High: Sensitive token-bearing URLs are logged in cleartext

Evidence:

- The request logger records raw `req.url`: `src/create_app.js:65-66`.
- The error handler records raw `req.url` and `req.originalUrl`: `src/create_app.js:300-310`.
- Password reset emails place the reset token in a query string link: `src/actions/complete_password_reset_request.js:17-20`.
- Magic-link and email-verification emails also place one-time tokens in query string links: `src/actions/complete_magic_link_request.js:18-22`, `src/actions/complete_email_verify_request.js:23-26`.
- The reset page reads the token from the query string and submits it later by POST: `design/public_html/spa.html:1830-1838`.
- Sentry redaction exists, but it only protects Sentry events, not local stdout/daily logs: `src/services/sentry.js:61-76`.

Steps to reproduce:

1. Start Authwall with stdout logging or `AUTHWALL_LOGGER=daily`.
2. Request a password reset and open the generated `/auth/password-reset/confirm?token=...` link.
3. Check stdout or `data/logs/app-YYYY-MM-DD.log` and observe `[req_begin]` contains the raw URL with the token query parameter.
4. Repeat with `/auth/magic-link/confirm?token=...`, `/auth/email-verify/confirm?token=...`, or an OAuth callback containing `code` and `state`.

Impact:

Local logs can contain password reset tokens, magic-link tokens, email-verification tokens, OAuth authorization codes, and OAuth state. The password reset token is especially sensitive because the GET page request logs it before the user submits the new password form.

Recommendation:

Add a local URL redaction helper and use it in request and error logs. Redact at least query keys containing `token`, `code`, `state`, `secret`, and `password`, matching the Sentry policy. Consider stripping query strings entirely for `/auth/*/confirm` and OAuth callback paths.

### High: Daily file logger can crash the proxy on stream errors

Evidence:

- `make_logger_daily` creates a new write stream with `fs.createWriteStream(...)` and writes each log line to it: `src/services/logger/make_logger_daily.js:27-34`.
- There is no `error` listener on the stream in this module.
- The non-Docker default logger is `daily`, while the Docker image overrides this to stdout.

Steps to reproduce:

1. Run Authwall with `AUTHWALL_LOGGER=daily`.
2. Make a request to force creation of `data/logs/app-YYYY-MM-DD.log`.
3. Make `data/logs` unwritable or otherwise trigger a write failure, such as by filling the filesystem in a disposable test container.
4. Make another request and observe the write stream emits `error`; because no listener is attached, the process can terminate.

Impact:

If the log directory disappears, permissions change, or the disk fills, the stream can emit an unhandled `error`. In Node, an unhandled stream `error` can terminate the process. Because logging sits on the request hot path, this is a single point of failure for the auth gate in file-logging deployments.

Recommendation:

Attach an `error` handler to each stream. Prefer degrading to stdout/stderr with a clear once-per-window warning, or disable file logging after the first write failure instead of crashing request handling.

### High: Production dependency audit reports known vulnerabilities

Evidence:

- `npm audit --omit=dev --json` reports 13 production vulnerabilities: 4 high, 9 moderate.
- Direct production packages with advisories include `axios`, `http-proxy-middleware`, `multer`, `express`, and `@sentry/node`.
- `npm outdated --json` shows available updates, including:
  - `axios` current `1.15.0`, wanted/latest `1.18.1`
  - `http-proxy-middleware` current `3.0.5`, wanted `3.0.7`, latest `4.1.1`
  - `multer` current `2.1.1`, wanted/latest `2.2.0`
  - `express` current `4.22.1`, wanted `4.22.2`, latest `5.2.1`
  - `@sentry/node` current `10.50.0`, wanted/latest `10.63.0`

Steps to reproduce:

1. Run `npm audit --omit=dev --json`.
2. Observe the production vulnerability metadata totals: 13 total, 4 high, and 9 moderate.
3. Compare the advisory list with `package.json` and confirm direct affected packages include `axios`, `http-proxy-middleware`, `multer`, `express`, and `@sentry/node`.
4. Run `npm outdated --json` to confirm newer patched or candidate versions are available.

Impact:

These packages are on important paths:

- `axios` is used for outbound OAuth and mailer calls: `src/http/http_post_json.js:1-10`.
- `http-proxy-middleware` is the main upstream proxy: `src/create_app.js:217-268`.
- `multer` handles authenticated avatar uploads before CSRF validation can run: `src/routes/profile.js:21-40`.

Recommendation:

Patch direct dependencies first and regenerate `package-lock.json`:

- Update `axios` to `^1.18.1`.
- Update `http-proxy-middleware` to at least `3.0.7`, and evaluate `4.x` separately.
- Update `multer` to `^2.2.0`.
- Update `express` to `4.22.2` if staying on Express 4.
- Update `@sentry/node` to `^10.63.0`.

Run `npm audit --omit=dev`, unit/API tests, and proxy/WebSocket tests after the update.

### Medium: Global `trust proxy` makes rate limits and audit IPs spoofable when directly exposed

Evidence:

- Express always trusts proxy headers: `src/create_app.js:53`.
- HTTP rate limiting keys off `req.ip`: `src/helpers/middleware/rate_limit_middleware.js:18-21`.
- Bearer miss limiting also keys off `req.ip`: `src/create_app.js:401-414`.
- Docs warn that a directly reachable instance lets clients control `X-Forwarded-For`: `docs/security.md:137-155`.
- The quick start and direct examples publish Authwall directly on port 3000: `docs/getting-started.md:24-27`, `docs/examples/authwall-direct/docker-compose.yaml:11-12`.

Steps to reproduce:

1. Start Authwall so it is directly reachable, with rate limiting enabled.
2. Send repeated invalid sign-in requests while varying the `X-Forwarded-For` header.
3. Observe each spoofed IP value receives a fresh rate-limit bucket because the limiter key is `req.ip`.
4. Repeat without varying `X-Forwarded-For` and observe the limiter eventually trips for the socket client.

Impact:

If Authwall is reachable directly, a client can rotate `X-Forwarded-For` values to bypass per-IP sign-in, sign-up, password-reset, magic-link, PAT, and bearer miss limits. Audit IPs and last-used IPs also become attacker-controlled.

Recommendation:

Make trust-proxy behavior configurable and document a safe default per deployment mode. For direct mode, use `trust proxy=false`. For proxied mode, prefer a specific trusted proxy subnet or hop count instead of `true`. Consider rate-limit fallback keys that use the socket remote address when the deployment is direct.

### Medium: Microsoft and Facebook OAuth emails are treated as verified without provider proof

Evidence:

- Microsoft maps `user_info.email` directly into `verified_emails`: `src/oauth_providers/oauth_provider_microsoft.js:57-62`.
- Facebook maps `user_info.email` directly into `verified_emails`: `src/oauth_providers/oauth_provider_facebook.js:53-58`.
- Other providers gate email inclusion on explicit verification/confirmation signals, such as Google `email_verified` and Discord `verified`: `src/oauth_providers/oauth_provider_google.js:57-62`, `src/oauth_providers/oauth_provider_discord.js:56-61`.
- `authorize_oauth_verified_emails` and downstream access rules trust the provider array as already verified.

Steps to reproduce:

1. Enable Microsoft or Facebook OAuth and configure an email/domain allow-list such as `AUTHWALL_ALLOWED_DOMAINS=allowed.test`.
2. Mock the provider user-info response to include `email: person@allowed.test` without an explicit verification flag.
3. Complete the OAuth callback for that provider.
4. Observe the provider maps that email into `verified_emails`, and the downstream access rule accepts it as verified.

Impact:

When Microsoft or Facebook OAuth and email/domain allow-lists are both enabled, a provider email that is not actually verified can pass Authwall's access gate. The July 2 review notes this is not an account-merge takeover because login identity is still provider `sub`, but it can weaken allow-list enforcement.

Recommendation:

Only put provider emails into `verified_emails` when the provider response or endpoint guarantees verification for that account and tenant. For Microsoft, avoid treating `common` endpoint email as verified without additional checks. For Facebook, document and test the Graph API guarantee being relied on, or require a stricter provider field if available.

### Medium: Password reset leaves sibling reset tokens valid

Evidence:

- Password-reset confirm marks only the consumed token row as used: `src/routes/password.js:299-303`.
- Password change from profile deletes all pending reset tokens for the user: `src/actions/complete_password_change.js:29-30`.
- `complete_password_reset_confirm` revokes sessions but does not purge other unused reset tokens: `src/actions/complete_password_reset_confirm.js:18-28`.

Steps to reproduce:

1. Request two password reset emails for the same account.
2. Use the token from the first email to complete a password reset.
3. Submit the second token with another new password before its 10-minute expiry.
4. Observe the second reset still succeeds because only the consumed token row was marked `used_at`.

Impact:

If a user requests multiple password reset emails, uses one, and another link remains available inside its TTL, the older link can still reset the password again. This is bounded by token secrecy and a 10-minute expiry, but it is inconsistent with the stronger profile password-change behavior.

Recommendation:

After a successful reset, delete or mark used all other `password_reset_tokens` for that `user_id` where `used_at` is null. Add a regression test that requests two reset links, consumes one, and verifies the other no longer works.

### Medium: Email change has no step-up re-authentication

Evidence:

- Email-change request is gated by browser session and CSRF only: `src/routes/email_change.js:24-40`.
- Password change requires the current password before changing credentials: `src/routes/password.js:321-345`.
- Email-change confirmation is sent to the new address and old-address notification exists, which reduces but does not remove the risk.

Steps to reproduce:

1. Sign in normally and capture the valid session cookie plus CSRF token from `/auth/status`.
2. POST `/auth/email-change/request` with `_csrf` and a new email address, without supplying the current password or any recent-auth proof.
3. Observe the request is accepted and a confirmation link is sent to the new email address.
4. Compare `POST /auth/change-password`, which rejects a password change without `current_password`.

Impact:

A stolen active browser session plus CSRF token can start an email change without proving current password possession or recent authentication. Because email is a recovery and access-control identity, this is a sensitive account change.

Recommendation:

Require step-up authentication for email change: current password when the account has a password, or a recent-auth timestamp from OAuth/magic-link sign-in. If keeping current behavior, document it explicitly as a product decision.

### Medium: WebSocket auth rate limits use a different client IP source than HTTP

Evidence:

- HTTP bearer auth uses `req.ip`: `src/create_app.js:401-414`.
- WebSocket upgrade handling uses `req.socket.remoteAddress`: `src/create_app.js:470-488`.
- Docs say the bearer-token limiter covers both HTTP and WebSocket upgrades: `docs/security.md:85-86`.

Steps to reproduce:

1. Enable PATs and WebSockets.
2. Put Authwall behind a local reverse proxy that forwards WebSocket upgrades.
3. Send invalid bearer-token WebSocket upgrade requests from different clients through the same proxy.
4. Observe the limiter and PAT usage logging use `req.socket.remoteAddress`, which is the proxy address, while HTTP bearer misses use `req.ip`.

Impact:

Behind a reverse proxy, all WebSocket bearer misses can share the proxy's socket address, creating proxy-wide lockout/DoS behavior. The recorded IP for WebSocket PAT usage is also inconsistent with HTTP PAT usage. If WebSockets are exposed directly while HTTP is proxied, the inverse mismatch occurs.

Recommendation:

Centralize client IP derivation for HTTP and upgrade requests. If trusting forwarded headers, parse them only from trusted proxies. Add tests for WebSocket bearer miss limiting behind a simulated forwarded header.

### Medium: Avatar upload temp files can survive failed CSRF or image processing

Evidence:

- `multer` stores uploaded files before `csrf_middleware` runs because the multipart body has to be parsed first: `src/routes/profile.js:35-40`.
- The temp upload destination is `data/temp-uploads`: `src/routes/profile.js:21-24`.
- Temp file cleanup only happens after successful `sharp(...).toFile(...)`: `src/routes/profile.js:73-77`.

Steps to reproduce:

1. Sign in and keep the session cookie.
2. POST a multipart `/auth/profile` request with an image MIME type and an invalid or corrupt image payload, either with a missing or wrong `_csrf` value or with data that makes Sharp throw.
3. Inspect `data/temp-uploads` after the request fails.
4. Observe the temp upload remains because cleanup is only on the successful processing path.

Impact:

An authenticated user can upload image-labeled multipart bodies that fail CSRF or fail Sharp decoding, leaving temp files behind. With repeated 5 MiB uploads, this can fill disk. The current `multer` version also has DoS advisories, increasing priority.

Recommendation:

Add cleanup in a `finally` block after multer runs, or add an error-handling middleware that removes `req.file.path` on any downstream failure. Consider moving CSRF to a header for multipart requests so it can be checked before file storage. Keep `multer` patched.

### Medium: `AUTHWALL_SET_HEADERS` can override `X-Auth-User`

Evidence:

- Client-supplied `x-auth-*` headers are stripped: `src/create_app.js:734-748`.
- Authwall sets `X-Auth-User` for authenticated non-public requests, then applies `config.upstream.set_headers`: `src/create_app.js:245-252`.
- The same order applies to WebSockets: `src/create_app.js:257-264`.
- Docs explicitly say `AUTHWALL_SET_HEADERS` may overwrite `X-Auth-User`: `docs/config.md:458-463`.
- Docs also state public paths never receive `X-Auth-User`: `docs/config.md:340-342`.

Steps to reproduce:

1. Configure `AUTHWALL_SET_HEADERS='X-Auth-User=static-user'`.
2. Sign in and request a private proxied path.
3. Observe the upstream receives `X-Auth-User: static-user` instead of the session user.
4. Request a configured public path and observe the static `X-Auth-User` can still be sent, even though Authwall itself would not set it for public paths.

Impact:

This is not a client-supplied header bypass, but it is a sharp configuration edge. A static `AUTHWALL_SET_HEADERS='X-Auth-User=...'` can defeat the stated trust-boundary semantics, including on public paths where Authwall itself would not set the header.

Recommendation:

Reject `x-auth-*` names in `AUTHWALL_SET_HEADERS` unless an explicit dangerous override flag is set. At minimum, add a warning at startup and update docs to make the trust-boundary exception clear.

### Medium: Local `.env` contains secret-shaped values

Evidence:

- `.gitignore` ignores `/.env`: `.gitignore:1-4`.
- `.dockerignore` excludes `/.env`: `.dockerignore:1-4`.
- `git ls-files` shows `.env` is not tracked; `.env.example` is tracked.
- A value-redacted scan found secret-shaped variables in local `.env`, including Sentry DSN, mailer keys/secrets, OAuth client IDs/secrets, and DB password variable names. Values were not copied into this report.

Steps to reproduce:

1. Run `git ls-files -- .env .env.example` and observe `.env.example` is tracked while `.env` is not.
2. Run a value-redacted scan of local env names, for example `awk -F= '/^[[:space:]#]*[A-Z0-9_]*(SECRET|KEY|TOKEN|DSN|CLIENT_ID|CLIENT_SECRET|PASSWORD)=/ {name=$1; gsub(/^[[:space:]#]+/, "", name); gsub(/[[:space:]]+$/, "", name); if (length(name) > 0) print FILENAME ":" FNR ":" name}' .env .env.example`.
3. Observe non-empty secret-shaped variable names in `.env`; do not print or copy their values.
4. Confirm `.gitignore` and `.dockerignore` exclude `.env`, reducing commit risk but not local workspace exposure.

Impact:

Even commented credentials are often copied from real provider consoles. If this workspace is shared, archived, or used in CI, those values can leak. If any of them were real, rotation is the only reliable remediation.

Recommendation:

Remove credential material from `.env`, keep only empty placeholders or local mock values, and rotate any real credentials that have been stored there. Keep `.env` ignored. Consider adding a secret scanning pre-commit/CI check.

### Low: Email normalization accepts non-email strings while route validation treats them as valid

Evidence:

- `normalize_email` returns a non-empty string unchanged when it has no `@`: `src/helpers/normalize/normalize_email.js:3-12`.
- Runtime routes reject only falsy normalized values, not malformed emails: examples include sign-up `src/routes/password.js:141-156`, magic-link request `src/routes/magic_link.js:41-45`, email add `src/routes/email_add.js:27-31`, email change `src/routes/email_change.js:36-40`, and password reset request `src/routes/password.js:225-230`.
- Access-list config validation has a stricter email regex: `config/make_config.js:530-541`.
- `authorize_email` assumes a domain can be obtained by splitting on `@`: `src/helpers/authorize_email.js:4-8`.

Steps to reproduce:

1. Run `node -e "console.log(require('./src/helpers/normalize/normalize_email')('not-an-email'))"` and observe `not-an-email`.
2. Submit a sign-up, email-add, magic-link, or password-reset form with `email=not-an-email`.
3. Observe the route passes the `!email_normalized` check because the normalized value is non-empty.
4. Compare config access-list parsing, which rejects malformed email addresses with a stricter regex.

Impact:

The application can create or process identity rows of type `email` that are not valid email addresses. Real mailers may reject them, access rules may behave inconsistently, and UI rendering gets more untrusted identity values.

Recommendation:

Split normalization and validation. Have `normalize_email` return `null` for missing local/domain parts, or add a `validate_email_normalized` helper and use it in all email-input routes, seed parsing, OAuth email handling, and config parsing.

### Low: Return URL policy assumes all subdomains are trusted

Evidence:

- `redirect` allows absolute returns to any subdomain of `AUTHWALL_PUBLIC_URL`'s hostname: `src/helpers/redirect.js:9-13`, `src/helpers/redirect.js:44-47`.
- Security docs describe this as open-redirect protection: `docs/security.md:112-119`.

Steps to reproduce:

1. Set `AUTHWALL_PUBLIC_URL=https://example.com`.
2. Request `/auth/sign-in?return=https://attacker.example.com/path`.
3. Complete sign-in.
4. Observe the redirect helper accepts the subdomain return URL and redirects there.

Impact:

This is acceptable only if every subdomain under the configured base hostname is trusted. If users can create subdomains, or if a stale subdomain can be taken over, Authwall can be used as a trusted redirector to that host.

Recommendation:

Make allowed return origins explicit, or add `AUTHWALL_RETURN_URL_SUBDOMAINS=true/false` with a conservative default. Update docs to state the trust requirement.

### Low: Example/default credentials are convenient but risky to copy

Evidence:

- `docker-compose.yaml` uses `authwall:authwall` and `root` for MySQL credentials: `docker-compose.yaml:20-28`.
- `.env.example` includes a seed user with sample passwords: `.env.example:14-21`.
- Getting-started docs tell users `.env` will later hold secrets and OAuth credentials: `docs/getting-started.md:87-105`.

Steps to reproduce:

1. Open `docker-compose.yaml` and `.env.example`.
2. Observe MySQL sample passwords and seed-user sample passwords.
3. Follow the getting-started flow through the `.env` creation guidance.
4. Observe the same local setup path later becomes the place users add real OAuth and mailer credentials.

Impact:

This is fine for local examples, but examples are often copied to production. The docs do include production guidance, but the root-level compose file is the first thing many users will run.

Recommendation:

Add comments in the root `docker-compose.yaml` and `.env.example` that these values are local-only. Consider requiring passwords from `.env` variables for non-demo compose usage.

## Additional Consistency and Hardening Items from July 2 Review

- Single-use token redemption is not atomic in link flows. `email_verify.js`, `magic_link.js`, and `email_change.js` select an unused token and then update by id without reasserting `used_at IS NULL`. This needs token possession plus tight concurrency, but the safer pattern is an atomic conditional update and treating zero affected rows as already used.
  Steps to reproduce: 1. Create a valid email-verification, magic-link, or email-change token in a local test account. 2. Send two confirm requests with the same token at the same time. 3. Inspect the code path and database updates to confirm the row is selected before the update and the update does not reassert `used_at IS NULL`.
- There is no purge path for expired sessions, one-time tokens, or `auth_events`. Reads filter expired rows, but tables can grow indefinitely. Add a scheduled cleanup or maintenance CLI.
  Steps to reproduce: 1. Search for delete or cleanup paths with `rg -n "delete\\(|del\\(|where\\('expires_at'|auth_events|password_reset_tokens|magic_link_tokens|email_verify_tokens|email_change_tokens" src db bin`. 2. Compare the reads that filter expiry with the lack of scheduled cleanup command. 3. Insert or age expired rows locally and observe normal requests do not purge them.
- Confirm endpoints have uneven rate limiting. Request endpoints are IP-limited, while password-reset confirm, magic-code confirm, and email-verification confirm rely mostly on token/code properties and per-row attempts.
  Steps to reproduce: 1. Search route definitions for request and confirm handlers with `rg -n "rate_limit|confirm" src/routes`. 2. Compare request endpoints that include IP rate-limit middleware with confirm endpoints that do not. 3. Send repeated invalid confirm attempts and observe behavior is token/code scoped rather than shared IP scoped.
- `bin/run_knex.js` requires `../db/get_database_env`, which does not exist: `bin/run_knex.js:3-14`. Either remove the helper or restore the missing module.
  Steps to reproduce: 1. Run `test -f db/get_database_env.js; echo $?` and observe a non-zero result. 2. Run `node bin/run_knex.js --help` or inspect the first require in `bin/run_knex.js`. 3. Observe Node fails before reaching knex because the required module is missing.
- `get_user_email_and_name` returns `ident.is_verified`, but the schema uses `verified_at`: `src/helpers/models/get_user_email_and_name.js:4-12`.
  Steps to reproduce: 1. Inspect the identity migrations or schema references for `verified_at`. 2. Run `rg -n "is_verified|verified_at" src db`. 3. Observe this helper reads `ident.is_verified` even though identity verification state is stored as `verified_at`.
- Authwall's own `connect.sid` cookie is forwarded upstream unless operators configure `AUTHWALL_UNSET_HEADERS=cookie`. Consider stripping it by default or documenting the tradeoff more prominently.
  Steps to reproduce: 1. Run a local upstream that echoes request headers. 2. Sign in through Authwall and request a protected upstream path. 3. Observe the upstream receives the browser `Cookie` header, including `connect.sid`, unless `AUTHWALL_UNSET_HEADERS=cookie` is configured.
- Three-argument middleware bypasses the `amx` async rejection wrapper in `express_routes`: `src/helpers/express/express_routes.js:13-20`. Current middleware may be synchronous enough, but future `async` middleware can create unhandled rejections.
  Steps to reproduce: 1. Inspect `src/helpers/express/express_routes.js` and note only handlers with arity below three are wrapped with `amx`. 2. Add a temporary three-argument async middleware that rejects. 3. Hit the route and observe the rejection is not handled by the wrapper.
- Sign-up returns distinct "Email already exists" and "Username already exists" messages. This is a product/usability choice, but it is account enumeration; password reset and magic-link flows are more privacy-preserving.
  Steps to reproduce: 1. Create an account with a known email and username. 2. Submit sign-up once with the existing email and a new username. 3. Submit sign-up again with a new email and the existing username. 4. Observe the responses distinguish which identifier already exists.
- Docs and stale-code drift called out in the July 2 review: `docs/sign-in-flows.md` lists `/auth/change-password` as a page even though only POST exists, `docs/cli.md` does not document `bin/build-docs`, `knexfile.js` references a missing `db/seeds/` directory, and one Playwright test title appears to be a copied MySQL debug leftover.
  Steps to reproduce: 1. Run `rg -n "/auth/change-password|build-docs|db/seeds|MySQL" docs knexfile.js tests`. 2. Compare the matches with route registrations and actual filesystem paths. 3. Observe the documented page, CLI coverage, seed directory, or test title does not match the current project shape.
- Minor cleanup candidates: disabled `src/routes/dev.js` is stale, `src/helpers/format/format_date_pretty_12.js` appears unused, GitHub OAuth returns a numeric `sub` while some providers coerce to string before the common flow coerces again, and `src/index.js` has a log typo.
  Steps to reproduce: 1. Run `rg -n "dev.js|format_date_pretty_12|sub:|listenining|listening" src`. 2. Compare GitHub OAuth's `sub` mapping with providers that call `String(...)`. 3. Observe the stale route/helper references and the log typo are cleanup issues rather than direct exploit paths.

## Positive Controls Observed

- Server-side sessions with DB-backed revocation: `src/helpers/SessionStore.js`.
- Session regeneration on sign-in and password change: `src/helpers/replace_session.js`, `src/actions/complete_sign_in.js`, `src/actions/complete_password_change.js`.
- CSRF token checks on state-changing browser endpoints: `src/helpers/middleware/csrf_middleware.js`.
- OAuth state and PKCE verifier/challenge: `src/helpers/make/make_oauth_flow.js`.
- PATs are generated as high-entropy secrets and stored as SHA-256 hashes: `src/helpers/personal_access_tokens.js`.
- Client `x-auth-*` request headers are stripped before proxying: `src/create_app.js:734-748`.
- WebSocket browser session upgrades require a same-origin `Origin`: `src/create_app.js:688-715`.
- Sentry event redaction removes sensitive headers, body data, and sensitive query parameters: `src/services/sentry.js:61-116`.

## Suggested Remediation Order

1. Fix `/auth/sidecar` email-verification enforcement and add tests.
2. Patch SPA XSS sinks by escaping or replacing `innerHTML` usage.
3. Redact local request/error log URLs.
4. Add a daily logger stream `error` handler.
5. Update vulnerable production dependencies and rerun tests/audit.
6. Make `trust proxy` and return-origin policy explicit configuration.
7. Fix Microsoft/Facebook OAuth verified-email assumptions.
8. Invalidate sibling password-reset tokens after a reset.
9. Add temp upload cleanup on all downstream failures.
10. Tighten email validation and header override safeguards.
11. Clean local `.env` and add secret scanning.
