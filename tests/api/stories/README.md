Stories

These are higher-level authentication scenarios worth covering with tests.
Prefer turning each stable story into a normal `tests/api/**/*.test.js` case.

Testable now

- [x] prevent user from removing the last authentication method → `last_auth_method.test.js`
  - [x] user signed up using Google, then connected GitHub, then disconnected Google; GitHub should not be disconnectable → `last_auth_method.test.js`
- [x] edge case: user signed up using Google, then connected GitHub, then disconnected Google → `google_re_signup.test.js`
  - [x] later sign-up using the same Google account should create a new user
  - [x] if that email is already attached to another user, the new Google-only account should be created without email
- [x] user signed up using GitHub without email; he wants to set password; since no email nor username exists this should be impossible → `github_no_email.test.js`
- [x] user signed up using GitHub without email, then later connected Google with verified email; now password setup should become possible → `github_no_email.test.js`
- [x] user signed up using Google with verified email, then connected GitHub with the same email; both providers should attach to the same user → `oauth_same_email.test.js`
- [x] user has email+password and Google linked; after changing email, sign-in with the old email should fail and Google sign-in should still work → `email_change.test.js`
- [x] user changes their email using a form that differs from its normalized identity; the profile should show the entered address while sign-in continues to use normalized matching → `email_change_preserves_entered_value.md`, `email_change_preserves_entered_value.test.js`
- [x] user changed password from profile, then tried to use an older password-reset link; the old reset link should be invalid → `password_reset_after_change.test.js`
- [x] user signed up with `User@example.com`, later signs in with `user@example.com`; it should resolve to the same identity → `email_case_insensitive.test.js`
- [x] user with a Gmail address signs up as `john.doe@gmail.com`; a second sign-up attempt with `johndoe@gmail.com` must be rejected (Gmail ignores dots) → `gmail_dots.test.js`
- [x] user is signed in as account A, then tries to connect an OAuth provider already linked to account B; the operation should fail without cross-account takeover → `oauth_cross_account.test.js`
- [x] user uses an expired magic link after already signing in another way; the link should fail cleanly and should not change session state → `expired_magic_link.test.js`
- [x] user opens another account's email verification link while signed in; the token owner should be verified without changing the current session email fields → `email_verify_cross_session.md`, `email_verify_cross_session.test.js`
- [x] Google OAuth is restricted to exact email addresses; a listed verified email signs in and an unlisted verified email is rejected → `google_oauth_exact_emails.md`, `google_oauth_exact_emails.test.js`
- [x] Authwall runs as an nginx/Caddy sidecar; a user with an unconfirmed email must be rejected by `/auth/sidecar` exactly as the proxy path rejects them, and admitted once confirmed → `sidecar_unverified_email.md`, `sidecar_unverified_email.test.js`
- [x] user signs in with GitHub, comes back later and signs in again; the second sign-in must resolve to the same account even though GitHub returns the account id as a number → `github_repeat_sign_in.md`, `github_repeat_sign_in.test.js`
- [x] user with no password (OAuth or magic link) sets a first one without supplying a current password, then signs in with it → `set_first_password.md`, `set_first_password.test.js`
- [x] Google is the only enabled flow and `AUTHWALL_ALLOWED_EMAILS` names a single address; that address signs in and any other is rejected, whether or not it was registered through another flow → `basic_google_login_only.md`, `basic_google_login_only.test.js`
- [x] on that same instance the user disconnects Google, then tries to reconnect it choosing an address outside the allow-list; the session survives, `Email is not allowed` is shown, and nothing is linked → `basic_google_login_only2.md`, `basic_google_login_only2.test.js`
- [x] with access rules configured, Google and GitHub sign-ins are rejected when the provider returns no verified email, and every verified email is checked, not just the first → `google_login_with_allow_list.md`, `google_login_with_allow_list.test.js`
- [x] the mailer is disabled and Google sign-in is enabled; a sign-in by a user with a verified email must not attempt to send anything → `disabled_mailer_google_sign_in_flow.md`, `disabled_mailer_google_sign_in_flow.test.js`
- [x] a Google sign-in returning an email that already belongs to a local account must not be linked to it automatically; linking happens only from an authenticated session → `oauth_account_linking.md`, `oauth_account_linking.test.js`
- [x] user signed up with Google and never set a password, then tries email+password sign-in; it fails as `Invalid username or password` without revealing that the account exists → `oauth_no_password.md`, `oauth_no_password.test.js`
- [x] signed-in user adds an email the access rules reject; no identity is attached and no verification is sent → `user_adds_disallowed_email.md`, `user_adds_disallowed_email.test.js`
- [x] with email access rules configured, a username account may not remove its last verified address; without one it could neither sign in nor recover → `user_removes_last_email_under_access_rules.md`, `user_removes_last_email_under_access_rules.test.js`
- [x] the same rules leave an account with no username free to remove its address; a Google sign-in is authorized against the provider's verified emails, not the ones stored locally → `oauth_user_removes_email_under_access_rules.md`, `oauth_user_removes_email_under_access_rules.test.js`
- [x] someone requests a magic link for an address another account registered but never verified; both the link and the code are refused, and the identity stays unverified → `magic_link_pending_identity.test.js`
- [x] `min_password_length` governs new passwords only; an existing shorter password keeps working for sign-in and for the current-password check → `min_password_length.test.js`
- [x] security notifications go only to verified addresses; an unverified one receives no sign-in notice → `notifications_verified_only.test.js`
- [x] password reset for an address nobody verified sends nothing and answers like an unknown address; a completed reset revokes personal access tokens → `password_reset_unverified_email.test.js`
- [x] an attacker holds a second reset link, or the link that went to an address since changed or removed; a completed reset, an email change, and an email removal each kill every reset link still out for the account → `password_reset_settles_recovery.md`, `password_reset_settles_recovery.test.js`
- [x] a Microsoft sign-in's address is stored verified only when the ID token's `xms_edov` claim says the tenant verified its domain; otherwise the account has no email, and under access rules the sign-in is refused → `microsoft_email_verified_by_domain_owner.md`, `microsoft_email_verified_by_domain_owner.test.js`
- [x] two requests carry the same reset, magic, or verification link at the same instant, or five wrong codes arrive at once; exactly one consumes the link and the guess cap holds → `one_time_tokens_consumed_once.md`, `one_time_tokens_consumed_once.test.js`
- [x] Authwall is started with `AUTHWALL_FLOWS=username` and an email access rule; nothing could ever satisfy the rule, so it refuses to start rather than announce an allow-list over a door nobody can enter → `username_only_flow_with_access_rules.md`, `username_only_flow_with_access_rules.test.js`
- [x] Authwall is started with an allow list, the email flow and `AUTHWALL_CONFIRM_EMAIL_REQUIRED=false`; a typed address would pass the list, so it refuses to start → `allow_list_needs_confirmed_email.md`, `allow_list_needs_confirmed_email.test.js`
- [x] with `AUTHWALL_MAGIC_LINK=link` someone posts guessed codes for Mocha's address; no code is stored and every code is refused, and in `code` mode the link is refused → `magic_link_mode_is_enforced.md`, `magic_link_mode_is_enforced.test.js`
- [x] a stranger who knows Mocha's address posts wrong magic-link codes before Mocha types the right one; the code belongs to Mocha's browser, so the stranger's guesses spend nothing and Mocha signs in → `magic_link_code_belongs_to_its_browser.md`, `magic_link_code_belongs_to_its_browser.test.js`
- [x] an attacker guesses codes for an address nobody reads, asking for a new code every minute from many browsers; after 10 wrong codes in an hour every code for the address is refused, and one IP is refused after 20 wrong codes across addresses → `code_guessing_budget.md`, `code_guessing_budget.test.js`
- [x] a client sends its own `X-Auth-User` and the underscore spelling `X_Auth_User`; the upstream receives only the value Authwall sets, over both the HTTP proxy and a WebSocket upgrade → `identity_header_underscore_strip.md`, `identity_header_underscore_strip.test.js`
- [x] a borrowed session links a second Google account to the owner's; the connect is refused, and the database refuses a second account of one provider for one user → `one_account_per_provider.md`, `one_account_per_provider.test.js`
- [x] every account has one primary address, the first verified address it came in with; a provider's address never takes it, an email change moves it to the new value → `primary_address.md`, `primary_address.test.js`
- [x] before a sensitive action the owner confirms it is them, with a code mailed to the primary address, the password, or a fresh sign-in with a linked provider account; five failures within 15 minutes shut out even the right answer → `confirm_it_is_you.md`, `confirm_it_is_you.test.js`
- [x] a borrowed session connects the attacker's own Google account; nothing links until the owner confirms with a code mailed to the primary address or the password, so the attacker's Google never signs in as the owner; the owner's own account links after confirming, and Facebook always asks → `oauth_link_survives_reset.md`, `oauth_link_survives_reset.test.js`
- [x] a borrowed session asks to move the email to the attacker's address; the current primary must approve first, and only then does the new address get its link, so the attacker's address never hears of it → `primary_change_needs_both_addresses.md`, `primary_change_needs_both_addresses.test.js`
- [x] behind Caddy or nginx, an anonymous client asks for a private path and adds the path header its proxy does not set, naming a public path; `/auth/sidecar` sees two headers that disagree and refuses → `sidecar_path_headers_must_agree.md`, `sidecar_path_headers_must_agree.test.js`
- [ ] the owner lost access to the primary address and recovers the account (planned, no story yet)

