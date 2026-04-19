Stories

These are higher-level authentication scenarios worth covering with tests.
Prefer turning each stable story into a normal `tests/api/**/*.test.js` case.

Testable now

- [x] prevent user from removing the last authentication method → `last_auth_method.test.js`
  - [x] user signed up using Google, then connected GitHub, then disconnected Google; GitHub should not be disconnectable → `last_auth_method.test.js`
- [x] edge case: user signed up using Google, then connected GitHub, then disconnected Google → `google_re_signup.test.js`
  - [x] later sign-up using the same Google account should create a new user
  - [x] if that email is already attached to another user, the new Google-only account should be created without email
- user navigated to `/auth/profile`; got redirected to `/auth/sign-in?return=/auth/profile`; chose Continue with GitHub; after successful login he should be redirected to `/auth/profile`
- [x] user signed up using GitHub without email; he wants to set password; since no email nor username exists this should be impossible → `github_no_email.test.js`
- user signed up using email+password, then chose Continue with Google using the same verified email; the account should be linked instead of duplicated
- [x] user signed up using GitHub without email, then later connected Google with verified email; now password setup should become possible → `github_no_email.test.js`
- [x] user signed up using Google with verified email, then connected GitHub with the same email; both providers should attach to the same user → `oauth_same_email.test.js`
- [x] user has email+password and Google linked; after changing email, sign-in with the old email should fail and Google sign-in should still work → `email_change.test.js`
- [x] user changed password from profile, then tried to use an older password-reset link; the old reset link should be invalid → `password_reset_after_change.test.js`
- user visited a protected page, chose magic link instead of password sign-in, completed the flow, and should return to the original page
- user visited a protected page, chose sign-up instead of sign-in, completed sign-up, and should return to the original page
- [x] user signed up with `User@example.com`, later signs in with `user@example.com`; it should resolve to the same identity → `email_case_insensitive.test.js`
- [x] user with a Gmail address signs up as `john.doe@gmail.com`; a second sign-up attempt with `johndoe@gmail.com` must be rejected (Gmail ignores dots) → `gmail_dots.test.js`
- [x] user is signed in as account A, then tries to connect an OAuth provider already linked to account B; the operation should fail without cross-account takeover → `oauth_cross_account.test.js`
- [x] user uses an expired magic link after already signing in another way; the link should fail cleanly and should not change session state → `expired_magic_link.test.js`

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
