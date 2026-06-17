# User adds a disallowed email

A signed-in user adds an email from the profile page that the configured access
rules reject — it fails the `authorize_email` check (wrong domain, explicitly
denied, or outside the allow-list).

## Expected

The request fails with a friendly error (e.g. *"Email domain is not allowed"*)
shown on the profile page. Nothing changes: no email identity is attached and no
verification email is sent.

## Why

Access rules apply to every path an email takes into an account, not just
sign-up and OAuth. Adding an email from the profile must enforce the same
allow/deny configuration, and a rejected attempt should read as a clear message
rather than a generic error.