Needs product decision

- user navigated to `/auth/profile`; got redirected to `/auth/sign-in?return=/auth/profile`; chose Continue with GitHub; after successful login he should be redirected to `/auth/profile` (return URL is not stored in session during OAuth initiation)
- user signed up using email+password, then chose Continue with Google using the same verified email; the account should be linked instead of duplicated (currently creates a new Google-only account)
- user visited a protected page, chose magic link instead of password sign-in, completed the flow, and should return to the original page (return URL not preserved through magic link flow)
- user visited a protected page, chose sign-up instead of sign-in, completed sign-up, and should return to the original page (return URL not preserved through sign-up flow)
- user signed up using GitHub, no verified email was found; now he tries to change password via profile page; what should happen?
- user signed up using email+password with unverified email, then chose Continue with Google with a verified email of the same address; should the email become verified automatically?
- user signed up using Google, signed out, then tried GitHub with the same email but GitHub returned no email; should this link to the existing account or create a new email-less account?
- user signed up using Google with verified email, never set password, then requested password reset by email; should the reset link create a password or should the request be rejected?
- user has only magic-link email auth, removes email or changes it to an unverified address; should this be blocked until another sign-in method exists?
- user has Google linked and username set but no password; should disconnecting Google still be forbidden?
- user has GitHub linked and unverified email+password added; should disconnecting GitHub be forbidden until email verification is complete?
- one user owns an email+password account; another social login returns the same email from a provider; should the system block linking, require prior sign-in, or merge after extra proof?
