# Changelog

## Unreleased

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
  hands an account whose only way in is its password to whoever opened it:
  every session and token ends, the password stops working, and that browser
  sets a new password. An account with a linked provider or a confirmed
  address is not handed over: the link asks to sign in first. In a browser
  signed in to the account nothing changes.

### Upgrading

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

### Added

- A primary address per account, shown with a badge in the profile.
- "Confirm it is you" before sensitive actions: a code to the primary
  address, the password, or a fresh sign-in with a linked provider.
- Changing the email from the profile.

### Recipes

- Direct: `AUTHWALL_TRUST_PROXY: none`, so a client's `X-Forwarded-For` is
  not trusted (M-08).
- Caddy sidecar: starts again; its `redir` lines lacked a matcher (AW-16).
- nginx sidecar: the sign-in redirect keeps the path encoded (AW-15), the
  auth check sets `X-Forwarded-For` (AW-18).
- Both sidecars: the bearer token stops at the proxy (AW-17).

### Dependencies

- All dependencies at their latest; `@sentry/node` 11, `dotenv` 18,
  `markdown-it-anchor` 10, `@vbarbarosh/type-helpers` 0.4,
  `@vbarbarosh/node-helpers` 3.78.1 (axios 1.20.0; `npm audit` clean).
- `@vbarbarosh/express-helpers` removed, and the deprecated `cuid` with it;
  Express's "Promise-like handlers" warning is gone.
- `http-proxy-middleware` removed: Authwall drives `httpxy`, the engine under
  it, directly. `micromatch` and `braces` leave production, and with them
  GHSA-vfj7-8cjw-p6xm, which has no patched `braces`.
- CI actions on their Node 24 majors, Node pinned to 24.

## 1.16.0 and earlier

Released before this file; see the git log between the tags.
