# OAuth Account Linking

Authwall does not automatically link a new OAuth identity to an existing account
only because the provider returns the same email address.

## Example

1. A user creates an email/password account with `foo@authwall.test`.
2. Later, someone signs in with Google and Google returns `foo@authwall.test`.
3. The original user never linked that Google account from their authenticated profile.

Authwall must not merge these identities automatically. The user has to sign in
to the existing account first, then explicitly connect the OAuth provider.

## Why

A verified provider email proves control of that provider account's email. It
does not prove that the provider account should be merged with an existing local
account.

Automatic linking can become an account takeover path:

1. A local account exists for `foo@authwall.test`.
2. Another person signs in with a Google account returning the same email.
3. The system links Google to the local account by email match.
4. The Google user now controls the local account.

Email is also not a stable identity key. Addresses can be unverified locally,
reassigned, aliased, or handled differently across providers and domains.

## Policy

Use provider identity as the login key:

- Google: provider plus `sub`
- GitHub: provider plus user id

Treat email as an account attribute, not proof that two accounts should be
merged.

When an OAuth sign-in returns an email that already exists locally:

- Do not link automatically.
- Ask the user to sign in to the existing account.
- Allow linking only from an authenticated session.
- Prefer re-authentication before attaching the new provider.

Auto-linking may be acceptable only in tightly controlled SSO environments where
the application controls account lifecycle, public sign-up is disabled, and both
provider and local email verification rules are trusted. Authwall's default
should remain explicit linking.
