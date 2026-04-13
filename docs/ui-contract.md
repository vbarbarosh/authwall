# UI Contract

This document defines the minimum stable contract for the auth SPA in
[`design/public_html/spa.html`](../design/public_html/spa.html).

The goal is to keep Playwright coverage small, durable, and focused on page
wiring rather than business logic that is already covered by API tests.

## Scope

The UI contract covers:

- route-to-view mapping
- presence of primary controls on core auth screens
- authenticated vs unauthenticated navigation outcomes
- stable test selectors for Playwright

The UI contract does not cover:

- exact visual styling
- exact marketing copy
- full API behavior
- email contents
- token and session correctness beyond user-visible outcomes

## Stable Routes

- `/auth/sign-in` renders the sign-in view
- `/auth/sign-up` renders the sign-up view
- `/auth/profile` renders the profile view for an authenticated user
- `/auth/sessions` renders the sessions view for an authenticated user
- `/auth/sign-out` renders the sign-out view for an authenticated user

Unauthenticated navigation to authenticated routes may redirect to the sign-in
route. Playwright should assert the user-visible outcome, not the internal
redirect chain.

## Stable Selectors

The following `data-testid` values are the supported Playwright contract:

- `signin-view`
- `signin-form`
- `signin-username`
- `signin-password`
- `signin-submit`
- `signin-google`
- `signin-github`
- `signup-view`
- `signup-google`
- `signup-github`
- `profile-view`
- `sessions-view`
- `signout-view`

## Primary Expectations

- The sign-in route exposes the sign-in form and both OAuth entry buttons.
- The sign-up route exposes the sign-up view and both OAuth entry buttons.
- A successful sign-in with a seeded user lands on the profile view.
- The sessions route is reachable after sign-in.
- The sign-out route is reachable after sign-in and can end the current session.

## Test Ownership

- API tests own auth correctness, redirects, CSRF, session semantics, and email behavior.
- Playwright tests own page rendering, selector stability, and a minimal end-to-end smoke path.
